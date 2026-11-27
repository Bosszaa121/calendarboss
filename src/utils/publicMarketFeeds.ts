import type {
  AssetCategory,
  ChartCandle,
  ChartHistoryResponse,
  ChartTimeframe,
  LiveAssetQuote,
} from '../types.ts';
import type { ClassifiedAssetResult, PortfolioEntryInput } from './geminiParsers.ts';

export interface PublicRssHeadline {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  channelHint: 'macro' | 'portfolio' | 'social_x' | 'social_fb' | 'social_yt';
}

const FETCH_TIMEOUT_MS = 8500;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRssXmlItems(
  xml: string,
  channelHint: PublicRssHeadline['channelHint'],
  limit = 12
): PublicRssHeadline[] {
  const items: PublicRssHeadline[] = [];
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const block = match[1];
    const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(block);
    const linkMatch = /<link\b[^>]*>([\s\S]*?)<\/link>/i.exec(block);
    const pubDateMatch = /<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i.exec(block);
    const sourceMatch = /<source\b[^>]*>([\s\S]*?)<\/source>/i.exec(block);

    const rawTitle = titleMatch ? decodeXmlEntities(titleMatch[1]) : '';
    const link = linkMatch ? decodeXmlEntities(linkMatch[1]) : '';
    const pubDate = pubDateMatch ? decodeXmlEntities(pubDateMatch[1]) : '';
    let source = sourceMatch ? decodeXmlEntities(sourceMatch[1]) : '';

    if (!rawTitle) continue;

    // Google News RSS titles often end with " - Publisher Name"
    let cleanTitle = rawTitle;
    if (!source) {
      const dashIdx = rawTitle.lastIndexOf(' - ');
      if (dashIdx > 18) {
        source = rawTitle.slice(dashIdx + 3).trim();
        cleanTitle = rawTitle.slice(0, dashIdx).trim();
      } else {
        source = 'Google News';
      }
    } else if (cleanTitle.endsWith(` - ${source}`)) {
      cleanTitle = cleanTitle.slice(0, -(` - ${source}`.length)).trim();
    }

    items.push({
      title: cleanTitle.slice(0, 180),
      link: link.startsWith('http') ? link : '',
      source: source.slice(0, 60) || 'Google News',
      pubDate,
      channelHint,
    });
  }

  return items;
}

