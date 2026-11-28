import type {
  AssetCategory,
  AssetDirection,
  AssetDirectionForecast,
  BatchedSyncResponse,
  CalendarEvent,
  ChartAiAnalysisResponse,
  ChartTimeframe,
  ChartTrendDirection,
  DividendXDRecord,
  EarningsRecord,
  EarningsStatus,
  FearGreedData,
  ImpactSeverity,
  LiveAssetQuote,
  MacroImpactItem,
  NewsItem,
  PortfolioImpactDetail,
  SocialInsightItem,
  SocialPlatform,
  SocialSentiment,
  SyncSource,
} from '../types.ts';
import type { PublicRssHeadline } from './publicMarketFeeds.ts';
import { getRegionGroupForCode, resolveCountryCurrencyMeta } from './economicDictionary.ts';
import {
  ensureThaiClockSuffix,
  formatThaiNewsTimestamp,
  getBangkokTodayIso,
  parseBangkokEventTimestampMs,
} from './thaiTime.ts';

export const GEMINI_MODEL = 'gemini-3.8-flash';
export const GEMINI_MODEL_CHAIN = [
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-4-hydrogen',
] as const;

export function isModelNotFoundError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err || '');
  return (
    raw.includes('NOT_FOUND') ||
    raw.includes('no longer available') ||
    (raw.includes('404') && raw.includes('models/'))
  );
}

export function isRetryableQuotaError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err || '');
  const lower = raw.toLowerCase();
  return (
    raw.includes('429') ||
    raw.includes('RESOURCE_EXHAUSTED') ||
    raw.includes('503') ||
    raw.includes('UNAVAILABLE') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('overloaded')
  );
}

export interface ClassifiedAssetResult {
  symbol: string;
  name: string;
  category: AssetCategory;
  market: string;
  flag: string;
  currency: string;
  sector: string;
  themes: string[];
  topHoldings?: string[];
  hasDividends?: boolean;
  hasEarnings?: boolean;
}

export interface PortfolioEntryInput {
  symbol: string;
  name: string;
  category: string;
  flag: string;
  sector: string;
  topHoldings?: string[];
  hasDividends?: boolean;
  hasEarnings?: boolean;
}

const VALID_CATEGORIES = new Set<AssetCategory>([
  'US ETF',
  'Thai Stock',
  'US Stock',
  'Crypto',
  'Commodity',
  'Forex',
]);

export const NON_DIVIDEND_SYMBOLS = new Set([
  'GLD',
  'SLV',
  'IAU',
  'IBIT',
  'FBTC',
  'ETHA',
  'BTC',
  'BTC-USD',
  'ETH',
  'ETH-USD',
  'SOL',
  'XRP',
  'BNB',
  'ADA',
  'DOGE',
  'AVAX',
  'LINK',
  'SUI',
  'XAUUSD',
  'XAU/USD',
  'XAGUSD',
  'XAG/USD',
  'WTI',
  'BRENT',
  'NATGAS',
  'COPPER',
  'USD/THB',
  'EUR/USD',
  'USD/JPY',
  'GBP/USD',
  'AUD/USD',
  'DXY',
]);

export const BOND_NO_EARNINGS_SYMBOLS = new Set([
  'SGOV',
  'JPST',
  'TLT',
  'SHY',
  'BIL',
  'BND',
  'AGG',
  'IEF',
]);

export function getTodayIso(): string {
  return getBangkokTodayIso();
}

export function addDaysFromIso(baseIso: string, days: number): string {
  const [y, m, d] = baseIso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1, d + days));
  const year = target.getUTCFullYear();
  const month = String(target.getUTCMonth() + 1).padStart(2, '0');
  const day = String(target.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseValidIsoDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  if (
    dateObj.getUTCFullYear() !== year ||
    dateObj.getUTCMonth() !== month - 1 ||
    dateObj.getUTCDate() !== day
  ) {
    return null;
  }
  return trimmed;
}

export function computeCalendarDayDiff(
  targetIso: string | null,
  baseTodayIso: string
): number | null {
  if (!targetIso) return null;
  const validTarget = parseValidIsoDate(targetIso);
  const validBase = parseValidIsoDate(baseTodayIso);
  if (!validTarget || !validBase) return null;
  const [ty, tm, td] = validTarget.split('-').map(Number);
  const [by, bm, bd] = validBase.split('-').map(Number);
  const targetUtc = Date.UTC(ty, tm - 1, td);
  const baseUtc = Date.UTC(by, bm - 1, bd);
  return Math.round((targetUtc - baseUtc) / 86_400_000);
}

export function getThaiFullDateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function getFearGreedLabelTh(value: number): string {
  if (value <= 24) return 'กลัวสุดขีด (Extreme Fear)';
  if (value <= 44) return 'กลัว (Fear)';
  if (value <= 55) return 'เป็นกลาง (Neutral)';
  if (value <= 74) return 'โลภ (Greed)';
  return 'โลภสุดขีด (Extreme Greed)';
}

function stripMarkdownAndComments(rawText: string): string {
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let body = fenced && fenced[1] ? fenced[1].trim() : rawText.trim();
  // Strip any leading/trailing fence markers if unclosed
  body = body.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  // Remove trailing commas before closing ] or }
  return body.replace(/,\s*([}\]])/g, '$1');
}

/**
 * Repairs a truncated JSON fragment by finding the last balanced object/value boundary,
 * trimming the incomplete tail, and auto-closing any remaining open `[` or `{` brackets.
 */
function repairTruncatedJson(fragment: string): string {
  let inString = false;
  let escaped = false;
  const stack: string[] = [];
  let lastValidEnd = -1;

  for (let i = 0; i < fragment.length; i++) {
    const ch = fragment[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{' || ch === '[') {
      stack.push(ch);
    } else if (ch === '}' || ch === ']') {
      const expected = ch === '}' ? '{' : '[';
      if (stack.length > 0 && stack[stack.length - 1] === expected) {
        stack.pop();
        // Record every cleanly closed object/array boundary
        if (stack.length <= 2) {
          lastValidEnd = i;
        }
      }
    }
  }

  let candidate = fragment;
  if (inString || stack.length > 0) {
    if (lastValidEnd > 0) {
      candidate = fragment.slice(0, lastValidEnd + 1);
    } else {
      // Fall back to last complete comma-separated entry
      const lastBrace = Math.max(fragment.lastIndexOf('}'), fragment.lastIndexOf(']'));
      if (lastBrace > 0) {
        candidate = fragment.slice(0, lastBrace + 1);
      }
    }
  }

  // Recompute remaining open stack on trimmed candidate and auto-close cleanly
  const openStack: string[] = [];
  inString = false;
  escaped = false;
  for (let i = 0; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') openStack.push(ch);
    else if (ch === '}' || ch === ']') {
      const expected = ch === '}' ? '{' : '[';
      if (openStack.length > 0 && openStack[openStack.length - 1] === expected) {
        openStack.pop();
      }
    }
  }

  let repaired = candidate.replace(/,\s*$/, '').replace(/,\s*([}\]])/g, '$1');
  while (openStack.length > 0) {
    const opener = openStack.pop();
    repaired += opener === '[' ? ']' : '}';
  }
  return repaired.replace(/,\s*([}\]])/g, '$1');
}

/**
 * Resilient JSON Array parser: strips ```json fences, removes trailing commas,
 * and if the array was truncated mid-response, drops the incomplete tail item and
 * auto-closes `]` so all completed items are recovered with ZERO UI JSON errors.
 */
export function safeParseJsonArray<T = Record<string, unknown>>(rawText: string): T[] {
  if (!rawText || typeof rawText !== 'string') return [];
  const cleaned = stripMarkdownAndComments(rawText);
  const startIdx = cleaned.indexOf('[');
  if (startIdx === -1) return [];

  const slice = cleaned.slice(startIdx);
  // Attempt 1: direct parse up to last ']'
  const lastBracket = slice.lastIndexOf(']');
  if (lastBracket > 0) {
    try {
      const direct = JSON.parse(slice.slice(0, lastBracket + 1).replace(/,\s*([}\]])/g, '$1'));
      if (Array.isArray(direct)) return direct as T[];
    } catch {
      // Fall through to truncation recovery
    }
  }

  // Attempt 2: truncate incomplete tail and auto-close `]`
  let cursor = slice.length;
  for (let attempt = 0; attempt < 6 && cursor > 1; attempt++) {
    const sub = slice.slice(0, cursor);
    const repaired = repairTruncatedJson(sub);
    try {
      const parsed = JSON.parse(repaired);
      if (Array.isArray(parsed)) return parsed as T[];
    } catch {
      // Step back to previous closing brace `}` and try again
      const prevBrace = sub.lastIndexOf('}', cursor - 2);
      if (prevBrace <= 0) break;
      cursor = prevBrace + 1;
    }
  }

  return [];
}

/**
 * Resilient JSON Object parser: recovers top-level object even if Gemini output was truncated
 * mid-array, extracting individual completed arrays via safeParseJsonArray as last resort.
 */
export function safeParseJsonObject(rawText: string): Record<string, unknown> {
  if (!rawText || typeof rawText !== 'string') return {};
  const cleaned = stripMarkdownAndComments(rawText);
  const startIdx = cleaned.indexOf('{');
  if (startIdx === -1) return {};

  const slice = cleaned.slice(startIdx);
  const lastBrace = slice.lastIndexOf('}');
  if (lastBrace > 0) {
    try {
      const direct = JSON.parse(slice.slice(0, lastBrace + 1).replace(/,\s*([}\]])/g, '$1'));
      if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
        return direct as Record<string, unknown>;
      }
    } catch {
      // Proceed to truncation repair
    }
  }

  // Attempt 2: repair truncated JSON object cleanly
  try {
    const repaired = repairTruncatedJson(slice);
    const parsed = JSON.parse(repaired);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Attempt 3: salvage each top-level array independently via safeParseJsonArray
  }

  const salvaged: Record<string, unknown> = {};
  const arrayKeys = [
    'calendarEnrichments',
    'calendarEvents',
    'newsItems',
    'earnings',
    'dividends',
    'socialInsights',
  ];

  for (const key of arrayKeys) {
    const keyRegex = new RegExp(`"${key}"\\s*:\\s*\\[`);
    const match = keyRegex.exec(slice);
    if (!match) continue;
    const arrStart = match.index + match[0].length - 1;
    // Slice up to next top-level key or end of string
    const rest = slice.slice(arrStart);
    const nextKeyMatch = /\n\s*"[a-zA-Z0-9_]+"\s*:/.exec(rest.slice(1));
    const arrWindow = nextKeyMatch ? rest.slice(0, nextKeyMatch.index + 1) : rest;
    const recovered = safeParseJsonArray(arrWindow);
    if (recovered.length > 0) {
      salvaged[key] = recovered;
    }
  }

  // Also attempt to salvage fearGreed object if intact
  const fgMatch = /"fearGreed"\s*:\s*(\{[\s\S]*?\})/.exec(slice);
  if (fgMatch && fgMatch[1]) {
    try {
      salvaged.fearGreed = JSON.parse(fgMatch[1].replace(/,\s*([}\]])/g, '$1'));
    } catch {
      // ignore
    }
  }

  return salvaged;
}

