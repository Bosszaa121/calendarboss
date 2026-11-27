import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { ChartTimeframe, WavePoint } from './src/types.ts';
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
} from './src/utils/geminiParsers.ts';
import {
  collectLivePublicRssNews,
  collectLiveYahooQuotes,
  fetchYahooHistoricalCandles,
  searchYahooFinanceAutocomplete,
} from './src/utils/publicMarketFeeds.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Model health tracking to avoid wasting calls on 404 or cooling-down models
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

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
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
 * Free-Tier-Safe Server-Side Gemini JSON generator (ZERO googleSearch tool -> zero Search Grounding 429s).
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
      message: 'API Key ไม่ถูกต้องหรือไม่ได้รับอนุญาต กรุณาตรวจสอบคีย์ใน Settings > Secrets',
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      mode: 'free-public-feeds-plus-batched-gemini',
      model: activeServerModel,
      googleSearchGrounding: false,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // 1. Global Asset Lookup: Free Yahoo Finance Autocomplete first, optional Gemini enrichment (NO googleSearch)
  app.post('/api/classify-asset', async (req, res) => {
    const rawInput =
      typeof req.body?.query === 'string' && req.body.query.trim()
        ? req.body.query.trim()
        : typeof req.body?.symbol === 'string'
        ? req.body.symbol.trim()
        : '';

    const safeQuery = rawInput.slice(0, 100);
    if (!safeQuery) {
      res
        .status(400)
        .json({ error: 'กรุณาระบุชื่อบริษัทหรือชื่อย่อสินทรัพย์ (Ticker) ที่ต้องการค้นหา' });
      return;
    }

    const cacheKey = `classify::${safeQuery.toLowerCase()}`;
    try {
      const { data, fromServerCache } = await withServerCacheAndDedup(
        cacheKey,
        CLASSIFY_CACHE_TTL_MS,
        Boolean(req.body?.force),
        async () => {
          // Step 1: Query Yahoo Finance Autocomplete for free (0 Gemini quota)
          const yahooMatch = await searchYahooFinanceAutocomplete(safeQuery, false);
          const ai = createGeminiClient();

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
      res.json({
        ...data,
        aiCalled: fromServerCache ? false : Boolean(data.aiCalled),
      });
    } catch (err) {
      const { status, message, rateLimited, isDailyLimit } = formatServerGeminiError(
        err,
        'ไม่สามารถค้นหาและจำแนกข้อมูลหุ้นจากตลาดทั่วโลกได้'
      );
      if (status === 429) {
        console.warn('[/api/classify-asset] rate-limited:', message);
      } else {
        console.error('[/api/classify-asset] error:', message);
      }
      res.status(status).json({ error: message, rateLimited, isDailyLimit });
    }
  });

  // 2. SINGLE BATCHED SYNC: Free Google News RSS + Free Yahoo Finance Quotes + 1 Gemini Request (NO googleSearch)
  app.post('/api/batched-sync', async (req, res) => {
    const portfolioEntries = parsePortfolioPayload(req.body?.portfolio);
    const today = parseValidIsoDate(req.body?.todayIso) || getTodayIso();
    const force = Boolean(req.body?.force);
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

          const ai = createGeminiClient();
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
            console.warn('[/api/batched-sync] Gemini fallback to public feeds:', formatted.message);
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

      res.json({
        ...data,
        aiCalled: fromServerCache ? false : Boolean(data.aiCalled),
      });
    } catch (err) {
      const { status, message, rateLimited, isDailyLimit } = formatServerGeminiError(
        err,
        'ไม่สามารถดึงข้อมูลตลาดสดจาก Google News RSS และ Yahoo Finance ได้'
      );
      console.error('[/api/batched-sync] error:', message);
      res.status(status).json({ error: message, rateLimited, isDailyLimit });
    }
  });

  // 3. Historical OHLCV Candles from Yahoo Finance (1D / 4H / 1H — 0% AI Quota)
  app.post('/api/chart-history', async (req, res) => {
    const rawSymbol =
      typeof req.body?.symbol === 'string' ? req.body.symbol.trim().toUpperCase().slice(0, 24) : '';
    if (!rawSymbol) {
      res.status(400).json({ error: 'กรุณาระบุตัวย่อสินทรัพย์ (Symbol)' });
      return;
    }

    const category =
      typeof req.body?.category === 'string' ? req.body.category.trim().slice(0, 32) : 'US Stock';
    const timeframe = parseValidTimeframe(req.body?.timeframe);
    const cacheKey = `chart-history::${rawSymbol}::${category}::${timeframe}`;

    try {
      const { data } = await withServerCacheAndDedup(
        cacheKey,
        CHART_HISTORY_CACHE_TTL_MS,
        Boolean(req.body?.force),
        () => fetchYahooHistoricalCandles(rawSymbol, category, timeframe, false)
      );
      res.json(data);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'ไม่สามารถดึงข้อมูลแท่งเทียนย้อนหลังจาก Yahoo Finance ได้';
      res.status(502).json({ error: msg });
    }
  });

  // 4. On-Demand AI Technical, Elliott Wave & Entry/TP/SL Analysis (1 Single Request, NO googleSearch)
  app.post('/api/analyze-chart', async (req, res) => {
    const symbol =
      typeof req.body?.symbol === 'string' ? req.body.symbol.trim().toUpperCase().slice(0, 24) : '';
    const latestPrice = Number(req.body?.latestPrice);
    if (!symbol || !Number.isFinite(latestPrice) || latestPrice <= 0) {
      res.status(400).json({ error: 'ข้อมูลราคาล่าสุดไม่ครบถ้วนสำหรับวิเคราะห์กราฟเทคนิค' });
      return;
    }

    const timeframe = parseValidTimeframe(req.body?.timeframe);
    const name =
      typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 120) : symbol;
    const category =
      typeof req.body?.category === 'string' ? req.body.category.trim().slice(0, 40) : 'US Stock';
    const currency =
      typeof req.body?.currency === 'string' ? req.body.currency.trim().toUpperCase().slice(0, 10) : 'USD';
    const support1 = Number(req.body?.support1) || latestPrice * 0.97;
    const support2 = Number(req.body?.support2) || latestPrice * 0.93;
    const resistance1 = Number(req.body?.resistance1) || latestPrice * 1.03;
    const resistance2 = Number(req.body?.resistance2) || latestPrice * 1.07;
    const wavePattern =
      typeof req.body?.wavePattern === 'string' ? req.body.wavePattern.slice(0, 30) : 'insufficient';
    const waveDirection =
      typeof req.body?.waveDirection === 'string' ? req.body.waveDirection.slice(0, 20) : 'sideway';
    const averageCost =
      typeof req.body?.averageCost === 'number' &&
      Number.isFinite(req.body.averageCost) &&
      req.body.averageCost > 0
        ? req.body.averageCost
        : undefined;
    const quantity =
      typeof req.body?.quantity === 'number' &&
      Number.isFinite(req.body.quantity) &&
      req.body.quantity > 0
        ? req.body.quantity
        : undefined;

    const wavePoints: WavePoint[] = Array.isArray(req.body?.wavePoints)
      ? req.body.wavePoints
          .filter(
            (w: unknown): w is Record<string, unknown> =>
              Boolean(w) && typeof w === 'object' && typeof (w as Record<string, unknown>).price === 'number'
          )
          .slice(0, 8)
          .map((w: Record<string, unknown>) => ({
            candleIndex: Number(w.candleIndex) || 0,
            timestamp: Number(w.timestamp) || 0,
            price: Number(w.price),
            type: w.type === 'high' ? 'high' : 'low',
            label: typeof w.label === 'string' ? w.label.slice(0, 8) : '',
          }))
      : [];

    const costSig = averageCost ? averageCost.toFixed(2) : 'none';
    const cacheKey = `chart-ai::${symbol}::${timeframe}::${costSig}`;

    try {
      const ai = createGeminiClient();
      if (!ai) {
        res.status(503).json({
          error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์ กรุณาตรวจสอบใน Settings > Secrets',
          rateLimited: false,
        });
        return;
      }

      const { data, fromServerCache } = await withServerCacheAndDedup(
        cacheKey,
        CHART_ANALYSIS_CACHE_TTL_MS,
        Boolean(req.body?.force),
        async () => {
          const prompt = buildChartTechnicalPrompt({
            symbol,
            name,
            category,
            currency,
            timeframe,
            latestPrice,
            support1,
            support2,
            resistance1,
            resistance2,
            wavePattern,
            waveDirection,
            wavePoints,
            averageCost,
            quantity,
          });
          const response = await generateJsonWithFallback(ai, prompt);
          return parseChartTechnicalResponse(response.text ?? '', symbol, timeframe);
        }
      );

      res.json({
        ...data,
        aiCalled: fromServerCache ? false : true,
      });
    } catch (err) {
      const { status, message, rateLimited, isDailyLimit } = formatServerGeminiError(
        err,
        'ไม่สามารถวิเคราะห์กราฟเทคนิคและคลื่น Elliott Wave ด้วย AI ได้'
      );
      if (status === 429) {
        console.warn('[/api/analyze-chart] rate-limited:', message);
      } else {
        console.error('[/api/analyze-chart] error:', message);
      }
      res.status(status).json({ error: message, rateLimited, isDailyLimit });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `InvestCal server running on http://0.0.0.0:${PORT} (${activeServerModel}, Free RSS + Yahoo OHLCV + Batched/On-Demand Gemini)`
    );
  });
}

startServer();