export async function fetchGoogleNewsRss(
  query: string,
  lang: 'th' | 'en',
  channelHint: PublicRssHeadline['channelHint'],
  useCorsProxy: boolean,
  limit = 10
): Promise<PublicRssHeadline[]> {
  const hl = lang === 'th' ? 'th' : 'en-US';
  const gl = lang === 'th' ? 'TH' : 'US';
  const ceid = lang === 'th' ? 'TH:th' : 'US:en';
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(
    query
  )}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

  if (!useCorsProxy) {
    try {
      const res = await fetchWithTimeout(rssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; InvestCalBot/1.0)',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
      });
      if (!res.ok) return [];
      const xml = await res.text();
      return parseRssXmlItems(xml, channelHint, limit);
    } catch {
      return [];
    }
  }

  // Vercel static frontend mode: try rss2json first, then fall back to allorigins raw XML
  try {
    const rss2JsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
    const res = await fetchWithTimeout(rss2JsonUrl);
    if (res.ok) {
      const data = (await res.json()) as {
        status?: string;
        items?: Array<{ title?: string; link?: string; pubDate?: string; author?: string }>;
      };
      if (data.status === 'ok' && Array.isArray(data.items) && data.items.length > 0) {
        return data.items.slice(0, limit).map((it) => {
          const rawTitle = decodeXmlEntities(it.title || '');
          let source = it.author?.trim() || '';
          let title = rawTitle;
          const dashIdx = rawTitle.lastIndexOf(' - ');
          if (!source && dashIdx > 18) {
            source = rawTitle.slice(dashIdx + 3).trim();
            title = rawTitle.slice(0, dashIdx).trim();
          }
          return {
            title: title.slice(0, 180),
            link: typeof it.link === 'string' && it.link.startsWith('http') ? it.link : '',
            source: source.slice(0, 60) || 'Google News',
            pubDate: it.pubDate || '',
            channelHint,
          };
        });
      }
    }
  } catch {
    // Fall through to allorigins
  }

  try {
    const allOriginsUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`;
    const res = await fetchWithTimeout(allOriginsUrl);
    if (!res.ok) return [];
    const payload = (await res.json()) as { contents?: string };
    if (typeof payload.contents === 'string' && payload.contents.includes('<item')) {
      return parseRssXmlItems(payload.contents, channelHint, limit);
    }
  } catch {
    // Graceful empty return
  }

  return [];
}

export async function collectLivePublicRssNews(
  portfolio: PortfolioEntryInput[],
  useCorsProxy: boolean
): Promise<PublicRssHeadline[]> {
  const heldTickers = portfolio.map((p) => p.symbol).slice(0, 8);
  const tickerQuery =
    heldTickers.length > 0
      ? heldTickers.join(' OR ')
      : 'QQQM OR SMH OR BLOK OR GLD OR SLV OR KCG OR PEP';

  const thaiTickers = portfolio
    .filter((p) => p.category === 'Thai Stock')
    .map((p) => p.symbol)
    .slice(0, 5);

  const queries: Array<{
    q: string;
    lang: 'th' | 'en';
    hint: PublicRssHeadline['channelHint'];
    limit: number;
  }> = [
    {
      q: 'ปฏิทินเศรษฐกิจ เฟด ดอกเบี้ย เงินเฟ้อ กนง ตลาดหุ้นโลก',
      lang: 'th',
      hint: 'macro',
      limit: 10,
    },
    {
      q: 'Federal Reserve CPI inflation jobs report stock market earnings calendar',
      lang: 'en',
      hint: 'macro',
      limit: 10,
    },
    {
      q: `(${tickerQuery}) (stock OR ETF OR dividend OR earnings OR forecast)`,
      lang: 'en',
      hint: 'portfolio',
      limit: 10,
    },
    {
      q:
        thaiTickers.length > 0
          ? `(${thaiTickers.join(' OR ')}) (หุ้น OR ปันผล OR XD OR งบการเงิน)`
          : 'หุ้นไทย SET ปันผล XD ลงทุนแมน Finnomena',
      lang: 'th',
      hint: 'social_fb',
      limit: 8,
    },
    {
      q: `(${tickerQuery}) (YouTube OR CNBC OR Bloomberg OR Reuters OR analysis)`,
      lang: 'en',
      hint: 'social_yt',
      limit: 8,
    },
  ];

  const settled = await Promise.allSettled(
    queries.map((cfg) =>
      fetchGoogleNewsRss(cfg.q, cfg.lang, cfg.hint, useCorsProxy, cfg.limit)
    )
  );

  const seenTitles = new Set<string>();
  const combined: PublicRssHeadline[] = [];

  for (const res of settled) {
    if (res.status !== 'fulfilled') continue;
    for (const item of res.value) {
      const norm = item.title.toLowerCase().slice(0, 70);
      if (!norm || seenTitles.has(norm)) continue;
      seenTitles.add(norm);
      combined.push(item);
    }
  }

  return combined.slice(0, 42);
}

// ============================================================================
// Yahoo Finance Public Quotes, Dividends & Autocomplete (Zero API Key)
// ============================================================================

const STATIC_YAHOO_MAP: Record<string, string> = {
  XAUUSD: 'GC=F',
  'XAU/USD': 'GC=F',
  XAGUSD: 'SI=F',
  'XAG/USD': 'SI=F',
  WTI: 'CL=F',
  BRENT: 'BZ=F',
  NATGAS: 'NG=F',
  COPPER: 'HG=F',
  'USD/THB': 'THB=X',
  'EUR/USD': 'EURUSD=X',
  'USD/JPY': 'JPY=X',
  'GBP/USD': 'GBPUSD=X',
  'AUD/USD': 'AUDUSD=X',
  DXY: 'DX-Y.NYB',
  'BRK.B': 'BRK-B',
  'BRK.A': 'BRK-A',
};

export function toYahooSymbol(symbol: string, category?: string): string {
  const upper = symbol.trim().toUpperCase();
  if (STATIC_YAHOO_MAP[upper]) return STATIC_YAHOO_MAP[upper];
  if (category === 'Thai Stock') {
    return upper.endsWith('.BK') ? upper : `${upper}.BK`;
  }
  if (category === 'Crypto') {
    return upper.includes('-') ? upper : `${upper}-USD`;
  }
  return upper;
}

async function fetchJsonViaOptionalProxy<T>(
  targetUrl: string,
  useCorsProxy: boolean
): Promise<T | null> {
  if (!useCorsProxy) {
    try {
      const res = await fetchWithTimeout(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  // Public CORS proxy chain for Vercel static deployment
  const proxies = [
    async () => {
      const res = await fetchWithTimeout(
        `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`
      );
      if (!res.ok) return null;
      const wrapped = (await res.json()) as { contents?: string };
      if (!wrapped?.contents) return null;
      return JSON.parse(wrapped.contents) as T;
    },
    async () => {
      const res = await fetchWithTimeout(
        `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
      );
      if (!res.ok) return null;
      return (await res.json()) as T;
    },
  ];

  for (const attempt of proxies) {
    try {
      const data = await attempt();
      if (data) return data;
    } catch {
      continue;
    }
  }
  return null;
}