export function extractJsonBlock(rawText: string): string {
  const cleaned = stripMarkdownAndComments(rawText);
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1).replace(/,\s*([}\]])/g, '$1');
  }
  return repairTruncatedJson(cleaned);
}

export function parsePortfolioPayload(rawPortfolio: unknown): PortfolioEntryInput[] {
  if (!Array.isArray(rawPortfolio)) return [];
  return rawPortfolio
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).symbol === 'string'
    )
    .slice(0, 25)
    .map((item) => ({
      symbol: String(item.symbol).trim().toUpperCase(),
      name: typeof item.name === 'string' ? item.name.slice(0, 120) : String(item.symbol),
      category: typeof item.category === 'string' ? item.category : 'US Stock',
      flag: typeof item.flag === 'string' && item.flag.trim() ? item.flag.slice(0, 12) : '🌐',
      sector: typeof item.sector === 'string' ? item.sector.slice(0, 100) : '',
      topHoldings: Array.isArray(item.topHoldings)
        ? item.topHoldings.filter((h): h is string => typeof h === 'string').slice(0, 6)
        : undefined,
      hasDividends: typeof item.hasDividends === 'boolean' ? item.hasDividends : undefined,
      hasEarnings: typeof item.hasEarnings === 'boolean' ? item.hasEarnings : undefined,
    }));
}

function isSectorMismatch(
  asset: PortfolioEntryInput | undefined,
  reasonTh: string
): boolean {
  if (!asset) return false;
  const reasonLower = reasonTh.toLowerCase();
  const sectorLower = (asset.sector || '').toLowerCase();
  const isTechOrChipAsset =
    sectorLower.includes('chip') ||
    sectorLower.includes('semi') ||
    sectorLower.includes('tech') ||
    sectorLower.includes('ชิป') ||
    sectorLower.includes('เทค') ||
    asset.symbol === 'QQQM' ||
    asset.symbol === 'SMH' ||
    asset.symbol === 'NVDA';

  // Prevent hallucinating US chip/AI reasons onto non-tech Thai food/bank/consumer stocks (e.g. KCG)
  if (
    !isTechOrChipAsset &&
    asset.category === 'Thai Stock' &&
    (reasonLower.includes('หุ้นชิป') ||
      reasonLower.includes('เซมิคอนดักเตอร์') ||
      reasonLower.includes('semiconductor') ||
      reasonLower.includes('ai สหรัฐ'))
  ) {
    return true;
  }
  return false;
}

function sanitizeAiImpacts(
  rawImpacts: unknown,
  portfolioEntries: PortfolioEntryInput[] = []
): PortfolioImpactDetail[] {
  if (!Array.isArray(rawImpacts)) return [];
  const portfolioByUpper = new Map(portfolioEntries.map((p) => [p.symbol.toUpperCase(), p]));
  return rawImpacts
    .filter(
      (x): x is Record<string, unknown> =>
        Boolean(x) &&
        typeof x === 'object' &&
        typeof (x as Record<string, unknown>).symbol === 'string'
    )
    .map((x) => {
      const symbol = String(x.symbol).trim().toUpperCase();
      const direction: AssetDirection =
        x.direction === 'bullish' || x.direction === 'bearish' ? x.direction : 'neutral';
      const severity: ImpactSeverity =
        x.severity === 'high' ? 'high' : x.severity === 'low' ? 'low' : 'medium';
      const reasonTh = typeof x.reasonTh === 'string' ? x.reasonTh.trim().slice(0, 120) : '';
      return {
        symbol,
        relation: x.relation === 'indirect' ? ('indirect' as const) : ('direct' as const),
        severity,
        direction,
        reasonTh,
      };
    })
    .filter((x) => {
      if (!x.reasonTh) return false;
      const asset = portfolioByUpper.get(x.symbol);
      if (portfolioByUpper.size > 0 && !asset) return false;
      return !isSectorMismatch(asset, x.reasonTh);
    })
    .slice(0, 4);
}

function sanitizeMacroImpacts(rawMacro: unknown): MacroImpactItem[] {
  if (!Array.isArray(rawMacro)) return [];
  return rawMacro
    .filter(
      (x): x is Record<string, unknown> =>
        Boolean(x) &&
        typeof x === 'object' &&
        typeof (x as Record<string, unknown>).asset === 'string'
    )
    .map((x) => {
      const direction: AssetDirection =
        x.direction === 'bullish' || x.direction === 'bearish' ? x.direction : 'neutral';
      return {
        asset: String(x.asset).trim().slice(0, 24),
        direction,
        noteTh: typeof x.noteTh === 'string' ? x.noteTh.trim().slice(0, 96) : '',
      };
    })
    .filter((x) => x.asset.length > 0 && x.noteTh.length > 0)
    .slice(0, 6);
}

function sanitizeForecasts(rawForecasts: unknown): AssetDirectionForecast[] {
  if (!Array.isArray(rawForecasts)) return [];
  return rawForecasts
    .filter(
      (x): x is Record<string, unknown> =>
        Boolean(x) &&
        typeof x === 'object' &&
        typeof (x as Record<string, unknown>).symbol === 'string'
    )
    .map((x) => {
      const direction: AssetDirection =
        x.direction === 'bullish' || x.direction === 'bearish' ? x.direction : 'neutral';
      return {
        symbol: String(x.symbol).trim().toUpperCase(),
        direction,
        reasonTh: typeof x.reasonTh === 'string' ? x.reasonTh.trim().slice(0, 140) : '',
        scenarioNoteTh:
          typeof x.scenarioNoteTh === 'string' && x.scenarioNoteTh.trim()
            ? x.scenarioNoteTh.trim().slice(0, 120)
            : undefined,
      };
    })
    .filter((x) => x.symbol.length > 0 && x.reasonTh.length > 0)
    .slice(0, 4);
}

// ============================================================================
// 1. Global Asset Lookup & Enrichment (NO googleSearch tool — Free Tier Safe)
// ============================================================================

export function buildClassifyAssetPrompt(
  rawQuery: string,
  yahooMatch?: ClassifiedAssetResult | null
): string {
  const safeQuery = rawQuery.trim().slice(0, 100);
  const yahooHint = yahooMatch
    ? `\nข้อมูลตั้งต้นที่ค้นพบจาก Yahoo Finance Autocomplete:\n${JSON.stringify(yahooMatch)}\nให้ใช้ตัวย่อ (symbol) และชื่อบริษัทจากข้อมูลนี้เป็นหลัก แล้วช่วยแปลกลุ่มอุตสาหกรรม (sector) เป็นภาษาไทยพร้อมอังกฤษสั้นๆ และเติม themes / topHoldings / flag ให้ครบถ้วน`
    : '';

  return `แปลงคำค้นหาชื่อบริษัทหรือตัวย่อหลักทรัพย์ "${safeQuery}" ให้เป็นข้อมูลทางการเงินมาตรฐานของตลาดหลักทรัพย์ทั่วโลก${yahooHint}

กฎการจำแนก:
1. ระบุตัวย่อทางการ (symbol) เช่น "pepsico" -> "PEP", "coca cola" -> "KO", "nintendo" -> "7974.T", "ferrari" -> "RACE", "บมจ. เคซีจี" -> "KCG"
2. เลือก category จาก 6 ค่านี้เท่านั้น: "US ETF" | "Thai Stock" | "US Stock" | "Crypto" | "Commodity" | "Forex"
   - หุ้นไทย SET/mai (ตัด .BK ออก): category = "Thai Stock", market = "SET" หรือ "mai", flag = "🇹🇭", currency = "THB", hasDividends = true, hasEarnings = true
   - ETF หุ้นสหรัฐฯ: category = "US ETF", topHoldings 3-4 หุ้นหลัก, hasDividends = true, hasEarnings = true
   - ETF ทอง/เงิน/คริปโต หรือ Crypto/Commodity/Forex: hasDividends = false, hasEarnings = false
   - ETF พันธบัตร (SGOV, JPST, TLT): hasDividends = true, hasEarnings = false
3. เลือก themes สูงสุด 5 แท็กจาก: us_equity, us_broad, us_tech, semiconductor, ai_chips, us_dividend, us_rates_sensitive, us_treasury_short, us_treasury_long, crypto_equity, crypto_spot, bitcoin, gold, silver, precious_metals, dxy_sensitive, thai_equity, thai_food, dairy_import, thai_bank, thai_energy, thai_consumer, thai_tourism, thai_healthcare, thai_dividend, thai_rates_sensitive, usd_thb_sensitive, china_demand, oil_commodity, global_equity, japan_equity, jpy_sensitive, eu_macro_sensitive, uk_macro_sensitive
4. หากไม่รู้จักหรือไม่ใช่หลักทรัพย์จริง ให้ตอบ {"found": false, "errorTh": "ไม่พบหุ้นหรือสินทรัพย์นี้ในตลาดหลักทรัพย์ทั่วโลก กรุณาตรวจสอบชื่อหรือตัวย่ออีกครั้ง"}

ตอบเป็น JSON เท่านั้น:
{
  "found": true,
  "symbol": "<Ticker ทางการ>",
  "name": "<ชื่อบริษัท/กองทุนเต็ม>",
  "category": "<US ETF | Thai Stock | US Stock | Crypto | Commodity | Forex>",
  "market": "<NASDAQ | NYSE | NYSE Arca | SET | mai | TSE | HKEX | LSE | Crypto | ...>",
  "flag": "<อีโมจิธงชาติ>",
  "currency": "<USD | THB | JPY | EUR | HKD | GBP | ...>",
  "sector": "<กลุ่มอุตสาหกรรมภาษาไทยพร้อมอังกฤษสั้นๆ>",
  "themes": ["<แท็ก>"],
  "topHoldings": ["<เฉพาะ Equity ETF มิฉะนั้น []>"],
  "hasDividends": true,
  "hasEarnings": true
}`;
}

