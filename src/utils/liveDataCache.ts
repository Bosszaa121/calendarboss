import {
  CalendarEvent,
  ChartAiAnalysisResponse,
  ChartTimeframe,
  DividendXDRecord,
  EarningsRecord,
  FearGreedData,
  LiveAssetQuote,
  NewsItem,
  SocialInsightItem,
  SyncSource,
} from '../types';

const BATCHED_CACHE_PREFIX = 'investcal_batched_live_v5_';
const CHART_AI_CACHE_PREFIX = 'investcal_chart_ai_v1_';

/** 6-hour cache TTL to stay 100% within Gemini Free Tier quotas */
export const BATCHED_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** 4-hour cache TTL for On-Demand AI Technical & Elliott Wave Analysis */
export const CHART_AI_CACHE_TTL_MS = 4 * 60 * 60 * 1000;

export interface CachedBatchedBundle {
  portfolioSignature: string;
  calendarEvents: CalendarEvent[];
  newsItems: NewsItem[];
  fearGreed: FearGreedData | null;
  earnings: EarningsRecord[];
  dividends: DividendXDRecord[];
  socialInsights: SocialInsightItem[];
  quotes: Record<string, LiveAssetQuote>;
  sources: SyncSource[];
  syncedAt: string;
  syncedDateIso: string;
  syncedTimeLabel: string;
}

export function getLocalTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildPortfolioSignature(symbols: string[]): string {
  return [...symbols]
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .sort()
    .join(',');
}

export function isCacheFresh(
  syncedAt: string | undefined,
  syncedDateIso: string | undefined,
  maxAgeMs = BATCHED_CACHE_TTL_MS
): boolean {
  if (!syncedAt || !syncedDateIso) return false;
  if (syncedDateIso !== getLocalTodayIso()) return false;
  const parsedMs = Date.parse(syncedAt);
  if (Number.isNaN(parsedMs)) return false;
  return Date.now() - parsedMs < maxAgeMs;
}

export function loadCachedBatchedData(
  accountId: string,
  expectedSignature?: string
): CachedBatchedBundle | null {
  try {
    const raw = window.localStorage.getItem(`${BATCHED_CACHE_PREFIX}${accountId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBatchedBundle;
    if (
      !parsed ||
      !Array.isArray(parsed.calendarEvents) ||
      !Array.isArray(parsed.newsItems) ||
      !Array.isArray(parsed.earnings) ||
      !Array.isArray(parsed.dividends) ||
      !Array.isArray(parsed.socialInsights)
    ) {
      return null;
    }
    if (
      typeof expectedSignature === 'string' &&
      parsed.portfolioSignature !== expectedSignature
    ) {
      return null;
    }
    return {
      ...parsed,
      quotes: parsed.quotes && typeof parsed.quotes === 'object' ? parsed.quotes : {},
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    };
  } catch {
    return null;
  }
}

export function saveCachedBatchedData(accountId: string, bundle: CachedBatchedBundle): void {
  try {
    window.localStorage.setItem(`${BATCHED_CACHE_PREFIX}${accountId}`, JSON.stringify(bundle));
  } catch {
    // Ignore storage quota errors
  }
}

function buildChartAiCacheKey(
  symbol: string,
  timeframe: ChartTimeframe,
  averageCost?: number
): string {
  const costKey =
    typeof averageCost === 'number' && Number.isFinite(averageCost) && averageCost > 0
      ? averageCost.toFixed(2)
      : 'none';
  return `${CHART_AI_CACHE_PREFIX}${symbol.trim().toUpperCase()}_${timeframe}_${costKey}`;
}

export function loadCachedChartAnalysis(
  symbol: string,
  timeframe: ChartTimeframe,
  averageCost?: number
): ChartAiAnalysisResponse | null {
  try {
    const key = buildChartAiCacheKey(symbol, timeframe, averageCost);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChartAiAnalysisResponse;
    if (!parsed || !parsed.analyzedAt) return null;
    const ageMs = Date.now() - Date.parse(parsed.analyzedAt);
    if (Number.isNaN(ageMs) || ageMs >= CHART_AI_CACHE_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return { ...parsed, fromCache: true };
  } catch {
    return null;
  }
}

export function saveCachedChartAnalysis(
  symbol: string,
  timeframe: ChartTimeframe,
  analysis: ChartAiAnalysisResponse,
  averageCost?: number
): void {
  try {
    const key = buildChartAiCacheKey(symbol, timeframe, averageCost);
    window.localStorage.setItem(key, JSON.stringify({ ...analysis, fromCache: false }));
  } catch {
    // Ignore storage quota errors
  }
}