function unixSecondsToIsoDate(sec: number): string {
  const d = new Date(sec * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDpsCurrency(amount: number, currency: string): string {
  const rounded = amount >= 1 ? amount.toFixed(2) : amount.toFixed(4).replace(/0+$/, '');
  if (currency === 'THB') return `฿${rounded}`;
  if (currency === 'USD') return `$${rounded}`;
  if (currency === 'EUR') return `€${rounded}`;
  if (currency === 'GBP') return `£${rounded}`;
  if (currency === 'JPY') return `¥${Math.round(amount)}`;
  return `${rounded} ${currency}`;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        currency?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        longName?: string;
        shortName?: string;
      };
      events?: {
        dividends?: Record<string, { amount?: number; date?: number }>;
      };
    }>;
  };
}

export async function fetchYahooQuoteAndFundamentals(
  asset: Pick<PortfolioEntryInput, 'symbol' | 'category'>,
  todayIso: string,
  useCorsProxy: boolean
): Promise<LiveAssetQuote | null> {
  const yahooSymbol = toYahooSymbol(asset.symbol, asset.category);
  const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol
  )}?interval=1d&range=1y&events=div`;

  const payload = await fetchJsonViaOptionalProxy<YahooChartResponse>(chartUrl, useCorsProxy);
  const result = payload?.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta) return null;

  const price =
    typeof meta.regularMarketPrice === 'number' && Number.isFinite(meta.regularMarketPrice)
      ? meta.regularMarketPrice
      : null;
  const previousClose =
    typeof meta.previousClose === 'number' && meta.previousClose > 0
      ? meta.previousClose
      : typeof meta.chartPreviousClose === 'number' && meta.chartPreviousClose > 0
      ? meta.chartPreviousClose
      : null;

  const changePercent =
    price !== null && previousClose !== null && previousClose > 0
      ? Number((((price - previousClose) / previousClose) * 100).toFixed(2))
      : null;

  const currency = (meta.currency || (asset.category === 'Thai Stock' ? 'THB' : 'USD')).toUpperCase();

  // Extract real dividend events from the last 12 months
  const rawDividends = result?.events?.dividends
    ? Object.values(result.events.dividends)
        .filter(
          (d): d is { amount: number; date: number } =>
            typeof d?.amount === 'number' && d.amount > 0 && typeof d?.date === 'number'
        )
        .map((d) => ({
          amount: d.amount,
          dateIso: unixSecondsToIsoDate(d.date),
        }))
        .sort((a, b) => a.dateIso.localeCompare(b.dateIso))
    : [];

  let lastPaidXdDate: string | undefined;
  let lastPaidDps: string | undefined;
  let upcomingXdDate: string | undefined;
  let trailingAnnualDividend = 0;

  for (const div of rawDividends) {
    if (div.dateIso >= todayIso) {
      if (!upcomingXdDate) {
        upcomingXdDate = div.dateIso;
      }
    } else {
      lastPaidXdDate = div.dateIso;
      lastPaidDps = formatDpsCurrency(div.amount, currency);
      trailingAnnualDividend += div.amount;
    }
  }

  let dividendYield: string | undefined;
  if (price !== null && price > 0 && trailingAnnualDividend > 0) {
    const yieldPct = (trailingAnnualDividend / price) * 100;
    if (yieldPct > 0 && yieldPct < 45) {
      dividendYield = `${yieldPct.toFixed(2)}%`;
    }
  }

  return {
    symbol: asset.symbol.trim().toUpperCase(),
    yahooSymbol,
    name: meta.longName || meta.shortName,
    price,
    previousClose,
    changePercent,
    currency,
    dividendYield,
    lastPaidXdDate,
    lastPaidDps,
    upcomingXdDate,
    updatedAt: new Date().toISOString(),
  };
}

export async function collectLiveYahooQuotes(
  portfolio: PortfolioEntryInput[],
  todayIso: string,
  useCorsProxy: boolean
): Promise<Record<string, LiveAssetQuote>> {
  if (portfolio.length === 0) return {};

  const targets = portfolio.slice(0, 15);
  const settled = await Promise.allSettled(
    targets.map((asset) => fetchYahooQuoteAndFundamentals(asset, todayIso, useCorsProxy))
  );

  const quotes: Record<string, LiveAssetQuote> = {};
  for (const item of settled) {
    if (item.status === 'fulfilled' && item.value) {
      quotes[item.value.symbol] = item.value;
    }
  }
  return quotes;
}

// ============================================================================
// Yahoo Finance Public Autocomplete Search (Free Global Ticker Resolver)
// ============================================================================

interface YahooSearchResponse {
  quotes?: Array<{
    symbol?: string;
    shortname?: string;
    longname?: string;
    quoteType?: string;
    exchange?: string;
    exchDisp?: string;
    sectorDisp?: string;
    industryDisp?: string;
    isYahooFinance?: boolean;
  }>;
}

function inferMarketCountryInfo(symbol: string, exchange: string): {
  categoryHint: AssetCategory;
  flag: string;
  currency: string;
  market: string;
  themes: string[];
} {
  const upperSym = symbol.toUpperCase();
  const upperExch = exchange.toUpperCase();

  if (upperSym.endsWith('.BK') || upperExch.includes('SET') || upperExch.includes('BANGKOK')) {
    return {
      categoryHint: 'Thai Stock',
      flag: '🇹🇭',
      currency: 'THB',
      market: 'SET',
      themes: ['thai_equity'],
    };
  }
  if (upperSym.endsWith('.T') || upperExch.includes('TOKYO') || upperExch.includes('JPX')) {
    return {
      categoryHint: 'US Stock',
      flag: '🇯🇵',
      currency: 'JPY',
      market: 'TSE',
      themes: ['japan_equity', 'jpy_sensitive', 'global_equity'],
    };
  }
  if (upperSym.endsWith('.HK') || upperExch.includes('HKG') || upperExch.includes('HONG KONG')) {
    return {
      categoryHint: 'US Stock',
      flag: '🇭🇰',
      currency: 'HKD',
      market: 'HKEX',
      themes: ['china_demand', 'global_equity'],
    };
  }
  if (upperSym.endsWith('.L') || upperExch.includes('LON') || upperExch.includes('LSE')) {
    return {
      categoryHint: 'US Stock',
      flag: '🇬🇧',
      currency: 'GBP',
      market: 'LSE',
      themes: ['uk_macro_sensitive', 'global_equity'],
    };
  }
  if (
    upperSym.endsWith('.DE') ||
    upperSym.endsWith('.PA') ||
    upperSym.endsWith('.AS') ||
    upperExch.includes('XETRA') ||
    upperExch.includes('EURONEXT')
  ) {
    return {
      categoryHint: 'US Stock',
      flag: '🇪🇺',
      currency: 'EUR',
      market: exchange || 'Europe',
      themes: ['eu_macro_sensitive', 'global_equity'],
    };
  }
  return {
    categoryHint: 'US Stock',
    flag: '🇺🇸',
    currency: 'USD',
    market: exchange || 'NASDAQ/NYSE',
    themes: ['us_equity', 'us_rates_sensitive'],
  };
}

export async function searchYahooFinanceAutocomplete(
  rawQuery: string,
  useCorsProxy: boolean
): Promise<ClassifiedAssetResult | null> {
  const trimmed = rawQuery.trim();
  if (!trimmed) return null;

  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
    trimmed
  )}&quotesCount=6&newsCount=0&enableFuzzyQuery=true`;

  const data = await fetchJsonViaOptionalProxy<YahooSearchResponse>(url, useCorsProxy);
  const candidates = (data?.quotes ?? []).filter(
    (q) =>
      typeof q.symbol === 'string' &&
      q.symbol.trim().length > 0 &&
      q.quoteType !== 'OPTION' &&
      q.quoteType !== 'MUTUALFUND'
  );

  if (candidates.length === 0) return null;

  // Prefer EQUITY or ETF over obscure tickers
  const best =
    candidates.find((q) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF') || candidates[0];

  const rawSymbol = String(best.symbol).trim().toUpperCase();
  const quoteType = String(best.quoteType || 'EQUITY').toUpperCase();
  const exchange = String(best.exchDisp || best.exchange || 'Global').trim();
  const marketInfo = inferMarketCountryInfo(rawSymbol, exchange);

  let category: AssetCategory = marketInfo.categoryHint;
  let cleanSymbol = rawSymbol;
  let flag = marketInfo.flag;
  let currency = marketInfo.currency;
  let hasDividends = true;
  let hasEarnings = true;

  if (quoteType === 'ETF') {
    category = 'US ETF';
    hasDividends = true;
    hasEarnings = true;
  } else if (quoteType === 'CRYPTOCURRENCY') {
    category = 'Crypto';
    cleanSymbol = rawSymbol.replace(/-USD$/, '');
    flag = '🌐';
    currency = 'USD';
    hasDividends = false;
    hasEarnings = false;
  } else if (quoteType === 'FUTURE' || quoteType === 'COMMODITY') {
    category = 'Commodity';
    flag = '🌐';
    currency = 'USD';
    hasDividends = false;
    hasEarnings = false;
  } else if (quoteType === 'CURRENCY') {
    category = 'Forex';
    flag = '🌐';
    hasDividends = false;
    hasEarnings = false;
  } else if (category === 'Thai Stock') {
    cleanSymbol = rawSymbol.replace(/\.BK$/, '');
  }

  const sectorParts = [best.sectorDisp, best.industryDisp].filter(
    (s): s is string => typeof s === 'string' && s.trim().length > 0
  );

  return {
    symbol: cleanSymbol,
    name: String(best.longname || best.shortname || cleanSymbol).trim(),
    category,
    market: marketInfo.market,
    flag,
    currency,
    sector: sectorParts.length > 0 ? sectorParts.join(' · ') : 'ตลาดหลักทรัพย์สากล (Global Market)',
    themes:
      category === 'Crypto'
        ? ['bitcoin', 'crypto_spot', 'us_rates_sensitive']
        : marketInfo.themes,
    hasDividends,
    hasEarnings,
  };
}