export function parseClassifiedAssetResponse(
  rawText: string,
  rawQuery: string
): ClassifiedAssetResult {
  const parsed = JSON.parse(extractJsonBlock(rawText || '{}')) as Record<string, unknown>;

  if (parsed.found === false) {
    const errText =
      typeof parsed.errorTh === 'string' && parsed.errorTh.trim()
        ? parsed.errorTh.trim()
        : `ไม่พบข้อมูลหุ้นหรือสินทรัพย์ "${rawQuery.trim()}" จากตลาดทั่วโลก`;
    throw new Error(errText);
  }

  const category: AssetCategory =
    typeof parsed.category === 'string' && VALID_CATEGORIES.has(parsed.category as AssetCategory)
      ? (parsed.category as AssetCategory)
      : 'US Stock';

  const fallbackSymbol = rawQuery
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9./-]/g, '')
    .slice(0, 20);

  let resolvedSymbol =
    typeof parsed.symbol === 'string' && parsed.symbol.trim()
      ? parsed.symbol
          .trim()
          .toUpperCase()
          .replace(/\s+/g, '')
          .replace(/[^A-Z0-9./-]/g, '')
          .slice(0, 20)
      : fallbackSymbol;

  if (category === 'Thai Stock' && resolvedSymbol.endsWith('.BK')) {
    resolvedSymbol = resolvedSymbol.replace(/\.BK$/, '');
  }

  if (!resolvedSymbol) {
    throw new Error(`ไม่สามารถระบุตัวย่อทางการสำหรับ "${rawQuery.trim()}" ได้`);
  }

  const topHoldings = Array.isArray(parsed.topHoldings)
    ? parsed.topHoldings
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .map((t) => t.trim().toUpperCase().slice(0, 15))
        .slice(0, 5)
    : undefined;

  return {
    symbol: resolvedSymbol,
    name:
      typeof parsed.name === 'string' && parsed.name.trim()
        ? parsed.name.trim().slice(0, 140)
        : resolvedSymbol,
    category,
    market:
      typeof parsed.market === 'string' && parsed.market.trim()
        ? parsed.market.trim().slice(0, 40)
        : category === 'Thai Stock'
        ? 'SET'
        : 'Global',
    flag:
      typeof parsed.flag === 'string' && parsed.flag.trim()
        ? parsed.flag.trim().slice(0, 12)
        : category === 'Thai Stock'
        ? '🇹🇭'
        : category === 'US ETF' || category === 'US Stock'
        ? '🇺🇸'
        : '🌐',
    currency:
      typeof parsed.currency === 'string' && parsed.currency.trim()
        ? parsed.currency.trim().toUpperCase().slice(0, 12)
        : category === 'Thai Stock'
        ? 'THB'
        : 'USD',
    sector:
      typeof parsed.sector === 'string' && parsed.sector.trim()
        ? parsed.sector.trim().slice(0, 100)
        : 'ทั่วไป (General)',
    themes: Array.isArray(parsed.themes)
      ? parsed.themes
          .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
          .map((t) => t.trim().slice(0, 40))
          .slice(0, 6)
      : category === 'Thai Stock'
      ? ['thai_equity']
      : ['us_equity', 'us_rates_sensitive'],
    topHoldings: topHoldings && topHoldings.length > 0 ? topHoldings : undefined,
    hasDividends: typeof parsed.hasDividends === 'boolean' ? parsed.hasDividends : undefined,
    hasEarnings: typeof parsed.hasEarnings === 'boolean' ? parsed.hasEarnings : undefined,
  };
}

// ============================================================================
// 2. SINGLE BATCHED REQUEST (Bounded <= 20 Priority Items: 12 Calendar + 8 News)
// ============================================================================

/**
 * Selects strictly at most 12 High/Medium priority calendar events from yesterday (-1d)
 * through next 7 days (+7d) so total AI input never exceeds 20 items (12 cal + 8 news).
 * All remaining events across 54 countries display immediately via Zero-AI Thai dictionary.
 */
