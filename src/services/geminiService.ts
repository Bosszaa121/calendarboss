import {
  BatchedSyncResponse,
  ChartAiAnalysisResponse,
  ChartHistoryResponse,
  ChartTimeframe,
  PortfolioAsset,
  WavePoint,
} from '../types';
import {
  ClassifiedAssetResult,
  PortfolioEntryInput,
  getTodayIso,
} from '../utils/geminiParsers';
import {
  loadCachedChartAnalysis,
  saveCachedChartAnalysis,
} from '../utils/liveDataCache';
import {
  markServedFromCache,
  recordGeminiApiCall,
  recordRateLimitHit,
} from '../utils/quotaTracker';

export type { ClassifiedAssetResult };

interface ServerErrorPayload {
  error?: string;
  rateLimited?: boolean;
  isDailyLimit?: boolean;
}

async function postServerJson<T>(
  endpoint: string,
  body: Record<string, unknown>,
  fallbackError: string
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new Error(
      networkErr instanceof Error
        ? `ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้: ${networkErr.message}`
        : 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง'
    );
  }

  let payload: (T & ServerErrorPayload) | null = null;
  try {
    payload = (await res.json()) as T & ServerErrorPayload;
  } catch {
    throw new Error(`${fallbackError} (HTTP ${res.status})`);
  }

  if (res.status === 429 || payload?.rateLimited) {
    recordRateLimitHit(Boolean(payload?.isDailyLimit));
  }

  if (!res.ok) {
    throw new Error(payload?.error || `${fallbackError} (HTTP ${res.status})`);
  }

  return payload as T;
}

function serializePortfolioForApi(portfolio: PortfolioAsset[]): PortfolioEntryInput[] {
  return portfolio.map((p) => ({
    symbol: p.symbol,
    name: p.name,
    category: p.category,
    flag: p.flag,
    sector: p.sector,
    topHoldings: p.topHoldings,
    hasDividends: p.hasDividends,
    hasEarnings: p.hasEarnings,
  }));
}

/**
 * Global Stock / ETF Search & Classification via server-side API route.
 * Records real Gemini call ONLY when server confirms aiCalled === true.
 */
export async function classifyAssetLive(rawQuery: string): Promise<ClassifiedAssetResult> {
  const safeQuery = rawQuery.trim().slice(0, 100);
  if (!safeQuery) {
    throw new Error('กรุณาระบุชื่อบริษัทหรือชื่อย่อสินทรัพย์ (Ticker) ที่ต้องการค้นหา');
  }

  const result = await postServerJson<ClassifiedAssetResult & { aiCalled?: boolean }>(
    '/api/classify-asset',
    { query: safeQuery, symbol: safeQuery },
    'ไม่สามารถค้นหาและจำแนกข้อมูลหุ้นจากตลาดทั่วโลกได้'
  );

  if (result.aiCalled) {
    recordGeminiApiCall();
  }
  return result;
}

/**
 * Single batched live sync (Calendar, Global News, Fear & Greed, Earnings/XD,
 * Social Insights, and Yahoo Finance live quotes) via server-side API route.
 */
export async function syncBatchedInvestCalLive(
  portfolio: PortfolioAsset[],
  options?: { force?: boolean }
): Promise<BatchedSyncResponse> {
  const todayIso = getTodayIso();
  const serialized = serializePortfolioForApi(portfolio);

  const result = await postServerJson<BatchedSyncResponse>(
    '/api/batched-sync',
    {
      portfolio: serialized,
      todayIso,
      force: Boolean(options?.force),
    },
    'ไม่สามารถอัปเดตข้อมูลตลาดสดได้ในขณะนี้'
  );

  if (result.rateLimited) {
    recordRateLimitHit(false);
  } else if (result.aiCalled) {
    recordGeminiApiCall();
  } else {
    markServedFromCache();
  }

  return result;
}

/**
 * Free Historical OHLCV Candles (1D / 4H / 1H) from Yahoo Finance via server.
 * Uses 0% AI quota — never increments API Quota Gauge!
 */
export async function fetchChartHistoryLive(
  symbol: string,
  category: string,
  timeframe: ChartTimeframe
): Promise<ChartHistoryResponse> {
  return postServerJson<ChartHistoryResponse>(
    '/api/chart-data',
    { symbol, category, timeframe },
    'ไม่สามารถดึงข้อมูลกราฟราคาย้อนหลังได้ในขณะนี้'
  );
}

export interface AnalyzeChartRequestInput {
  symbol: string;
  name: string;
  category: string;
  currency: string;
  timeframe: ChartTimeframe;
  latestPrice: number;
  support1: number;
  support2: number;
  resistance1: number;
  resistance2: number;
  wavePattern: string;
  waveDirection: string;
  wavePoints: WavePoint[];
  averageCost?: number;
  quantity?: number;
}

/**
 * On-Demand AI Technical & Elliott Wave Analysis (4-hour LocalStorage cache).
 * Only fires when the user explicitly clicks the Analyze button!
 */
export async function analyzeChartTechnicalLive(
  input: AnalyzeChartRequestInput,
  options?: { force?: boolean }
): Promise<ChartAiAnalysisResponse> {
  if (!options?.force) {
    const cached = loadCachedChartAnalysis(input.symbol, input.timeframe, input.averageCost);
    if (cached) {
      markServedFromCache();
      return cached;
    }
  }

  const result = await postServerJson<ChartAiAnalysisResponse>(
    '/api/analyze-chart',
    {
      ...input,
      force: Boolean(options?.force),
    },
    'ไม่สามารถวิเคราะห์กราฟเทคนิคและคลื่น Elliott Wave ด้วย AI ได้ในขณะนี้'
  );

  if (result.aiCalled) {
    recordGeminiApiCall();
  } else {
    markServedFromCache();
  }

  saveCachedChartAnalysis(input.symbol, input.timeframe, result, input.averageCost);
  return result;
}
