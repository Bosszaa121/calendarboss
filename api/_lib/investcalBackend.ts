import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { ChartTimeframe, ChartTrendDirection } from '../../src/types.ts';
import {
  GEMINI_MODEL,
  GEMINI_MODEL_CHAIN,
  buildBatchedInvestCalPrompt,
  buildChartTechnicalPrompt,
  buildClassifyAssetPrompt,
  buildPublicOnlyFallbackBatchedResponse,
  getTodayIso,
  isModelNotFoundError,
  isRetryableQuotaError,
  parseBatchedInvestCalResponse,
  parseChartTechnicalResponse,
  parseClassifiedAssetResponse,
  parsePortfolioPayload,
  parseValidIsoDate,
} from '../../src/utils/geminiParsers.ts';
import {
  collectLivePublicRssNews,
  collectLiveYahooQuotes,
  fetchYahooHistoricalCandles,
  searchYahooFinanceAutocomplete,
} from '../../src/utils/publicMarketFeeds.ts';

// Shared model health & in-memory cache (persists across warm serverless invocations & local Express)
let activeServerModel: string = GEMINI_MODEL;
const permanentlyUnavailableModels = new Set<string>();
const rateLimitedUntilMs = new Map<string, number>();

const MODEL_COOLDOWN_MS = 60_000;
const BATCHED_SERVER_CACHE_TTL_MS = 15 * 60_000;
const CLASSIFY_CACHE_TTL_MS = 60 * 60_000;
const CHART_HISTORY_CACHE_TTL_MS = 15 * 60_000;
const CHART_ANALYSIS_CACHE_TTL_MS = 30 * 60_000;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

let lastGeminiCallAt = 0;
let pacingQueue: Promise<void> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireGeminiSlot(): Promise<void> {
  const prev = pacingQueue;
  let release!: () => void;
  pacingQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prev;
  const elapsed = Date.now() - lastGeminiCallAt;
  const minGapMs = 400;
  if (elapsed < minGapMs) {
    await sleep(minGapMs - elapsed);
  }
  lastGeminiCallAt = Date.now();
  release();
}

function getCachedValue<T>(key: string): T | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCachedValue<T>(key: string, data: T, ttlMs: number): void {
  responseCache.set(key, { data, expiresAt: Date.now() + ttlMs });
  if (responseCache.size > 160) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
}