function selectPriorityCalendarForAi(
  realCalendarEvents: CalendarEvent[],
  today: string,
  maxItems = 12
): CalendarEvent[] {
  const windowEvents = realCalendarEvents.filter((ev) => {
    const diff = computeCalendarDayDiff(ev.date, today);
    if (diff === null || diff < -1 || diff > 7) return false;
    return ev.impact >= 2 || ev.eventKind === 'meeting' || ev.eventKind === 'election';
  });

  const pool = windowEvents.length > 0 ? windowEvents : realCalendarEvents;
  const scored = pool.map((ev) => {
    const diff = computeCalendarDayDiff(ev.date, today) ?? 99;
    const isTodayOrTomorrow = diff >= 0 && diff <= 1 ? 16 : diff >= -1 && diff <= 7 ? 8 : 0;
    const isMajorCcy =
      ev.currency === 'USD' ||
      ev.currency === 'THB' ||
      ev.currency === 'CNY' ||
      ev.currency === 'JPY' ||
      ev.currency === 'KRW' ||
      ev.currency === 'EUR' ||
      ev.currency === 'GBP'
        ? 5
        : 0;
    const score = ev.impact * 22 + isTodayOrTomorrow + isMajorCcy - Math.abs(diff);
    return { ev, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems)
    .map((x) => x.ev);
}

/**
 * Picks up to 8 newest RSS headlines balanced across all 5 regional/asset feeds.
 */
function selectPriorityRssIndicesForAi(
  rssHeadlines: PublicRssHeadline[],
  maxItems = 8
): number[] {
  const picked: number[] = [];
  const used = new Set<number>();
  const priorityHints = ['us_wallstreet', 'asia', 'europe_global', 'commodities', 'crypto'];

  // First pass: ensure at least 1 newest article from each of the 5 feeds
  for (const hint of priorityHints) {
    const idx = rssHeadlines.findIndex((r, i) => !used.has(i) && r.channelHint === hint);
    if (idx !== -1 && picked.length < maxItems) {
      used.add(idx);
      picked.push(idx);
    }
  }

  // Fill remaining slots with strictly newest headlines overall
  for (let i = 0; i < rssHeadlines.length && picked.length < maxItems; i++) {
    if (!used.has(i)) {
      used.add(i);
      picked.push(i);
    }
  }

  return picked.sort((a, b) => a - b);
}

export function buildBatchedInvestCalPrompt(
  portfolioEntries: PortfolioEntryInput[],
  rssHeadlines: PublicRssHeadline[],
  yahooQuotes: Record<string, LiveAssetQuote>,
  today: string,
  realCalendarEvents: CalendarEvent[] = []
): string {
  const todayThai = getThaiFullDateLabel(today);
  const yesterday = addDaysFromIso(today, -1);
  const endDate = addDaysFromIso(today, 7);

  const portfolioBlock =
    portfolioEntries.length > 0
      ? portfolioEntries
          .map((p) => {
            const q = yahooQuotes[p.symbol];
            const quoteInfo = q
              ? ` | Price=${q.price ?? '—'} ${q.currency}, Yield=${q.dividendYield ?? '—'}, lastXD=${
                  q.lastPaidXdDate ?? '—'
                }, upcomingXD=${q.upcomingXdDate ?? 'none'}`
              : '';
            const topH = p.topHoldings?.length
              ? ` | TopHoldings=${p.topHoldings.join(',')}`
              : '';
            return `- ${p.symbol} | ชื่อ: ${p.name} | ประเภท: ${p.category} | ธุรกิจจริง: ${
              p.sector || 'ทั่วไป'
            }${topH}${quoteInfo}`;
          })
          .join('\n')
      : '- พอร์ตยังว่าง (วิเคราะห์ macroImpacts เป็นหลัก และใส่ portfolioImpacts เป็น [])';

  // Hard cap: <= 12 calendar events + <= 8 news items = <= 20 priority items per Gemini request
  const priorityCalendar = selectPriorityCalendarForAi(realCalendarEvents, today, 12);
  const hasRealCalendar = priorityCalendar.length > 0;

  const calendarBlock = hasRealCalendar
    ? priorityCalendar
        .map(
          (ev) =>
            `[${ev.id}] ${ev.date} ${ev.time} | ${ev.countryCode}/${ev.currency} (${ev.countryNameTh}) | Impact=${
              ev.impact === 3 ? 'High' : ev.impact === 2 ? 'Medium' : 'Low'
            } | Kind=${ev.eventKind || 'indicator'} | Title="${ev.originalTitle || ev.title}" | Actual=${
              ev.actual
            } | Forecast=${ev.forecast} | Previous=${ev.previous}`
        )
        .join('\n')
    : '(ไม่พบฟีดปฏิทินชั่วคราว)';

  const priorityRssIndices = selectPriorityRssIndicesForAi(rssHeadlines, 8);
  const rssBlock =
    priorityRssIndices.length > 0
      ? priorityRssIndices
          .map((idx) => {
            const r = rssHeadlines[idx];
            return `[${idx}] (${r.countryFlag} ${r.currency}/${r.channelHint}) [${r.source}] ${r.title}${
              r.pubDate ? ` | pubDate: ${r.pubDate}` : ''
            }${r.link ? ` | URL: ${r.link}` : ''}`;
          })
          .join('\n')
      : '(ไม่พบข่าว RSS ชั่วคราว)';

  return `คุณเป็นนักวิเคราะห์การเงินระดับสถาบัน วันนี้คือ ${todayThai} (${today}, เวลาไทย UTC+7)
วิเคราะห์ข้อมูลจริงด้านล่าง (รวมไม่เกิน 20 รายการสำคัญ) แล้วตอบเป็น JSON ที่ถูกต้อง 100% เพียงชุดเดียวเท่านั้น

=== 1. พอร์ตจริงของผู้ใช้ (ต้องวิเคราะห์ตรงกลุ่มธุรกิจจริงเท่านั้น!) ===
${portfolioBlock}

=== 2. เหตุการณ์เศรษฐกิจสำคัญคัดแล้ว (${priorityCalendar.length} รายการ, เวลาไทย UTC+7) ===
${calendarBlock}

=== 3. ข่าวเด่นล่าสุด 5 ภูมิภาค (${priorityRssIndices.length} รายการจาก RSS) ===
${rssBlock}

กฎเหล็ก (STRICT RULES):
1. ห้ามแต่งตัวเลขหรือเปลี่ยนวันเวลาของปฏิทินข้อ 2 ให้ส่งคืนใน "calendarEnrichments" อ้างอิง "id" เดิม
2. บีบอัดคำอธิบายใน "portfolioImpacts" และ "macroImpacts" ให้สั้นกระชับมาก **ไม่เกิน 6-8 คำภาษาไทย** ต่อรายการ!
3. วิเคราะห์ "portfolioImpacts" ให้ตรงกลุ่มธุรกิจจริงของหุ้นในพอร์ตเท่านั้น ห้ามโยงข้ามกลุ่ม (เช่น KCG คือหุ้นอาหาร/นม-เนยในไทย กระทบจากต้นทุนนม ค่าเงินบาท กำลังซื้อไทย ไม่ใช่หุ้นชิป/เทคสหรัฐฯ) ถ้าไม่เกี่ยวข้องให้ใส่ []
4. ใน "macroImpacts" ให้เลือกเฉพาะ 3-4 สินทรัพย์ที่กระทบจริงจาก: ค่าเงินเจ้าของข่าว (เช่น USD/JPY/KRW/EUR/GBP), THB, CNY, Gold, Silver, Copper, BTC, หุ้นหลัก
5. สำหรับ "newsItems" ให้ระบุ "rssIndex" ตรงกับเลข [index] ในข้อ 3 พร้อมธงชาติ รหัสประเทศ และสกุลเงินจริง
6. ห้ามเดาวัน XD เอง ใส่ "xdStatus": "announced" และ "xdDate" ได้เฉพาะที่มีใน Yahoo Finance (upcomingXD) >= ${today} เท่านั้น
7. ห้ามใส่คอมเมนต์ใดๆ ใน JSON

ตอบกลับเป็น JSON เท่านั้น:
{
  "fearGreed": {
    "value": <0-100>,
    "previousClose": <0-100>,
    "oneWeekAgo": <0-100>,
    "oneMonthAgo": <0-100>,
    "marketNote": "<สรุปบรรยากาศตลาดโลกวันนี้สั้นๆ 1 ประโยค>"
  },
  "calendarEnrichments": [
    {
      "id": "<id ตรงตามข้อ 2>",
      "titleTh": "<ชื่อตัวเลขแปลไทยกระชับ>",
      "descriptionTh": "<อธิบายผลกระทบต่อตลาดสั้นๆ 1 ประโยค>",
      "actualOutcome": "<better | worse | inline | pending>",
      "relatedAssets": ["<Ticker>"],
      "portfolioImpacts": [
        {
          "symbol": "<เฉพาะ Ticker ในพอร์ตจริงที่ตรงธุรกิจ>",
          "relation": "<direct | indirect>",
          "severity": "<high | medium | low>",
          "direction": "<bullish | bearish | neutral>",
          "reasonTh": "<กระชับไม่เกิน 6-8 คำ>"
        }
      ],
      "macroImpacts": [
        {
          "asset": "<USD|THB|CNY|JPY|KRW|EUR|GBP|Gold|Silver|Copper|BTC|S&P500>",
          "direction": "<bullish | bearish | neutral>",
          "noteTh": "<กระชับไม่เกิน 6-8 คำ>"
        }
      ]
    }
  ],${
    hasRealCalendar
      ? ''
      : `
  "calendarEvents": [
    {
      "date": "<YYYY-MM-DD ระหว่าง ${yesterday} ถึง ${endDate}>",
      "time": "<HH:mm น. เวลาไทย UTC+7>",
      "countryCode": "<US|TH|CN|EU|JP|KR|GB|AU|NZ>",
      "flag": "<ธงชาติ>",
      "currency": "<USD|THB|CNY|EUR|JPY|KRW|GBP|AUD|NZD>",
      "countryNameTh": "<ชื่อประเทศภาษาไทย>",
      "impact": <1 | 2 | 3>,
      "category": "economic",
      "title": "<ชื่อเหตุการณ์ภาษาไทย>",
      "actual": "—",
      "forecast": "—",
      "previous": "—",
      "actualOutcome": "pending",
      "relatedAssets": ["<Ticker>"],
      "macroTags": ["us_rates"],
      "descriptionTh": "<สั้นๆ 1 ประโยค>",
      "portfolioImpacts": [],
      "macroImpacts": []
    }
  ],`
  }
  "newsItems": [
    {
      "rssIndex": <เลขดัชนีจากข้อ 3>,
      "source": "<ชื่อแหล่งข่าวจริง>",
      "sourceUrl": "<URL จริงจากข้อ 3>",
      "headline": "<พาดหัวแปลไทยกระชับ>",
      "impactSummary": "<สรุปผลกระทบ 1 ประโยคสั้นๆ>",
      "sentiment": "<bullish | bearish | neutral>",
      "relatedAssets": ["<Ticker>"],
      "macroTags": ["<แท็ก>"],
      "countryCode": "<US|JP|KR|CN|TH|EU|GB|AU|NZ|GLOBAL>",
      "currency": "<USD|JPY|KRW|CNY|THB|EUR|GBP|AUD|NZD|Global>",
      "countryFlag": "<ธงชาติ>",
      "portfolioImpacts": [
        {
          "symbol": "<เฉพาะ Ticker ในพอร์ตจริงที่ตรงธุรกิจ>",
          "relation": "<direct | indirect>",
          "severity": "<high | medium | low>",
          "direction": "<bullish | bearish | neutral>",
          "reasonTh": "<กระชับไม่เกิน 6-8 คำ>"
        }
      ],
      "macroImpacts": [
        {
          "asset": "<USD|THB|CNY|Gold|Silver|Copper|BTC|...>",
          "direction": "<bullish | bearish | neutral>",
          "noteTh": "<กระชับไม่เกิน 6-8 คำ>"
        }
      ]
    }
  ],
  "earnings": [
    {
      "portfolioSymbol": "<Ticker ในพอร์ตจริง (พอร์ตว่างใส่ [])>",
      "reportedSymbol": "<Ticker>",
      "reportedName": "<ชื่อบริษัท>",
      "isTopHolding": false,
      "flag": "<ธงชาติ>",
      "reportDate": "<YYYY-MM-DD หรือ —>",
      "periodLabel": "<งบล่าสุด หรือ ไม่อิงงบการเงิน>",
      "revenueSummary": "<สรุปสั้น หรือ รอประกาศงบ>",
      "profitSummary": "<สรุปสั้น หรือ รอประกาศงบ>",
      "status": "<beat | inline | miss | upcoming | not_applicable>",
      "trendSummaryTh": "<แนวโน้มสั้น 1 ประโยค>"
    }
  ],
  "dividends": [
    {
      "symbol": "<Ticker ในพอร์ตจริง (พอร์ตว่างใส่ [])>",
      "name": "<ชื่อเต็ม>",
      "flag": "<ธงชาติ>",
      "applicable": true,
      "xdStatus": "<announced | unannounced | not_applicable>",
      "xdDate": "<YYYY-MM-DD เฉพาะมีใน Yahoo >= ${today} มิฉะนั้น null>",
      "dps": "<ปันผลต่อหุ้น หรือ —>",
      "dividendYield": "<จาก Yahoo หรือ —>",
      "payDate": "<YYYY-MM-DD หรือ —>",
      "lastPaidXdDate": "<จาก Yahoo หรือ —>",
      "lastPaidDps": "<จาก Yahoo หรือ —>",
      "noteTh": "<หมายเหตุสั้น 1 ประโยค>"
    }
  ],
  "socialInsights": [
    {
      "platform": "<x | facebook | youtube>",
      "channelName": "<ชื่อช่อง/แหล่งข่าวจากข้อ 3>",
      "handleOrPage": "<Handle>",
      "timeLabel": "ล่าสุดวันนี้",
      "title": "<หัวข้อภาษาไทยกระชับ>",
      "deepSummaryTh": "<สรุป 1-2 ประโยคสั้น>",
      "analystViewTh": "<มุมมองสั้น 1 ประโยค>",
      "sentiment": "<bullish | bearish | watch>",
      "relatedAssets": ["<Ticker>"],
      "countryFlag": "<ธงชาติ>",
      "sourceUrl": "<URL จริงจากข้อ 3>"
    }
  ]
}

จำนวนเป้าหมาย (กระชับ ไม่เยิ่นเย้อ):
- calendarEnrichments: ครบ ${priorityCalendar.length} รายการในข้อ 2
- newsItems: ครบ ${priorityRssIndices.length} ข่าวในข้อ 3
- socialInsights: 6 รายการ (x, facebook, youtube อย่างละ 2)
- earnings และ dividends: เฉพาะหุ้นในพอร์ตจริงของผู้ใช้`;
}

function buildSourcesFromRssAndYahoo(
  rssHeadlines: PublicRssHeadline[],
  yahooQuotes: Record<string, LiveAssetQuote>
): SyncSource[] {
  const sources: SyncSource[] = [];
  const seen = new Set<string>();

  for (const r of rssHeadlines) {
    if (r.link && !seen.has(r.link) && sources.length < 8) {
      seen.add(r.link);
      sources.push({
        title: `${r.source}: ${r.title.slice(0, 65)}`,
        uri: r.link,
      });
    }
  }

  const yahooSyms = Object.values(yahooQuotes).slice(0, 3);
  for (const q of yahooSyms) {
    const uri = `https://finance.yahoo.com/quote/${encodeURIComponent(q.yahooSymbol)}`;
    if (!seen.has(uri)) {
      seen.add(uri);
      sources.push({
        title: `Yahoo Finance: ${q.symbol}`,
        uri,
      });
    }
  }

  return sources.slice(0, 10);
}

function reconcileDividendsWithYahoo(
  rawDividendsInput: unknown,
  portfolioEntries: PortfolioEntryInput[],
  yahooQuotes: Record<string, LiveAssetQuote>,
  today: string
): DividendXDRecord[] {
  const portfolioByUpper = new Map(portfolioEntries.map((p) => [p.symbol, p]));

  const parsedDividends: DividendXDRecord[] = Array.isArray(rawDividendsInput)
    ? rawDividendsInput
        .map((rawD, idx): DividendXDRecord => {
          const d = (rawD && typeof rawD === 'object' ? rawD : {}) as Record<string, unknown>;
          const sym = typeof d.symbol === 'string' ? d.symbol.trim().toUpperCase() : '';
          const asset = portfolioByUpper.get(sym);
          const yahoo = yahooQuotes[sym];

          const forceNonDividend =
            NON_DIVIDEND_SYMBOLS.has(sym) ||
            asset?.hasDividends === false ||
            asset?.category === 'Crypto' ||
            asset?.category === 'Commodity' ||
            asset?.category === 'Forex' ||
            d.applicable === false ||
            d.xdStatus === 'not_applicable';

          if (forceNonDividend) {
            return {
              id: `live-div-${Date.now()}-${idx}`,
              symbol: sym,
              name:
                typeof d.name === 'string' && d.name.trim()
                  ? d.name.trim()
                  : asset?.name || sym,
              flag:
                typeof d.flag === 'string' && d.flag.trim()
                  ? d.flag.trim()
                  : asset?.flag || '🌐',
              applicable: false,
              xdStatus: 'not_applicable',
              notApplicableReasonTh: 'ไม่มีปันผล / ไม่อิงงบการเงิน',
              xdDate: '—',
              daysUntilXD: null,
              dps: '—',
              dividendYield: '—',
              payDate: '—',
              noteTh: 'ไม่มีปันผล / ไม่อิงงบการเงิน (ราคาเคลื่อนไหวตามสินทรัพย์อ้างอิงโดยตรง)',
              isLiveSynced: true,
            };
          }

          // Prefer verified Yahoo Finance upcoming XD date if present
          const parsedUpcomingXd =
            parseValidIsoDate(yahoo?.upcomingXdDate) || parseValidIsoDate(d.xdDate);
          const diffUpcomingXd = computeCalendarDayDiff(parsedUpcomingXd, today);
          const parsedPayDate = parseValidIsoDate(d.payDate);
          const parsedLastXd =
            parseValidIsoDate(yahoo?.lastPaidXdDate) || parseValidIsoDate(d.lastPaidXdDate);
          const parsedLastPay = parseValidIsoDate(d.lastPaidPayDate);

          const bestYield =
            yahoo?.dividendYield ||
            (typeof d.dividendYield === 'string' && d.dividendYield.trim()
              ? d.dividendYield.trim()
              : '—');

          const bestLastDps =
            yahoo?.lastPaidDps ||
            (typeof d.lastPaidDps === 'string' && d.lastPaidDps.trim() && d.lastPaidDps !== '—'
              ? d.lastPaidDps.trim()
              : typeof d.dps === 'string' && d.dps.trim() && d.dps !== '—'
              ? d.dps.trim()
              : '—');

          const isOfficiallyUpcoming =
            (Boolean(yahoo?.upcomingXdDate) || d.xdStatus === 'announced') &&
            parsedUpcomingXd !== null &&
            diffUpcomingXd !== null &&
            diffUpcomingXd >= 0;

          if (isOfficiallyUpcoming && parsedUpcomingXd !== null && diffUpcomingXd !== null) {
            return {
              id: `live-div-${Date.now()}-${idx}`,
              symbol: sym,
              name:
                typeof d.name === 'string' && d.name.trim()
                  ? d.name.trim()
                  : asset?.name || sym,
              flag:
                typeof d.flag === 'string' && d.flag.trim()
                  ? d.flag.trim()
                  : asset?.flag || '🌐',
              applicable: true,
              xdStatus: 'announced',
              xdDate: parsedUpcomingXd,
              daysUntilXD: diffUpcomingXd,
              dps:
                typeof d.dps === 'string' && d.dps.trim() && d.dps !== '—'
                  ? d.dps.trim()
                  : bestLastDps,
              dividendYield: bestYield,
              payDate: parsedPayDate || '—',
              lastPaidXdDate: parsedLastXd || undefined,
              lastPaidDps: bestLastDps !== '—' ? bestLastDps : undefined,
              lastPaidPayDate: parsedLastPay || undefined,
              frequency:
                typeof d.frequency === 'string' && d.frequency.trim()
                  ? d.frequency.trim()
                  : undefined,
              noteTh:
                typeof d.noteTh === 'string' && d.noteTh.trim() ? d.noteTh.trim() : undefined,
              isLiveSynced: true,
            };
          }

          const fallbackLastXd =
            parsedLastXd ||
            (parsedUpcomingXd && diffUpcomingXd !== null && diffUpcomingXd < 0
              ? parsedUpcomingXd
              : undefined);
          const fallbackLastPay =
            parsedLastPay ||
            (parsedPayDate && (computeCalendarDayDiff(parsedPayDate, today) ?? 0) <= 0
              ? parsedPayDate
              : '—');

          return {
            id: `live-div-${Date.now()}-${idx}`,
            symbol: sym,
            name:
              typeof d.name === 'string' && d.name.trim()
                ? d.name.trim()
                : asset?.name || sym,
            flag:
              typeof d.flag === 'string' && d.flag.trim()
                ? d.flag.trim()
                : asset?.flag || '🌐',
            applicable: true,
            xdStatus: 'unannounced',
            xdDate: '—',
            daysUntilXD: null,
            dps: bestLastDps,
            dividendYield: bestYield,
            payDate: '—',
            lastPaidXdDate: fallbackLastXd || '—',
            lastPaidDps: bestLastDps,
            lastPaidPayDate: fallbackLastPay,
            frequency:
              typeof d.frequency === 'string' && d.frequency.trim()
                ? d.frequency.trim()
                : undefined,
            noteTh:
              typeof d.noteTh === 'string' && d.noteTh.trim()
                ? d.noteTh.trim()
                : 'ยังไม่ประกาศวัน XD รอบถัดไปอย่างเป็นทางการ แสดงข้อมูลปันผลรอบล่าสุดจาก Yahoo Finance',
            isLiveSynced: true,
          };
        })
        .filter((x) => x.symbol.length > 0)
    : [];

  // Ensure every portfolio asset has a dividend card even if omitted by AI
  const coveredDivSymbols = new Set(parsedDividends.map((d) => d.symbol));
  for (const asset of portfolioEntries) {
    if (coveredDivSymbols.has(asset.symbol)) continue;
    const yahoo = yahooQuotes[asset.symbol];
    const isNonDiv =
      NON_DIVIDEND_SYMBOLS.has(asset.symbol) ||
      asset.hasDividends === false ||
      asset.category === 'Crypto' ||
      asset.category === 'Commodity' ||
      asset.category === 'Forex';

    const upcomingIso = parseValidIsoDate(yahoo?.upcomingXdDate);
    const diffUpcoming = computeCalendarDayDiff(upcomingIso, today);
    const hasOfficialUpcoming = !isNonDiv && upcomingIso !== null && diffUpcoming !== null && diffUpcoming >= 0;

    parsedDividends.push({
      id: `live-div-auto-${asset.symbol}-${Date.now()}`,
      symbol: asset.symbol,
      name: asset.name,
      flag: asset.flag,
      applicable: !isNonDiv,
      xdStatus: isNonDiv ? 'not_applicable' : hasOfficialUpcoming ? 'announced' : 'unannounced',
      notApplicableReasonTh: isNonDiv ? 'ไม่มีปันผล / ไม่อิงงบการเงิน' : undefined,
      xdDate: hasOfficialUpcoming && upcomingIso ? upcomingIso : '—',
      daysUntilXD: hasOfficialUpcoming ? diffUpcoming : null,
      dps: isNonDiv ? '—' : yahoo?.lastPaidDps || '—',
      dividendYield: isNonDiv ? '—' : yahoo?.dividendYield || '—',
      payDate: '—',
      lastPaidXdDate: isNonDiv ? undefined : yahoo?.lastPaidXdDate || '—',
      lastPaidDps: isNonDiv ? undefined : yahoo?.lastPaidDps || '—',
      lastPaidPayDate: isNonDiv ? undefined : '—',
      noteTh: isNonDiv
        ? 'ไม่มีปันผล / ไม่อิงงบการเงิน'
        : hasOfficialUpcoming
        ? 'กำหนดวันขึ้นเครื่องหมาย XD อ้างอิงจากข้อมูล Yahoo Finance ล่าสุด'
        : 'ยังไม่ประกาศวัน XD รอบถัดไปอย่างเป็นทางการ แสดงข้อมูลปันผลรอบล่าสุดจาก Yahoo Finance',
      isLiveSynced: true,
    });
  }

  return parsedDividends;
}

export function parseBatchedInvestCalResponse(
  rawText: string,
  portfolioEntries: PortfolioEntryInput[],
  rssHeadlines: PublicRssHeadline[],
  yahooQuotes: Record<string, LiveAssetQuote>,
  today: string,
  realCalendarEvents: CalendarEvent[] = []
): BatchedSyncResponse {
  // Resilient JSON recovery: never throws syntax errors on truncated/markdown-wrapped Gemini responses
  const parsed = safeParseJsonObject(rawText || '{}');
  const nowMs = Date.now();
  const syncedAt = new Date(nowMs).toISOString();
  const sources = buildSourcesFromRssAndYahoo(rssHeadlines, yahooQuotes);

  // 1. Merge Gemini Thai translations, sector-grounded portfolioImpacts & macroImpacts onto REAL 54-country events
  const enrichmentById = new Map<string, Record<string, unknown>>();
  if (Array.isArray(parsed.calendarEnrichments)) {
    for (const rawEnr of parsed.calendarEnrichments) {
      if (!rawEnr || typeof rawEnr !== 'object') continue;
      const enr = rawEnr as Record<string, unknown>;
      const id = typeof enr.id === 'string' ? enr.id.trim() : '';
      if (id) enrichmentById.set(id, enr);
    }
  }

  const mergedRealCalendar: CalendarEvent[] = realCalendarEvents.map((baseEv) => {
    const enr = enrichmentById.get(baseEv.id);
    if (!enr) return baseEv;

    const titleTh =
      typeof enr.titleTh === 'string' && enr.titleTh.trim()
        ? enr.titleTh.trim().slice(0, 160)
        : baseEv.title;
    const descriptionTh =
      typeof enr.descriptionTh === 'string' && enr.descriptionTh.trim()
        ? enr.descriptionTh.trim().slice(0, 260)
        : baseEv.descriptionTh;
    const relatedAssets = Array.isArray(enr.relatedAssets)
      ? Array.from(
          new Set([
            ...enr.relatedAssets
              .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
              .map((x) => x.trim().toUpperCase()),
            ...baseEv.relatedAssets,
          ])
        ).slice(0, 8)
      : baseEv.relatedAssets;

    const actualOutcome =
      baseEv.actual === '—'
        ? 'pending'
        : enr.actualOutcome === 'better' ||
          enr.actualOutcome === 'worse' ||
          enr.actualOutcome === 'inline'
        ? enr.actualOutcome
        : baseEv.actualOutcome;

    const rawPortfolioImpacts = enr.portfolioImpacts ?? enr.aiImpacts;
    const aiImpacts = sanitizeAiImpacts(rawPortfolioImpacts, portfolioEntries);
    const macroImpacts = sanitizeMacroImpacts(enr.macroImpacts);

    return {
      ...baseEv,
      title: titleTh,
      descriptionTh,
      actualOutcome,
      relatedAssets,
      assetForecasts: sanitizeForecasts(enr.assetForecasts),
      aiImpacts,
      macroImpacts,
    };
  });

  // 2. Parse optional extra calendar events (earnings/dividends or fallback if external calendar feeds were unreachable)
  const extraAiCalendar: CalendarEvent[] = Array.isArray(parsed.calendarEvents)
    ? parsed.calendarEvents
        .map((rawEv, idx): CalendarEvent | null => {
          const ev = (rawEv && typeof rawEv === 'object' ? rawEv : {}) as Record<string, unknown>;
          const validDate = parseValidIsoDate(ev.date);
          if (!validDate) return null;
          const category =
            ev.category === 'earnings' || ev.category === 'dividend' ? ev.category : 'economic';
          if (mergedRealCalendar.length > 0 && category === 'economic') {
            return null;
          }
          const diff = computeCalendarDayDiff(validDate, today);
          const rawActual =
            typeof ev.actual === 'string' && ev.actual.trim() ? ev.actual.trim() : '—';
          const actual = diff !== null && diff > 0 ? '—' : rawActual;
          const actualOutcome =
            actual === '—'
              ? 'pending'
              : ev.actualOutcome === 'better' ||
                ev.actualOutcome === 'worse' ||
                ev.actualOutcome === 'inline'
              ? ev.actualOutcome
              : 'pending';
          const formattedTime = ensureThaiClockSuffix(
            typeof ev.time === 'string' ? ev.time : '—'
          );
          const tsMs = parseBangkokEventTimestampMs(validDate, formattedTime);
          const meta = resolveCountryCurrencyMeta(
            typeof ev.countryCode === 'string' ? ev.countryCode : undefined,
            typeof ev.currency === 'string' ? ev.currency : undefined
          );

          return {
            id: `live-ev-${nowMs}-${idx}`,
            date: validDate,
            time: formattedTime,
            eventTimestampIso: tsMs ? new Date(tsMs).toISOString() : undefined,
            eventKind: 'indicator',
            isAllDay: formattedTime === '—' || formattedTime === 'ตลอดวัน',
            countryCode: meta.countryCode,
            flag: typeof ev.flag === 'string' && ev.flag.trim() ? ev.flag.trim() : meta.flag,
            currency: meta.currency,
            countryNameTh:
              typeof ev.countryNameTh === 'string' && ev.countryNameTh.trim()
                ? ev.countryNameTh.trim()
                : meta.countryNameTh,
            impact: ev.impact === 3 || ev.impact === 2 || ev.impact === 1 ? ev.impact : 2,
            category,
            title: typeof ev.title === 'string' ? ev.title.trim() : '',
            actual,
            forecast:
              typeof ev.forecast === 'string' && ev.forecast.trim() ? ev.forecast.trim() : '—',
            previous:
              typeof ev.previous === 'string' && ev.previous.trim() ? ev.previous.trim() : '—',
            actualOutcome,
            relatedAssets: Array.isArray(ev.relatedAssets)
              ? ev.relatedAssets.filter((x): x is string => typeof x === 'string')
              : [],
            macroTags: Array.isArray(ev.macroTags)
              ? ev.macroTags.filter((x): x is string => typeof x === 'string')
              : [],
            descriptionTh: typeof ev.descriptionTh === 'string' ? ev.descriptionTh.trim() : '',
            assetForecasts: sanitizeForecasts(ev.assetForecasts),
            aiImpacts: sanitizeAiImpacts(ev.portfolioImpacts ?? ev.aiImpacts, portfolioEntries),
            macroImpacts: sanitizeMacroImpacts(ev.macroImpacts),
            isLiveSynced: true,
          };
        })
        .filter((x): x is CalendarEvent => Boolean(x && x.title.length > 0))
    : [];

  const calendarEvents: CalendarEvent[] = [...mergedRealCalendar, ...extraAiCalendar].sort(
    (a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (Boolean(a.isAllDay) !== Boolean(b.isAllDay)) return a.isAllDay ? -1 : 1;
      const aMs = a.eventTimestampIso ? Date.parse(a.eventTimestampIso) : 0;
      const bMs = b.eventTimestampIso ? Date.parse(b.eventTimestampIso) : 0;
      if (aMs && bMs && aMs !== bMs) return aMs - bMs;
      return a.time.localeCompare(b.time);
    }
  );

  // 3. Parse AI-analyzed newsItems (<= 8 priority items) + append remaining multi-region RSS items
  const rssByUrl = new Map<string, PublicRssHeadline>();
  for (const r of rssHeadlines) {
    if (r.link) rssByUrl.set(r.link, r);
  }
  const usedRssIndices = new Set<number>();
  const usedNewsUrls = new Set<string>();

  const aiNewsItems: NewsItem[] = Array.isArray(parsed.newsItems)
    ? parsed.newsItems
        .map((rawItem, idx): NewsItem => {
          const item = (rawItem && typeof rawItem === 'object' ? rawItem : {}) as Record<
            string,
            unknown
          >;
          const rawUrl = typeof item.sourceUrl === 'string' ? item.sourceUrl.trim() : '';
          const rssIdx =
            typeof item.rssIndex === 'number' &&
            Number.isInteger(item.rssIndex) &&
            item.rssIndex >= 0 &&
            item.rssIndex < rssHeadlines.length
              ? item.rssIndex
              : -1;

          const matchedRss =
            (rssIdx >= 0 ? rssHeadlines[rssIdx] : undefined) ||
            (rawUrl ? rssByUrl.get(rawUrl) : undefined);

          if (rssIdx >= 0) usedRssIndices.add(rssIdx);
          if (matchedRss?.link) usedNewsUrls.add(matchedRss.link);

          const safeUrl =
            rawUrl.startsWith('https://') || rawUrl.startsWith('http://')
              ? rawUrl
              : matchedRss?.link || undefined;
          if (safeUrl) usedNewsUrls.add(safeUrl);

          const formattedTs = formatThaiNewsTimestamp(
            matchedRss?.pubDate || syncedAt,
            nowMs
          );

          const countryCode =
            matchedRss?.countryCode ||
            (typeof item.countryCode === 'string' && item.countryCode.trim()
              ? item.countryCode.trim().toUpperCase()
              : 'GLOBAL');
          const currency =
            matchedRss?.currency ||
            (typeof item.currency === 'string' && item.currency.trim()
              ? item.currency.trim()
              : countryCode === 'GLOBAL'
              ? 'Global'
              : resolveCountryCurrencyMeta(countryCode).currency);
          const countryFlag =
            matchedRss?.countryFlag ||
            (typeof item.countryFlag === 'string' && item.countryFlag.trim()
              ? item.countryFlag.trim()
              : resolveCountryCurrencyMeta(countryCode, currency).flag);
          const regionGroup =
            matchedRss?.regionGroup || getRegionGroupForCode(countryCode, currency);

          return {
            id: `live-news-${nowMs}-${idx}`,
            publishedAt: formattedTs.publishedAt,
            timeLabel: formattedTs.timeLabel,
            source:
              typeof item.source === 'string' && item.source.trim()
                ? item.source.trim()
                : matchedRss?.source || 'Google News RSS',
            sourceUrl: safeUrl,
            headline:
              typeof item.headline === 'string' && item.headline.trim()
                ? item.headline.trim()
                : matchedRss?.title || '',
            impactSummary:
              typeof item.impactSummary === 'string' ? item.impactSummary.trim() : '',
            sentiment:
              item.sentiment === 'bullish' || item.sentiment === 'bearish'
                ? item.sentiment
                : 'neutral',
            relatedAssets: Array.isArray(item.relatedAssets)
              ? item.relatedAssets.filter((x): x is string => typeof x === 'string')
              : [],
            macroTags: Array.isArray(item.macroTags)
              ? item.macroTags.filter((x): x is string => typeof x === 'string')
              : [],
            countryCode,
            currency,
            countryFlag,
            regionGroup,
            aiImpacts: sanitizeAiImpacts(
              item.portfolioImpacts ?? item.aiImpacts,
              portfolioEntries
            ),
            macroImpacts: sanitizeMacroImpacts(item.macroImpacts),
            isLiveSynced: true,
          };
        })
        .filter((n) => n.headline.length > 0)
    : [];

  // Preserve remaining fresh multi-region RSS headlines so all 5 regions remain populated
  const heldSymbols = portfolioEntries.map((p) => p.symbol);
  const extraRssNews: NewsItem[] = [];
  rssHeadlines.forEach((r, idx) => {
    if (usedRssIndices.has(idx)) return;
    if (r.link && usedNewsUrls.has(r.link)) return;
    if (aiNewsItems.length + extraRssNews.length >= 25) return;

    const matched = heldSymbols.filter((sym) =>
      r.title.toUpperCase().includes(sym.toUpperCase())
    );
    const formattedTs = formatThaiNewsTimestamp(r.pubDate || syncedAt, nowMs);
    extraRssNews.push({
      id: `rss-extra-${nowMs}-${idx}`,
      publishedAt: formattedTs.publishedAt,
      timeLabel: formattedTs.timeLabel,
      source: r.source,
      sourceUrl: r.link || undefined,
      headline: r.title,
      impactSummary: `ข่าวจริงล่าสุดจาก ${r.source} (${r.countryFlag} ${r.currency}) — กดอ่านต้นฉบับเพื่อดูรายละเอียด`,
      sentiment: 'neutral',
      relatedAssets: matched,
      macroTags:
        r.regionGroup === 'TH'
          ? ['thai_macro']
          : r.channelHint === 'commodities'
          ? ['precious_metals', 'oil_commodity']
          : r.channelHint === 'crypto'
          ? ['crypto']
          : r.regionGroup === 'EUROPE'
          ? ['eu_macro']
          : r.regionGroup === 'ASIA'
          ? ['china_macro', 'boj_jpy']
          : ['us_rates'],
      countryCode: r.countryCode,
      currency: r.currency,
      countryFlag: r.countryFlag,
      regionGroup: r.regionGroup,
      isLiveSynced: true,
    });
  });

  const newsItems: NewsItem[] = [...aiNewsItems, ...extraRssNews].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
  );

  let fearGreed: Partial<FearGreedData> | undefined;
  const rawFg = parsed.fearGreed as Record<string, unknown> | undefined;
  if (rawFg && typeof rawFg.value === 'number') {
    const val = Math.min(100, Math.max(0, Math.round(rawFg.value)));
    fearGreed = {
      value: val,
      labelTh: getFearGreedLabelTh(val),
      previousClose:
        typeof rawFg.previousClose === 'number'
          ? Math.min(100, Math.max(0, Math.round(rawFg.previousClose)))
          : val,
      oneWeekAgo:
        typeof rawFg.oneWeekAgo === 'number'
          ? Math.min(100, Math.max(0, Math.round(rawFg.oneWeekAgo)))
          : val,
      oneMonthAgo:
        typeof rawFg.oneMonthAgo === 'number'
          ? Math.min(100, Math.max(0, Math.round(rawFg.oneMonthAgo)))
          : val,
      marketNote:
        typeof rawFg.marketNote === 'string' && rawFg.marketNote.trim()
          ? rawFg.marketNote.trim()
          : 'วิเคราะห์บรรยากาศตลาดล่าสุดจากข่าว RSS จริงทั่วโลก',
      updatedLabel: 'วิเคราะห์สดจาก RSS + Yahoo Finance',
    };
  }

  const validStatuses = new Set<EarningsStatus>([
    'beat',
    'inline',
    'miss',
    'upcoming',
    'not_applicable',
  ]);
  const portfolioByUpper = new Map(portfolioEntries.map((p) => [p.symbol, p]));

  const earnings: EarningsRecord[] = Array.isArray(parsed.earnings)
    ? parsed.earnings
        .map((rawE, idx): EarningsRecord => {
          const e = (rawE && typeof rawE === 'object' ? rawE : {}) as Record<string, unknown>;
          const pSym =
            typeof e.portfolioSymbol === 'string'
              ? e.portfolioSymbol.trim().toUpperCase()
              : '';
          const asset = portfolioByUpper.get(pSym);
          const forceNotApplicable =
            NON_DIVIDEND_SYMBOLS.has(pSym) ||
            BOND_NO_EARNINGS_SYMBOLS.has(pSym) ||
            asset?.hasEarnings === false ||
            asset?.category === 'Crypto' ||
            asset?.category === 'Commodity' ||
            asset?.category === 'Forex';

          const validDate = parseValidIsoDate(e.reportDate);
          const computedDaysUntil = computeCalendarDayDiff(validDate, today);
          const rawStatus: EarningsStatus =
            typeof e.status === 'string' && validStatuses.has(e.status as EarningsStatus)
              ? (e.status as EarningsStatus)
              : 'upcoming';
          const finalStatus: EarningsStatus = forceNotApplicable ? 'not_applicable' : rawStatus;

          return {
            id: `live-earn-${Date.now()}-${idx}`,
            portfolioSymbol: pSym,
            reportedSymbol:
              typeof e.reportedSymbol === 'string' && e.reportedSymbol.trim()
                ? e.reportedSymbol.trim().toUpperCase()
                : pSym,
            reportedName:
              typeof e.reportedName === 'string' && e.reportedName.trim()
                ? e.reportedName.trim()
                : asset?.name || pSym,
            isTopHolding: Boolean(e.isTopHolding),
            holdingWeight:
              typeof e.holdingWeight === 'string' && e.holdingWeight.trim()
                ? e.holdingWeight.trim()
                : undefined,
            flag:
              typeof e.flag === 'string' && e.flag.trim()
                ? e.flag.trim()
                : asset?.flag || '🌐',
            reportDate: finalStatus === 'not_applicable' ? '—' : validDate || '—',
            periodLabel:
              finalStatus === 'not_applicable'
                ? 'ไม่อิงงบการเงิน'
                : typeof e.periodLabel === 'string' && e.periodLabel.trim()
                ? e.periodLabel.trim()
                : 'ล่าสุด',
            revenueSummary:
              finalStatus === 'not_applicable'
                ? '—'
                : typeof e.revenueSummary === 'string' && e.revenueSummary.trim()
                ? e.revenueSummary.trim()
                : '—',
            profitSummary:
              finalStatus === 'not_applicable'
                ? '—'
                : typeof e.profitSummary === 'string' && e.profitSummary.trim()
                ? e.profitSummary.trim()
                : '—',
            yoyChange:
              typeof e.yoyChange === 'string' && e.yoyChange.trim()
                ? e.yoyChange.trim()
                : undefined,
            status: finalStatus,
            trendSummaryTh:
              finalStatus === 'not_applicable'
                ? 'ไม่มีปันผล / ไม่อิงงบการเงินบริษัท (ราคาขับเคลื่อนตามตลาดโลก อัตราดอกเบี้ย หรืออุปสงค์-อุปทานโดยตรง)'
                : typeof e.trendSummaryTh === 'string'
                ? e.trendSummaryTh.trim()
                : '',
            daysUntil: finalStatus === 'not_applicable' ? null : computedDaysUntil,
            isLiveSynced: true,
          };
        })
        .filter((rec) => rec.portfolioSymbol.length > 0)
    : [];

  const dividends = reconcileDividendsWithYahoo(
    parsed.dividends,
    portfolioEntries,
    yahooQuotes,
    today
  );

  const socialInsights: SocialInsightItem[] = Array.isArray(parsed.socialInsights)
    ? parsed.socialInsights
        .map((rawIt, idx): SocialInsightItem => {
          const it = (rawIt && typeof rawIt === 'object' ? rawIt : {}) as Record<string, unknown>;
          const rawPlat = String(it.platform || '').toLowerCase();
          const platform: SocialPlatform =
            rawPlat === 'facebook' || rawPlat === 'youtube' ? rawPlat : 'x';
          const rawSent = String(it.sentiment || '').toLowerCase();
          const sentiment: SocialSentiment =
            rawSent === 'bullish' || rawSent === 'bearish' ? rawSent : 'watch';
          const rawUrl = typeof it.sourceUrl === 'string' ? it.sourceUrl.trim() : '';
          const safeUrl =
            rawUrl.startsWith('https://') || rawUrl.startsWith('http://') ? rawUrl : undefined;

          return {
            id: `live-soc-${Date.now()}-${idx}`,
            platform,
            channelName:
              typeof it.channelName === 'string' && it.channelName.trim()
                ? it.channelName.trim().slice(0, 80)
                : platform === 'x'
                ? 'X Market Analyst'
                : platform === 'facebook'
                ? 'เพจวิเคราะห์การลงทุน'
                : 'YouTube Finance Channel',
            handleOrPage:
              typeof it.handleOrPage === 'string' && it.handleOrPage.trim()
                ? it.handleOrPage.trim().slice(0, 80)
                : platform.toUpperCase(),
            timeLabel:
              typeof it.timeLabel === 'string' && it.timeLabel.trim()
                ? it.timeLabel.trim()
                : 'ล่าสุดวันนี้',
            title: typeof it.title === 'string' ? it.title.trim() : '',
            deepSummaryTh:
              typeof it.deepSummaryTh === 'string' ? it.deepSummaryTh.trim() : '',
            analystViewTh:
              typeof it.analystViewTh === 'string' ? it.analystViewTh.trim() : '',
            sentiment,
            relatedAssets: Array.isArray(it.relatedAssets)
              ? it.relatedAssets
                  .filter((x): x is string => typeof x === 'string')
                  .map((x) => x.trim().toUpperCase())
              : [],
            countryFlag:
              typeof it.countryFlag === 'string' && it.countryFlag.trim()
                ? it.countryFlag.trim()
                : '🌐',
            sourceUrl: safeUrl,
            searchQuery:
              typeof it.searchQuery === 'string' && it.searchQuery.trim()
                ? it.searchQuery.trim()
                : undefined,
            isLiveSynced: true,
          };
        })
        .filter((x) => x.title.length > 0)
    : [];

  return {
    calendarEvents,
    newsItems,
    fearGreed,
    earnings,
    dividends,
    socialInsights,
    quotes: yahooQuotes,
    sources,
    syncedAt,
    rssCount: rssHeadlines.length,
  };
}

/**
 * Resilient Zero-Mock Public Fallback:
 * If Gemini API key is temporarily rate-limited (429) or missing, still surface the 100% REAL
 * Google News RSS headlines and Yahoo Finance quotes/dividends collected in Step 1 so the app
 * remains genuinely useful instead of blank!
 */
export function buildPublicOnlyFallbackBatchedResponse(
  portfolioEntries: PortfolioEntryInput[],
  rssHeadlines: PublicRssHeadline[],
  yahooQuotes: Record<string, LiveAssetQuote>,
  today: string,
  aiWarning: string,
  realCalendarEvents: CalendarEvent[] = []
): BatchedSyncResponse {
  const nowMs = Date.now();
  const syncedAt = new Date(nowMs).toISOString();
  const sources = buildSourcesFromRssAndYahoo(rssHeadlines, yahooQuotes);
  const heldSymbols = portfolioEntries.map((p) => p.symbol);

  const newsItems: NewsItem[] = rssHeadlines
    .slice(0, 25)
    .map((r, idx) => {
      const matched = heldSymbols.filter((sym) =>
        r.title.toUpperCase().includes(sym.toUpperCase())
      );
      const formattedTs = formatThaiNewsTimestamp(r.pubDate || syncedAt, nowMs);
      return {
        id: `rss-news-${nowMs}-${idx}`,
        publishedAt: formattedTs.publishedAt,
        timeLabel: formattedTs.timeLabel,
        source: r.source,
        sourceUrl: r.link || undefined,
        headline: r.title,
        impactSummary: `ข่าวจริงล่าสุดจาก ${r.source} (${r.countryFlag} ${r.currency}) — กดลิงก์ต้นฉบับเพื่ออ่านรายละเอียดเพิ่มเติม`,
        sentiment: 'neutral' as const,
        relatedAssets: matched,
        macroTags:
          r.regionGroup === 'TH'
            ? ['thai_macro']
            : r.channelHint === 'commodities'
            ? ['precious_metals', 'oil_commodity']
            : r.channelHint === 'crypto'
            ? ['crypto']
            : r.regionGroup === 'EUROPE'
            ? ['eu_macro']
            : r.regionGroup === 'ASIA'
            ? ['china_macro', 'boj_jpy']
            : ['us_rates'],
        countryCode: r.countryCode,
        currency: r.currency,
        countryFlag: r.countryFlag,
        regionGroup: r.regionGroup,
        isLiveSynced: true,
      };
    })
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

  const socialInsights: SocialInsightItem[] = rssHeadlines.slice(0, 9).map((r, idx) => {
    const platform: SocialPlatform =
      r.channelHint === 'social_fb'
        ? 'facebook'
        : r.channelHint === 'social_yt'
        ? 'youtube'
        : idx % 3 === 0
        ? 'x'
        : idx % 3 === 1
        ? 'facebook'
        : 'youtube';
    const matched = heldSymbols.filter((sym) =>
      r.title.toUpperCase().includes(sym.toUpperCase())
    );
    const isThai = /[\u0E00-\u0E7F]/.test(r.title);
    const formattedTs = formatThaiNewsTimestamp(r.pubDate || syncedAt, nowMs);
    return {
      id: `rss-soc-${nowMs}-${idx}`,
      platform,
      channelName: r.source,
      handleOrPage: r.source,
      timeLabel: formattedTs.timeLabel,
      title: r.title,
      deepSummaryTh: `หัวข้อข่าวและประเด็นตลาดจริงล่าสุดจาก ${r.source} — เปิดอ่านต้นฉบับผ่านปุ่มลิงก์ด้านล่าง`,
      analystViewTh: 'รอ AI วิเคราะห์เชิงลึกเพิ่มเติมเมื่อโควตา Gemini API พร้อมใช้งาน',
      sentiment: 'watch',
      relatedAssets: matched,
      countryFlag: isThai ? '🇹🇭' : '🇺🇸',
      sourceUrl: r.link || undefined,
      searchQuery: r.title.slice(0, 60),
      isLiveSynced: true,
    };
  });

  const dividends = reconcileDividendsWithYahoo([], portfolioEntries, yahooQuotes, today);

  return {
    calendarEvents: realCalendarEvents,
    newsItems,
    fearGreed: undefined,
    earnings: [],
    dividends,
    socialInsights,
    quotes: yahooQuotes,
    sources,
    syncedAt,
    rssCount: rssHeadlines.length,
    aiWarning,
  };
}

// ============================================================================
// 3. On-Demand AI Concise Buy/Sell Plan from Trend, S/R & Fibonacci (NO googleSearch)
// ============================================================================

export interface ChartTechnicalPromptInput {
  symbol: string;
  name: string;
  category: string;
  currency: string;
  timeframe: ChartTimeframe;
  latestPrice: number;
  ema20: number | null;
  ema50: number | null;
  trend: ChartTrendDirection;
  support1: number;
  support2: number;
  resistance1: number;
  resistance2: number;
  fib382: number;
  fib500: number;
  fib618: number;
  fib1272: number;
  fib1618: number;
  averageCost?: number;
  quantity?: number;
}

export function buildChartTechnicalPrompt(input: ChartTechnicalPromptInput): string {
  const costText =
    typeof input.averageCost === 'number' && input.averageCost > 0
      ? `ต้นทุนเฉลี่ยของผู้ใช้: ${input.averageCost} ${input.currency} (${(
          ((input.latestPrice - input.averageCost) / input.averageCost) *
          100
        ).toFixed(2)}% เทียบราคาปัจจุบัน)${input.quantity ? ` · จำนวน ${input.quantity} หน่วย` : ''}`
      : 'ผู้ใช้ยังไม่ได้กรอกต้นทุนเฉลี่ย (แนะนำจุดรอรับและเป้าหมายทำกำไรสำหรับผู้เริ่มวางแผน)';

  return `คุณเป็นนักวางแผนการลงทุนสายเทคนิคที่สรุปสั้น กระชับ อ่านง่ายบนมือถือ
วิเคราะห์ตัวเลขจริงต่อไปนี้ (ห้ามแต่งตัวเลขราคาอื่นนอกเหนือจากฐานราคาจริงที่ให้):

- สินทรัพย์: ${input.symbol} (${input.name} · ${input.category}) | กรอบเวลา ${input.timeframe}
- ราคาล่าสุด: ${input.latestPrice} ${input.currency}
- เทรนจาก EMA: ${input.trend} (EMA20=${input.ema20 ?? 'N/A'}, EMA50=${input.ema50 ?? 'N/A'})
- แนวรับ: S1=${input.support1}, S2=${input.support2} | แนวต้าน: R1=${input.resistance1}, R2=${input.resistance2}
- Fibonacci ย่อตัว (Retracement): 38.2%=${input.fib382}, 50.0%=${input.fib500}, 61.8%=${input.fib618}
- Fibonacci เป้าถัดไป (Extension): 127.2%=${input.fib1272}, 161.8%=${input.fib1618}
- ${costText}

ให้ตอบเป็น JSON เท่านั้น โดยเน้นแผนเข้าซื้อ-ขายภาษาไทยสั้นกระชับ ไม่เกิน 3 บรรทัด:
{
  "trend": "<Uptrend | Downtrend | Sideway>",
  "trendTh": "<เทรนขาขึ้น | เทรนขาลง | ไซด์เวย์>",
  "shortPlanLinesTh": [
    "<บรรทัด 1: โซนรอซื้อ/DCA ที่ได้เปรียบอ้างอิง S1/Fib พร้อมตัวเลขราคาจริง>",
    "<บรรทัด 2: เป้าทยอยขายทำกำไรอ้างอิง R1/Fib Extension พร้อมตัวเลขราคาจริง>",
    "<บรรทัด 3: จุดคุมความเสี่ยง/Stop Loss หรือคำแนะนำเทียบจุดคุ้มทุนสั้นๆ>"
  ],
  "summaryTh": "<สรุปสั้น 1 ประโยคไม่เกิน 140 ตัวอักษร>"
}`;
}

export function parseChartTechnicalResponse(
  rawText: string,
  symbol: string,
  timeframe: ChartTimeframe
): ChartAiAnalysisResponse {
  const parsed = safeParseJsonObject(rawText || '{}');
  const rawTrend = String(parsed.trend || '').trim();
  const trend: ChartTrendDirection =
    rawTrend === 'Uptrend' || rawTrend === 'Downtrend' || rawTrend === 'Sideway'
      ? rawTrend
      : 'Sideway';

  const str = (val: unknown, fallback: string) =>
    typeof val === 'string' && val.trim() ? val.trim().slice(0, 220) : fallback;

  const rawLines = Array.isArray(parsed.shortPlanLinesTh)
    ? parsed.shortPlanLinesTh
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((line) => line.trim().slice(0, 180))
        .slice(0, 3)
    : [];

  const shortPlanLinesTh =
    rawLines.length > 0
      ? rawLines
      : [
          'โซนเข้าสะสม: ทยอยรับใกล้แนวรับ S1 หรือโซนย่อตัว Fib 38.2% – 50.0%',
          'เป้าทำกำไร: แบ่งขายบางส่วนเมื่อทดสอบแนวต้าน R1 และเป้า Fib 127.2%',
          'คุมความเสี่ยง: ทบทวนสถานะหากราคาปิดหลุดแนวรับ S2 / โซน Fib 61.8%',
        ];

  return {
    symbol: symbol.trim().toUpperCase(),
    timeframe,
    trend,
    trendTh: str(
      parsed.trendTh,
      trend === 'Uptrend' ? 'เทรนขาขึ้น' : trend === 'Downtrend' ? 'เทรนขาลง' : 'ไซด์เวย์'
    ),
    shortPlanLinesTh,
    summaryTh: str(
      parsed.summaryTh,
      shortPlanLinesTh[0] || 'วางแผนเข้าซื้อ-ขายตามกรอบแนวรับ แนวต้าน และระดับ Fibonacci'
    ),
    analyzedAt: new Date().toISOString(),
    fromCache: false,
    aiCalled: true,
  };
}