// ============================================================================
// Yahoo Finance Public Historical OHLCV Candles (1D / 4H / 1H — 0% AI Quota)
// ============================================================================

interface YahooOhlcvResponse {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        currency?: string;
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
}

function formatCandleLabel(timestampSec: number, timeframe: ChartTimeframe): string {
  const d = new Date(timestampSec * 1000);
  if (timeframe === '1D') {
    return d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
    });
  }
  return d.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function aggregateToFourHourCandles(hourly: ChartCandle[]): ChartCandle[] {
  const buckets = new Map<number, ChartCandle>();
  const FOUR_HOURS = 4 * 3600;

  for (const c of hourly) {
    const bucketTs = Math.floor(c.timestamp / FOUR_HOURS) * FOUR_HOURS;
    const existing = buckets.get(bucketTs);
    if (!existing) {
      buckets.set(bucketTs, {
        timestamp: bucketTs,
        label: formatCandleLabel(bucketTs, '4H'),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      });
    } else {
      existing.high = Math.max(existing.high, c.high);
      existing.low = Math.min(existing.low, c.low);
      existing.close = c.close;
      existing.volume += c.volume;
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.timestamp - b.timestamp);
}

export async function fetchYahooHistoricalCandles(
  symbol: string,
  category: string,
  timeframe: ChartTimeframe,
  useCorsProxy = false
): Promise<ChartHistoryResponse> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const yahooSymbol = toYahooSymbol(cleanSymbol, category);

  const queryParams =
    timeframe === '1D'
      ? 'interval=1d&range=6mo'
      : timeframe === '4H'
      ? 'interval=60m&range=60d'
      : 'interval=60m&range=14d';

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol
  )}?${queryParams}`;

  const payload = await fetchJsonViaOptionalProxy<YahooOhlcvResponse>(url, useCorsProxy);
  const result = payload?.chart?.result?.[0];
  const meta = result?.meta;
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];

  if (!meta || !quote || timestamps.length === 0) {
    throw new Error(
      `ไม่พบข้อมูลแท่งเทียนย้อนหลังสำหรับ ${cleanSymbol} (${yahooSymbol}) จาก Yahoo Finance`
    );
  }

  const rawCandles: ChartCandle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const o = quote.open?.[i];
    const h = quote.high?.[i];
    const l = quote.low?.[i];
    const c = quote.close?.[i];
    const v = quote.volume?.[i] ?? 0;

    if (
      typeof ts !== 'number' ||
      typeof o !== 'number' ||
      typeof h !== 'number' ||
      typeof l !== 'number' ||
      typeof c !== 'number' ||
      !Number.isFinite(o) ||
      !Number.isFinite(h) ||
      !Number.isFinite(l) ||
      !Number.isFinite(c) ||
      c <= 0
    ) {
      continue;
    }

    rawCandles.push({
      timestamp: ts,
      label: formatCandleLabel(ts, timeframe === '4H' ? '1H' : timeframe),
      open: o,
      high: h,
      low: l,
      close: c,
      volume: typeof v === 'number' && Number.isFinite(v) ? v : 0,
    });
  }

  const candles =
    timeframe === '4H'
      ? aggregateToFourHourCandles(rawCandles).slice(-90)
      : rawCandles.slice(-110);

  if (candles.length < 4) {
    throw new Error(`ข้อมูลแท่งเทียนของ ${cleanSymbol} ไม่เพียงพอสำหรับการคำนวณโครงสร้างราคา`);
  }

  const latestPrice =
    typeof meta.regularMarketPrice === 'number' && Number.isFinite(meta.regularMarketPrice)
      ? meta.regularMarketPrice
      : candles[candles.length - 1].close;

  const previousClose =
    typeof meta.previousClose === 'number' && meta.previousClose > 0
      ? meta.previousClose
      : typeof meta.chartPreviousClose === 'number' && meta.chartPreviousClose > 0
      ? meta.chartPreviousClose
      : candles.length >= 2
      ? candles[candles.length - 2].close
      : null;

  const changePercent =
    previousClose !== null && previousClose > 0
      ? Number((((latestPrice - previousClose) / previousClose) * 100).toFixed(2))
      : null;

  const currency = (meta.currency || (category === 'Thai Stock' ? 'THB' : 'USD')).toUpperCase();

  return {
    symbol: cleanSymbol,
    yahooSymbol,
    timeframe,
    currency,
    latestPrice,
    previousClose,
    changePercent,
    candles,
    fetchedAt: new Date().toISOString(),
  };
}