async function withServerCacheAndDedup<T>(
  cacheKey: string,
  ttlMs: number,
  force: boolean,
  fetcher: () => Promise<T>
): Promise<{ data: T; fromServerCache: boolean }> {
  if (!force) {
    const cached = getCachedValue<T>(cacheKey);
    if (cached) return { data: cached, fromServerCache: true };
  }

  const existingInFlight = inFlightRequests.get(cacheKey);
  if (existingInFlight) {
    const data = (await existingInFlight) as T;
    return { data, fromServerCache: true };
  }

  const promise = (async () => {
    try {
      const result = await fetcher();
      setCachedValue(cacheKey, result, ttlMs);
      return result;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, promise);
  const data = await promise;
  return { data, fromServerCache: false };
}

/**
 * Sets standard CORS headers for public market/AI endpoints (no cookies/credentials)
 * and handles OPTIONS preflight & non-POST method rejection with JSON HTTP 405.
 * Returns true if the response has already been sent.
 */
export function applyCorsAndPreflight(
  req: { method?: string; headers?: Record<string, string | string[] | undefined> },
  res: {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => { json: (body: unknown) => void; end: () => void };
  },
  allowedMethods: string[] = ['POST', 'OPTIONS']
): boolean {
  const originHeader = req.headers?.origin;
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
  const allowOrigin =
    origin &&
    (origin.startsWith('https://') ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1'))
      ? origin
      : '*';

  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  if (allowOrigin !== '*') {
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '));
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Gemini-Api-Key');

  const method = (req.method || '').toUpperCase();
  if (method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }

  if (!allowedMethods.includes(method)) {
    res.status(405).json({
      error: `Method ${method || 'UNKNOWN'} Not Allowed. Supported: ${allowedMethods.join(', ')}`,
    });
    return true;
  }

  return false;
}

/**
 * Safely parses JSON request body across both Express and Vercel Serverless runtimes.
 */
export function parseJsonBody(req: { body?: unknown }): Record<string, unknown> {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      const parsed = JSON.parse(req.body);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof req.body === 'object' && !Array.isArray(req.body)) {
    return req.body as Record<string, unknown>;
  }
  return {};
}

/**
 * Resolves the Gemini API key with priority:
 * 1) Optional per-request `x-gemini-api-key` header (never logged or persisted)
 * 2) Server environment variable `process.env.GEMINI_API_KEY`
 */
export function resolveGeminiApiKey(req?: {
  headers?: Record<string, string | string[] | undefined>;
}): string | null {
  const rawHeader = req?.headers?.['x-gemini-api-key'] ?? req?.headers?.['X-Gemini-Api-Key'];
  const headerKey = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (typeof headerKey === 'string') {
    const trimmed = headerKey.trim();
    if (trimmed.length >= 10 && trimmed.length <= 256) {
      return trimmed;
    }
  }
  const envKey = process.env.GEMINI_API_KEY?.trim();
  return envKey && envKey.length > 0 ? envKey : null;
}

function createGeminiClient(apiKey: string | null): GoogleGenAI | null {
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getCandidateModels(): string[] {
  const now = Date.now();
  const baseOrder = [
    activeServerModel,
    ...GEMINI_MODEL_CHAIN.filter((m) => m !== activeServerModel),
  ].filter((m) => !permanentlyUnavailableModels.has(m));

  const ready = baseOrder.filter((m) => (rateLimitedUntilMs.get(m) ?? 0) <= now);
  const cooling = baseOrder.filter((m) => (rateLimitedUntilMs.get(m) ?? 0) > now);
  return [...ready, ...cooling];
}

/**
 * Free-Tier-Safe Server-Side Gemini JSON generator (ZERO googleSearch tool -> prevents 429 bursts).
 * Primary: gemini-3.8-flash -> Fallback: gemini-3.5-flash-lite -> remaining chain.
 */
async function generateJsonWithFallback(ai: GoogleGenAI, contents: string) {
  const candidates = getCandidateModels();
  let lastError: unknown;

  for (const model of candidates) {
    try {
      await acquireGeminiSlot();
      const config: {
        responseMimeType: string;
        thinkingConfig?: { thinkingLevel: ThinkingLevel };
      } = {
        responseMimeType: 'application/json',
      };

      if (model.startsWith('gemini-4')) {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }

      const response = await ai.models.generateContent({
        model,
        contents,
        config,
      });

      activeServerModel = model;
      rateLimitedUntilMs.delete(model);
      return response;
    } catch (err) {
      lastError = err;

      if (isModelNotFoundError(err)) {
        permanentlyUnavailableModels.add(model);
        continue;
      }

      if (isRetryableQuotaError(err)) {
        rateLimitedUntilMs.set(model, Date.now() + MODEL_COOLDOWN_MS);
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}

function formatServerGeminiError(
  err: unknown,
  fallbackThai: string
): { status: number; message: string; rateLimited: boolean; isDailyLimit: boolean } {
  const raw = err instanceof Error ? err.message : String(err || '');
  const lower = raw.toLowerCase();

  if (raw.includes('GEMINI_API_KEY')) {
    return { status: 503, message: raw, rateLimited: false, isDailyLimit: false };
  }
  if (
    raw.includes('API_KEY_INVALID') ||
    raw.includes('403') ||
    raw.includes('PERMISSION_DENIED')
  ) {
    return {
      status: 403,
      message: 'API Key ไม่ถูกต้องหรือไม่ได้รับอนุญาต กรุณาตรวจสอบคีย์ใน Environment Variables / Settings > Secrets',
      rateLimited: false,
      isDailyLimit: false,
    };
  }
  if (isRetryableQuotaError(err)) {
    const isDailyLimit = lower.includes('perday') || lower.includes('daily') || lower.includes('rpd');
    return {
      status: 429,
      message: isDailyLimit
        ? 'โควตา Gemini API รายวันเต็มชั่วคราว (รีเซ็ตอัตโนมัติเวลา 00:00 น. ตามเวลาแปซิฟิก) ระบบยังคงแสดงข่าว RSS ราคา และกราฟฟรีตามปกติ'
        : 'โควตา Gemini API ต่อนาทีเต็มชั่วคราว กรุณารอคูลดาวน์ 60 วินาทีแล้วลองใหม่อีกครั้ง',
      rateLimited: true,
      isDailyLimit,
    };
  }
  if (raw.includes('ไม่พบข้อมูลหุ้น') || raw.includes('ไม่พบหุ้น')) {
    return { status: 404, message: raw, rateLimited: false, isDailyLimit: false };
  }
  return {
    status: 502,
    message: raw ? `${fallbackThai}: ${raw}` : fallbackThai,
    rateLimited: false,
    isDailyLimit: false,
  };
}

function buildServerPortfolioSig(portfolio: Array<{ symbol: string }>): string {
  return portfolio
    .map((p) => p.symbol.toUpperCase())
    .sort()
    .join(',');
}

function parseValidTimeframe(raw: unknown): ChartTimeframe {
  return raw === '4H' || raw === '1H' ? raw : '1D';
}

export function getHealthPayload() {
  return {
    status: 'ok',
    mode: 'free-public-feeds-plus-batched-gemini',
    model: activeServerModel,
    googleSearchGrounding: false,
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY?.trim()),
  };
}

export interface HandlerResult {
  status: number;
  payload: unknown;
}

/**
 * 1. Global Asset Lookup & Enrichment: Free Yahoo Finance Autocomplete first, optional Gemini enrichment (NO googleSearch)
 */
export async function handleClassifyAsset(
  body: Record<string, unknown>,
  apiKey: string | null
): Promise<HandlerResult> {
  const rawInput =
    typeof body.query === 'string' && body.query.trim()
      ? body.query.trim()
      : typeof body.symbol === 'string'
      ? body.symbol.trim()
      : '';

  const safeQuery = rawInput.slice(0, 100);
  if (!safeQuery) {
    return {
      status: 400,
      payload: { error: 'กรุณาระบุชื่อบริษัทหรือชื่อย่อสินทรัพย์ (Ticker) ที่ต้องการค้นหา' },
    };
  }

  const cacheKey = `classify::${safeQuery.toLowerCase()}`;
  try {
    const { data, fromServerCache } = await withServerCacheAndDedup(
      cacheKey,
      CLASSIFY_CACHE_TTL_MS,
      Boolean(body.force),
      async () => {
        const yahooMatch = await searchYahooFinanceAutocomplete(safeQuery, false);
        const ai = createGeminiClient(apiKey);

        if (yahooMatch) {
          if (ai) {
            try {
              const enrichedRes = await generateJsonWithFallback(
                ai,
                buildClassifyAssetPrompt(safeQuery, yahooMatch)
              );
              const parsed = parseClassifiedAssetResponse(enrichedRes.text ?? '', safeQuery);
              return {
                ...yahooMatch,
                ...parsed,
                symbol: yahooMatch.symbol,
                aiCalled: true,
              };
            } catch {
              return { ...yahooMatch, aiCalled: false };
            }
          }
          return { ...yahooMatch, aiCalled: false };
        }

        if (!ai) {
          throw new Error(
            `ไม่พบข้อมูลหุ้นหรือสินทรัพย์ "${safeQuery}" ใน Yahoo Finance กรุณาลองพิมพ์ตัวย่อภาษาอังกฤษ`
          );
        }

        const response = await generateJsonWithFallback(ai, buildClassifyAssetPrompt(safeQuery));
        return {
          ...parseClassifiedAssetResponse(response.text ?? '', safeQuery),
          aiCalled: true,
        };
      }
    );

    return {
      status: 200,
      payload: {
        ...data,
        aiCalled: fromServerCache ? false : Boolean(data.aiCalled),
      },
    };
  } catch (err) {
    const { status, message, rateLimited, isDailyLimit } = formatServerGeminiError(
      err,
      'ไม่สามารถค้นหาและจำแนกข้อมูลหุ้นจากตลาดทั่วโลกได้'
    );
    return { status, payload: { error: message, rateLimited, isDailyLimit } };
  }
}

/**
 * 2. SINGLE BATCHED SYNC: Server-side Google News RSS + Yahoo Finance Quotes + 1 Gemini JSON Request (NO googleSearch)
 */
export async function handleBatchedSync(
  body: Record<string, unknown>,
  apiKey: string | null
): Promise<HandlerResult> {
  const portfolioEntries = parsePortfolioPayload(body.portfolio);
  const today = parseValidIsoDate(body.todayIso) || getTodayIso();
  const force = Boolean(body.force);
  const cacheKey = `batched::${today}::${buildServerPortfolioSig(portfolioEntries)}`;

  try {
    const { data, fromServerCache } = await withServerCacheAndDedup(
      cacheKey,
      BATCHED_SERVER_CACHE_TTL_MS,
      force,
      async () => {
        const [rssHeadlines, yahooQuotes] = await Promise.all([
          collectLivePublicRssNews(portfolioEntries, false),
          collectLiveYahooQuotes(portfolioEntries, today, false),
        ]);

        const ai = createGeminiClient(apiKey);
        if (!ai) {
          return {
            ...buildPublicOnlyFallbackBatchedResponse(
              portfolioEntries,
              rssHeadlines,
              yahooQuotes,
              today,
              'ยังไม่ได้ตั้งค่า GEMINI_API_KEY — แสดงข่าวสดจาก Google News RSS และราคา/ปันผลจริงจาก Yahoo Finance โดยตรง'
            ),
            aiCalled: false,
            rateLimited: false,
          };
        }

        try {
          const prompt = buildBatchedInvestCalPrompt(
            portfolioEntries,
            rssHeadlines,
            yahooQuotes,
            today
          );
          const response = await generateJsonWithFallback(ai, prompt);
          return {
            ...parseBatchedInvestCalResponse(
              response.text ?? '',
              portfolioEntries,
              rssHeadlines,
              yahooQuotes,
              today
            ),
            aiCalled: true,
            rateLimited: false,
          };
        } catch (geminiErr) {
          const formatted = formatServerGeminiError(
            geminiErr,
            'ไม่สามารถวิเคราะห์เพิ่มเติมด้วย Gemini ได้ชั่วคราว'
          );
          return {
            ...buildPublicOnlyFallbackBatchedResponse(
              portfolioEntries,
              rssHeadlines,
              yahooQuotes,
              today,
              formatted.message
            ),
            aiCalled: false,
            rateLimited: formatted.rateLimited,
          };
        }
      }
    );

    return {
      status: 200,
      payload: {
        ...data,
        aiCalled: fromServerCache ? false : Boolean(data.aiCalled),
      },
    };
  } catch (err) {
    const { status, message, rateLimited, isDailyLimit } = formatServerGeminiError(
      err,
      'ไม่สามารถดึงข้อมูลตลาดสดจาก Google News RSS และ Yahoo Finance ได้'
    );
    return { status, payload: { error: message, rateLimited, isDailyLimit } };
  }
}

/**
 * 3. Historical OHLCV Candles from Yahoo Finance (1D / 4H / 1H — 0% AI Quota, server-side fetch)
 */
export async function handleChartData(body: Record<string, unknown>): Promise<HandlerResult> {
  const rawSymbol =
    typeof body.symbol === 'string'
      ? body.symbol
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9.:/-]/g, '')
          .slice(0, 24)
      : '';

  if (!rawSymbol) {
    return { status: 400, payload: { error: 'กรุณาระบุตัวย่อสินทรัพย์ (Symbol)' } };
  }

  // Strip optional SET: prefix so Yahoo mapper resolves to .BK cleanly
  const isSetPrefix = rawSymbol.startsWith('SET:');
  const cleanSymbol = isSetPrefix ? rawSymbol.slice(4) : rawSymbol;
  const category =
    typeof body.category === 'string' && body.category.trim()
      ? body.category.trim().slice(0, 32)
      : isSetPrefix || cleanSymbol.endsWith('.BK')
      ? 'Thai Stock'
      : 'US Stock';

  const timeframe = parseValidTimeframe(body.timeframe);
  const cacheKey = `chart-data::${cleanSymbol}::${category}::${timeframe}`;

  try {
    const { data } = await withServerCacheAndDedup(
      cacheKey,
      CHART_HISTORY_CACHE_TTL_MS,
      Boolean(body.force),
      () => fetchYahooHistoricalCandles(cleanSymbol, category, timeframe, false)
    );
    return { status: 200, payload: data };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'ไม่สามารถดึงข้อมูลแท่งเทียนย้อนหลังจาก Yahoo Finance ได้';
    return { status: 502, payload: { error: msg } };
  }
}

/**
 * 4. On-Demand AI Concise Buy/Sell Plan from Trend, S/R & Fibonacci (1 Single Request, NO googleSearch)
 */
export async function handleAnalyzeChart(
  body: Record<string, unknown>,
  apiKey: string | null
): Promise<HandlerResult> {
  const symbol =
    typeof body.symbol === 'string'
      ? body.symbol
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9.:/-]/g, '')
          .slice(0, 24)
      : '';
  const latestPrice = Number(body.latestPrice);
  if (!symbol || !Number.isFinite(latestPrice) || latestPrice <= 0) {
    return {
      status: 400,
      payload: { error: 'ข้อมูลราคาล่าสุดไม่ครบถ้วนสำหรับวิเคราะห์เทรนและเป้า Fibonacci' },
    };
  }

  const timeframe = parseValidTimeframe(body.timeframe);
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : symbol;
  const category =
    typeof body.category === 'string' ? body.category.trim().slice(0, 40) : 'US Stock';
  const currency =
    typeof body.currency === 'string' ? body.currency.trim().toUpperCase().slice(0, 10) : 'USD';

  const rawTrend = typeof body.trend === 'string' ? body.trend.trim() : '';
  const trend: ChartTrendDirection =
    rawTrend === 'Uptrend' || rawTrend === 'Downtrend' || rawTrend === 'Sideway'
      ? rawTrend
      : 'Sideway';

  const ema20 =
    typeof body.ema20 === 'number' && Number.isFinite(body.ema20) && body.ema20 > 0
      ? body.ema20
      : null;
  const ema50 =
    typeof body.ema50 === 'number' && Number.isFinite(body.ema50) && body.ema50 > 0
      ? body.ema50
      : null;

  const support1 = Number(body.support1) || latestPrice * 0.97;
  const support2 = Number(body.support2) || latestPrice * 0.93;
  const resistance1 = Number(body.resistance1) || latestPrice * 1.03;
  const resistance2 = Number(body.resistance2) || latestPrice * 1.07;

  const fib382 = Number(body.fib382) || latestPrice * 0.96;
  const fib500 = Number(body.fib500) || latestPrice * 0.94;
  const fib618 = Number(body.fib618) || latestPrice * 0.92;
  const fib1272 = Number(body.fib1272) || latestPrice * 1.08;
  const fib1618 = Number(body.fib1618) || latestPrice * 1.15;

  const averageCost =
    typeof body.averageCost === 'number' &&
    Number.isFinite(body.averageCost) &&
    body.averageCost > 0
      ? body.averageCost
      : undefined;
  const quantity =
    typeof body.quantity === 'number' && Number.isFinite(body.quantity) && body.quantity > 0
      ? body.quantity
      : undefined;

  const costSig = averageCost ? averageCost.toFixed(2) : 'none';
  const cacheKey = `trend-fib-ai::${symbol}::${timeframe}::${costSig}`;

  try {
    const ai = createGeminiClient(apiKey);
    if (!ai) {
      return {
        status: 503,
        payload: {
          error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์ กรุณาตรวจสอบใน Environment Variables / Settings > Secrets',
          rateLimited: false,
        },
      };
    }

    const { data, fromServerCache } = await withServerCacheAndDedup(
      cacheKey,
      CHART_ANALYSIS_CACHE_TTL_MS,
      Boolean(body.force),
      async () => {
        const prompt = buildChartTechnicalPrompt({
          symbol,
          name,
          category,
          currency,
          timeframe,
          latestPrice,
          ema20,
          ema50,
          trend,
          support1,
          support2,
          resistance1,
          resistance2,
          fib382,
          fib500,
          fib618,
          fib1272,
          fib1618,
          averageCost,
          quantity,
        });
        const response = await generateJsonWithFallback(ai, prompt);
        return parseChartTechnicalResponse(response.text ?? '', symbol, timeframe);
      }
    );

    return {
      status: 200,
      payload: {
        ...data,
        aiCalled: fromServerCache ? false : true,
      },
    };
  } catch (err) {
    const { status, message, rateLimited, isDailyLimit } = formatServerGeminiError(
      err,
      'ไม่สามารถสรุปแผนเข้าซื้อ-ขายด้วย AI ได้ในขณะนี้'
    );
    return { status, payload: { error: message, rateLimited, isDailyLimit } };
  }
}
