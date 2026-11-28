import type {
  AssetCategory,
  CalendarEvent,
  ChartCandle,
  ChartHistoryResponse,
  ChartTimeframe,
  ImpactLevel,
  LiveAssetQuote,
  RegionFilterKey,
} from '../types.ts';
import type { ClassifiedAssetResult, PortfolioEntryInput } from './geminiParsers.ts';
import {
  classifyEventKind,
  formatBiQuoteValue,
  inferNewsRegionMeta,
  resolveCountryCurrencyMeta,
  translateEconomicTitleTh,
} from './economicDictionary.ts';
import { getBangkokTodayIso, toBangkokDateParts } from './thaiTime.ts';

export type RssChannelHint =
  | 'us_wallstreet'
  | 'asia'
  | 'europe_global'
  | 'commodities'
  | 'crypto'
  | 'portfolio'
  | 'social_x'
  | 'social_fb'
  | 'social_yt';

export interface PublicRssHeadline {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  publishedAtMs: number;
  channelHint: RssChannelHint;
  countryCode: string;
  currency: string;
  countryFlag: string;
  regionGroup: Exclude<RegionFilterKey, 'ALL'> | 'GLOBAL';
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

    const parsedMs = pubDate ? Date.parse(pubDate) : NaN;
    const regionMeta = inferNewsRegionMeta(cleanTitle, source, channelHint);
    items.push({
      title: cleanTitle.slice(0, 180),
      link: link.startsWith('http') ? link : '',
      source: source.slice(0, 60) || 'Google News',
      pubDate,
      publishedAtMs: Number.isFinite(parsedMs) ? parsedMs : 0,
      channelHint,
      countryCode: regionMeta.countryCode,
      currency: regionMeta.currency,
      countryFlag: regionMeta.countryFlag,
      regionGroup: regionMeta.regionGroup,
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
          const parsedMs = it.pubDate ? Date.parse(it.pubDate) : NaN;
          const cleanTitle = title.slice(0, 180);
          const cleanSource = source.slice(0, 60) || 'Google News';
          const regionMeta = inferNewsRegionMeta(cleanTitle, cleanSource, channelHint);
          return {
            title: cleanTitle,
            link: typeof it.link === 'string' && it.link.startsWith('http') ? it.link : '',
            source: cleanSource,
            pubDate: it.pubDate || '',
            publishedAtMs: Number.isFinite(parsedMs) ? parsedMs : 0,
            channelHint,
            countryCode: regionMeta.countryCode,
            currency: regionMeta.currency,
            countryFlag: regionMeta.countryFlag,
            regionGroup: regionMeta.regionGroup,
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
  const heldTickers = portfolio.map((p) => p.symbol).slice(0, 6);

  // 5 Core Multi-Region & Asset-Class Google News RSS feeds fetched simultaneously (5 latest items per feed)
  const queries: Array<{
    q: string;
    lang: 'th' | 'en';
    hint: RssChannelHint;
    limit: number;
  }> = [
    {
      q: 'Federal Reserve OR "Wall Street" OR "US stocks" OR Nasdaq OR "S&P 500" OR tech stocks',
      lang: 'en',
      hint: 'us_wallstreet',
      limit: 5,
    },
    {
      q: '(BOJ OR Japan yen OR Korea BOK KRW OR China CNY PBOC OR Thailand SET baht OR RBA Australia)',
      lang: 'en',
      hint: 'asia',
      limit: 5,
    },
    {
      q: '(ECB Eurozone EUR OR "Bank of England" GBP OR OPEC oil OR Europe economy OR geopolitics)',
      lang: 'en',
      hint: 'europe_global',
      limit: 5,
    },
    {
      q: '(gold price OR silver price OR copper price OR crude oil Brent WTI commodities)',
      lang: 'en',
      hint: 'commodities',
      limit: 5,
    },
    {
      q: '(Bitcoin OR BTC OR Ethereum OR "crypto market" OR digital assets ETF)',
      lang: 'en',
      hint: 'crypto',
      limit: 5,
    },
    // Thai market & currency news feed (ensures THB/SET coverage alongside Asia feed)
    {
      q: 'หุ้นไทย SET กนง ค่าเงินบาท เศรษฐกิจไทย ปันผล',
      lang: 'th',
      hint: 'asia',
      limit: 5,
    },
  ];

  // Optional portfolio ticker feed when user holds assets
  if (heldTickers.length > 0) {
    queries.push({
      q: `(${heldTickers.join(' OR ')}) (stock OR ETF OR earnings OR dividend)`,
      lang: 'en',
      hint: 'portfolio',
      limit: 5,
    });
  }

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
      const norm = item.title.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/g, '').slice(0, 64);
      if (!norm || seenTitles.has(norm)) continue;
      seenTitles.add(norm);
      combined.push(item);
    }
  }

  combined.sort((a, b) => (b.publishedAtMs || 0) - (a.publishedAtMs || 0));
  return combined.slice(0, 35);
}

// ============================================================================
// Multi-Source 54-Country 14-Day Economic Calendar Engine
// Source 1 (Primary): BiQuote (/api/calendar -2d..+14d & /api/calendar/upcoming)
// Source 2 (Secondary): ForexFactory (thisweek.json, nextweek.json, thisweek.xml)
// Converted strictly to Asia/Bangkok (UTC+7) 24-hour format + Zero-AI Thai Dictionary
// ============================================================================

export const BIQUOTE_CALENDAR_BASE_URL = 'https://biquote.io/api/calendar';
export const BIQUOTE_UPCOMING_URL = 'https://biquote.io/api/calendar/upcoming';
export const FF_CALENDAR_THIS_WEEK_URL =
  'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
export const FF_CALENDAR_NEXT_WEEK_URL =
  'https://nfs.faireconomy.media/ff_calendar_nextweek.json';
export const FF_CALENDAR_THIS_WEEK_XML_URL =
  'https://nfs.faireconomy.media/ff_calendar_thisweek.xml';

interface RawBiQuoteEvent {
  eventId?: string;
  id?: string;
  time?: string;
  date?: string;
  countryCode?: string;
  country?: string;
  currency?: string;
  name?: string;
  title?: string;
  importance?: string | number;
  impact?: string | number;
  type?: string;
  unit?: string | null;
  multiplier?: string | null;
  actual?: number | string | null;
  forecast?: number | string | null;
  previous?: number | string | null;
  revisedPrevious?: number | string | null;
  timeMode?: string;
}

interface RawForexFactoryEvent {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  forecast?: string;
  previous?: string;
  actual?: string;
}

function addDaysToIso(baseIso: string, deltaDays: number): string {
  const [y, m, d] = baseIso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = target.getUTCFullYear();
  const mm = String(target.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(target.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function inferCalendarMacroTags(currency: string, title: string, baseTags: string[]): string[] {
  const tags = new Set<string>(baseTags);
  const lower = title.toLowerCase();

  if (
    lower.includes('cpi') ||
    lower.includes('ppi') ||
    lower.includes('pce') ||
    lower.includes('hicp') ||
    lower.includes('inflation')
  ) {
    tags.add(currency === 'THB' ? 'thai_cpi' : 'us_inflation');
    tags.add('bond_yield');
    tags.add('precious_metals');
  }
  if (
    lower.includes('payroll') ||
    lower.includes('unemployment') ||
    lower.includes('jobless') ||
    lower.includes('employment') ||
    lower.includes('jolts') ||
    lower.includes('adp') ||
    lower.includes('wage')
  ) {
    tags.add('us_jobs');
    tags.add('us_rates');
  }
  if (
    lower.includes('fomc') ||
    lower.includes('fed') ||
    lower.includes('powell') ||
    lower.includes('rate') ||
    lower.includes('interest') ||
    lower.includes('monetary policy')
  ) {
    tags.add('us_rates');
    tags.add('bond_yield');
    tags.add('dxy');
    tags.add('crypto');
  }
  if (lower.includes('gdp') || lower.includes('pmi') || lower.includes('retail sales') || lower.includes('industrial')) {
    tags.add(currency === 'CNY' ? 'china_macro' : 'us_rates');
  }
  if (lower.includes('dairy') || lower.includes('gdt')) {
    tags.add('food_dairy');
  }
  if (lower.includes('oil') || lower.includes('crude') || lower.includes('opec')) {
    tags.add('oil_commodity');
  }
  return Array.from(tags);
}

function mapImpactLevel(rawImpact: string | number | undefined): ImpactLevel {
  if (typeof rawImpact === 'number') {
    if (rawImpact >= 3) return 3;
    if (rawImpact === 2) return 2;
    return 1;
  }
  const lower = (rawImpact || '').trim().toLowerCase();
  if (lower === 'high' || lower === '3' || lower === 'red') return 3;
  if (lower === 'medium' || lower === 'med' || lower === '2' || lower === 'orange') return 2;
  return 1;
}

function normalizeTitleForDedup(title: string): string {
  return (title || '')
    .toLowerCase()
    .replace(/\b(m\/m|y\/y|q\/q|mom|yoy|qoq|prelim|final|flash|revised|sa|nsa)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 42);
}

async function fetchTextViaOptionalProxy(
  targetUrl: string,
  useCorsProxy: boolean
): Promise<string | null> {
  if (!useCorsProxy) {
    try {
      const res = await fetchWithTimeout(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/xml, text/xml, text/plain, */*',
        },
      });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }
  try {
    const res = await fetchWithTimeout(
      `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`
    );
    if (!res.ok) return null;
    const payload = (await res.json()) as { contents?: string };
    return typeof payload?.contents === 'string' ? payload.contents : null;
  } catch {
    return null;
  }
}

function parseForexFactoryXmlDateToUtcIso(dateStr: string, timeStr: string): {
  utcIso: string;
  isAllDay: boolean;
} | null {
  // ForexFactory XML date format: MM-DD-YYYY (e.g. "11-27-2026")
  const dMatch = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec((dateStr || '').trim());
  if (!dMatch) return null;
  const month = Number(dMatch[1]);
  const day = Number(dMatch[2]);
  const year = Number(dMatch[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const cleanTime = (timeStr || '').trim().toLowerCase();
  const tMatch = /^(\d{1,2}):(\d{2})\s*(am|pm)$/.exec(cleanTime);
  if (!tMatch) {
    // All Day / Tentative / Day 1 / empty -> anchor at 00:00 Bangkok (17:00 prev UTC) so Bangkok date matches exact calendar day
    const anchorMs = Date.UTC(year, month - 1, day, 0, 0, 0) - 7 * 3600 * 1000;
    return {
      utcIso: new Date(anchorMs).toISOString(),
      isAllDay: true,
    };
  }

  let hour = Number(tMatch[1]);
  const minute = Number(tMatch[2]);
  const meridiem = tMatch[3];
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;

  // ForexFactory XML timestamps are published in UTC/GMT
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  return {
    utcIso: new Date(utcMs).toISOString(),
    isAllDay: false,
  };
}

function parseForexFactoryXmlEvents(xml: string): Array<RawForexFactoryEvent & { isAllDay?: boolean }> {
  const results: Array<RawForexFactoryEvent & { isAllDay?: boolean }> = [];
  const eventRegex = /<event\b[^>]*>([\s\S]*?)<\/event>/gi;
  let match: RegExpExecArray | null;

  while ((match = eventRegex.exec(xml)) !== null) {
    const block = match[1];
    const readTag = (tag: string) => {
      const m = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block);
      return m ? decodeXmlEntities(m[1]) : '';
    };

    const title = readTag('title');
    const country = readTag('country');
    const dateRaw = readTag('date');
    const timeRaw = readTag('time');
    const impact = readTag('impact');
    const forecast = readTag('forecast');
    const previous = readTag('previous');
    const actual = readTag('actual');

    if (!title || !dateRaw) continue;
    const parsedTs = parseForexFactoryXmlDateToUtcIso(dateRaw, timeRaw);
    if (!parsedTs) continue;

    results.push({
      title,
      country,
      date: parsedTs.utcIso,
      impact,
      forecast,
      previous,
      actual,
      isAllDay: parsedTs.isAllDay,
    });
  }

  return results;
}

function extractBiQuoteArray(payload: unknown): RawBiQuoteEvent[] {
  if (Array.isArray(payload)) return payload as RawBiQuoteEvent[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.events)) return obj.events as RawBiQuoteEvent[];
    if (Array.isArray(obj.data)) return obj.data as RawBiQuoteEvent[];
    if (Array.isArray(obj.items)) return obj.items as RawBiQuoteEvent[];
  }
  return [];
}

let unifiedCalendarCache: { events: CalendarEvent[]; fetchedAt: number; expiresAt: number } | null =
  null;
const CALENDAR_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes normal cache
const CALENDAR_MIN_REFETCH_MS = 3 * 60 * 1000; // Anti-429 floor for forced refreshes

export async function collectLiveEconomicCalendar(
  useCorsProxy = false,
  forceRefresh = false
): Promise<CalendarEvent[]> {
  const now = Date.now();
  if (unifiedCalendarCache) {
    if (!forceRefresh && now < unifiedCalendarCache.expiresAt) {
      return unifiedCalendarCache.events;
    }
    if (forceRefresh && now - unifiedCalendarCache.fetchedAt < CALENDAR_MIN_REFETCH_MS) {
      return unifiedCalendarCache.events;
    }
  }

  const todayBkk = getBangkokTodayIso(now);
  const fromIso = addDaysToIso(todayBkk, -2);
  const slice1End = addDaysToIso(todayBkk, 3);
  const slice2Start = addDaysToIso(todayBkk, 4);
  const slice2End = addDaysToIso(todayBkk, 9);
  const slice3Start = addDaysToIso(todayBkk, 10);
  const toIso = addDaysToIso(todayBkk, 14);

  const biQuoteUrls = [
    `${BIQUOTE_CALENDAR_BASE_URL}?from=${fromIso}&to=${slice1End}&limit=500`,
    `${BIQUOTE_CALENDAR_BASE_URL}?from=${slice2Start}&to=${slice2End}&limit=500`,
    `${BIQUOTE_CALENDAR_BASE_URL}?from=${slice3Start}&to=${toIso}&limit=500`,
    BIQUOTE_UPCOMING_URL,
  ];

  // Fetch Primary (BiQuote 54-country 14d in 3 slices + upcoming) AND Secondary (ForexFactory JSON/XML) concurrently
  const [biSlicesRes, ffBundleRes] = await Promise.allSettled([
    Promise.allSettled(
      biQuoteUrls.map((url) => fetchJsonViaOptionalProxy<unknown>(url, useCorsProxy))
    ),
    (async () => {
      // Stagger ForexFactory requests slightly to avoid Cloudflare burst 429
      const thisWeekJson = await fetchJsonViaOptionalProxy<RawForexFactoryEvent[]>(
        FF_CALENDAR_THIS_WEEK_URL,
        useCorsProxy
      );
      await new Promise((r) => setTimeout(r, 200));
      const nextWeekJson = await fetchJsonViaOptionalProxy<RawForexFactoryEvent[]>(
        FF_CALENDAR_NEXT_WEEK_URL,
        useCorsProxy
      );
      await new Promise((r) => setTimeout(r, 200));
      const thisWeekXml = await fetchTextViaOptionalProxy(
        FF_CALENDAR_THIS_WEEK_XML_URL,
        useCorsProxy
      );
      return { thisWeekJson, nextWeekJson, thisWeekXml };
    })(),
  ]);

  const dedup = new Map<string, CalendarEvent>();

  const upsertCalendarEvent = (candidate: CalendarEvent, dedupKey: string) => {
    const existing = dedup.get(dedupKey);
    if (!existing) {
      dedup.set(dedupKey, candidate);
      return;
    }

    // Merge best fields from both BiQuote & ForexFactory
    const mergedActual =
      existing.actual !== '—' ? existing.actual : candidate.actual;
    const mergedForecast =
      existing.forecast !== '—' ? existing.forecast : candidate.forecast;
    const mergedPrevious =
      existing.previous !== '—' ? existing.previous : candidate.previous;
    const mergedImpact = Math.max(existing.impact, candidate.impact) as ImpactLevel;

    // Prefer exact clock time over all-day placeholder
    const preferCandidateTime = Boolean(existing.isAllDay && !candidate.isAllDay);
    // Prefer specific country code (e.g. DE/FR/ES) over generic EU/GLOBAL
    const preferCandidateCountry =
      (existing.countryCode === 'EU' || existing.countryCode === 'GLOBAL') &&
      candidate.countryCode !== 'EU' &&
      candidate.countryCode !== 'GLOBAL';

    const mergedKind =
      existing.eventKind && existing.eventKind !== 'indicator'
        ? existing.eventKind
        : candidate.eventKind || 'indicator';

    const providers = new Set([
      ...(existing.sourceProvider ? existing.sourceProvider.split('+') : []),
      ...(candidate.sourceProvider ? candidate.sourceProvider.split('+') : []),
    ]);

    dedup.set(dedupKey, {
      ...existing,
      time: preferCandidateTime ? candidate.time : existing.time,
      eventTimestampIso: preferCandidateTime
        ? candidate.eventTimestampIso
        : existing.eventTimestampIso,
      isAllDay: existing.isAllDay && candidate.isAllDay,
      countryCode: preferCandidateCountry ? candidate.countryCode : existing.countryCode,
      flag: preferCandidateCountry ? candidate.flag : existing.flag,
      countryNameTh: preferCandidateCountry ? candidate.countryNameTh : existing.countryNameTh,
      impact: mergedImpact,
      eventKind: mergedKind,
      actual: mergedActual,
      forecast: mergedForecast,
      previous: mergedPrevious,
      actualOutcome: mergedActual === '—' ? 'pending' : existing.actualOutcome,
      sourceProvider: Array.from(providers).join('+'),
    });
  };

  // 1. Ingest BiQuote events (54 countries, full -2d to +14d + upcoming)
  const biQuoteRaw: RawBiQuoteEvent[] = [];
  if (biSlicesRes.status === 'fulfilled') {
    for (const sliceResult of biSlicesRes.value) {
      if (sliceResult.status === 'fulfilled') {
        biQuoteRaw.push(...extractBiQuoteArray(sliceResult.value));
      }
    }
  }

  for (const raw of biQuoteRaw) {
    const originalTitle = (raw.name || raw.title || '').trim();
    const rawTime = (raw.time || raw.date || '').trim();
    if (!originalTitle || !rawTime) continue;

    const bkk = toBangkokDateParts(rawTime);
    if (!bkk) continue;
    // Keep strictly within -2d .. +14d Bangkok window
    if (bkk.dateIso < fromIso || bkk.dateIso > toIso) continue;

    const meta = resolveCountryCurrencyMeta(raw.countryCode || raw.country, raw.currency);
    const eventKind = classifyEventKind(originalTitle, raw.type);
    const isAllDay =
      eventKind === 'holiday' ||
      (typeof raw.timeMode === 'string' &&
        raw.timeMode.trim().length > 0 &&
        raw.timeMode.toLowerCase() !== 'exact');

    const impact =
      eventKind === 'holiday'
        ? 1
        : mapImpactLevel(raw.importance ?? raw.impact);

    const actual = formatBiQuoteValue(raw.actual, raw.unit, raw.multiplier);
    const forecast = formatBiQuoteValue(raw.forecast, raw.unit, raw.multiplier);
    const previous = formatBiQuoteValue(
      raw.revisedPrevious ?? raw.previous,
      raw.unit,
      raw.multiplier
    );

    const translatedTitle = translateEconomicTitleTh(
      originalTitle,
      meta.countryNameTh,
      meta.currency
    );

    const dedupKey = `${bkk.dateIso}|${meta.currency}|${normalizeTitleForDedup(originalTitle)}`;
    const stableId = `bq-${bkk.dateIso}-${meta.countryCode}-${dedup.size}`;
    const timeLabel = isAllDay ? 'ตลอดวัน' : bkk.timeLabelTh;

    const kindDesc =
      eventKind === 'holiday'
        ? 'วันหยุดตลาด/ธนาคาร'
        : eventKind === 'meeting'
        ? 'การประชุมสำคัญ'
        : eventKind === 'speech'
        ? 'แถลงการณ์สำคัญ'
        : eventKind === 'election'
        ? 'การเลือกตั้ง'
        : impact === 3
        ? 'ตัวเลขเศรษฐกิจสำคัญสูง'
        : impact === 2
        ? 'ตัวเลขเศรษฐกิจสำคัญกลาง'
        : 'ตัวเลขเศรษฐกิจทั่วไป';

    upsertCalendarEvent(
      {
        id: stableId,
        date: bkk.dateIso,
        time: timeLabel,
        eventTimestampIso: bkk.isoUtc,
        originalTitle,
        sourceProvider: 'BiQuote',
        eventKind,
        isAllDay,
        countryCode: meta.countryCode,
        flag: meta.flag,
        currency: meta.currency,
        countryNameTh: meta.countryNameTh,
        impact,
        category: 'economic',
        title: translatedTitle,
        actual,
        forecast,
        previous,
        actualOutcome: actual === '—' ? 'pending' : 'inline',
        relatedAssets: meta.defaultAssets,
        macroTags: inferCalendarMacroTags(meta.currency, originalTitle, meta.baseMacroTags),
        descriptionTh: `${kindDesc} ${meta.countryNameTh} (${meta.currency}) · เวลาไทย ${timeLabel}`,
        isLiveSynced: true,
      },
      dedupKey
    );
  }

  // 2. Ingest ForexFactory JSON (thisweek + nextweek) & XML (Holiday, OPEC, G7, live Actual)
  if (ffBundleRes.status === 'fulfilled') {
    const { thisWeekJson, nextWeekJson, thisWeekXml } = ffBundleRes.value;
    const ffItems: Array<RawForexFactoryEvent & { isAllDay?: boolean }> = [
      ...(Array.isArray(thisWeekJson) ? thisWeekJson : []),
      ...(Array.isArray(nextWeekJson) ? nextWeekJson : []),
      ...(typeof thisWeekXml === 'string' && thisWeekXml.includes('<event')
        ? parseForexFactoryXmlEvents(thisWeekXml)
        : []),
    ];

    for (const raw of ffItems) {
      const originalTitle = typeof raw.title === 'string' ? raw.title.trim() : '';
      const rawDate = typeof raw.date === 'string' ? raw.date.trim() : '';
      if (!originalTitle || !rawDate) continue;

      const bkk = toBangkokDateParts(rawDate);
      if (!bkk) continue;
      if (bkk.dateIso < fromIso || bkk.dateIso > toIso) continue;

      const meta = resolveCountryCurrencyMeta(raw.country, raw.country);
      const rawImpactStr = (raw.impact || '').trim();
      const eventKind = classifyEventKind(
        originalTitle,
        rawImpactStr.toLowerCase() === 'holiday' ? 'holiday' : undefined
      );

      // ForexFactory marks holidays or all-day OPEC/G7 events with 00:00 placeholder or XML All Day
      const isAllDay =
        Boolean(raw.isAllDay) ||
        eventKind === 'holiday' ||
        (eventKind === 'meeting' && (bkk.time24 === '07:00' || bkk.time24 === '00:00'));

      const impact: ImpactLevel =
        eventKind === 'holiday'
          ? 1
          : eventKind === 'meeting' && originalTitle.toLowerCase().includes('opec')
          ? 3
          : mapImpactLevel(rawImpactStr);

      const forecast =
        typeof raw.forecast === 'string' && raw.forecast.trim() ? raw.forecast.trim() : '—';
      const previous =
        typeof raw.previous === 'string' && raw.previous.trim() ? raw.previous.trim() : '—';
      const actual =
        typeof raw.actual === 'string' && raw.actual.trim() ? raw.actual.trim() : '—';

      const translatedTitle = translateEconomicTitleTh(
        originalTitle,
        meta.countryNameTh,
        meta.currency
      );
      const timeLabel = isAllDay ? 'ตลอดวัน' : bkk.timeLabelTh;
      const dedupKey = `${bkk.dateIso}|${meta.currency}|${normalizeTitleForDedup(originalTitle)}`;
      const stableId = `ff-${bkk.dateIso}-${bkk.time24.replace(':', '')}-${meta.currency}-${dedup.size}`;

      const kindDesc =
        eventKind === 'holiday'
          ? 'วันหยุดตลาด/ธนาคาร'
          : eventKind === 'meeting'
          ? 'การประชุมพิเศษ'
          : eventKind === 'speech'
          ? 'แถลงการณ์สำคัญ'
          : eventKind === 'election'
          ? 'การเลือกตั้ง'
          : impact === 3
          ? 'ตัวเลขเศรษฐกิจสำคัญสูง'
          : impact === 2
          ? 'ตัวเลขเศรษฐกิจสำคัญกลาง'
          : 'ตัวเลขเศรษฐกิจทั่วไป';

      upsertCalendarEvent(
        {
          id: stableId,
          date: bkk.dateIso,
          time: timeLabel,
          eventTimestampIso: bkk.isoUtc,
          originalTitle,
          sourceProvider: 'ForexFactory',
          eventKind,
          isAllDay,
          countryCode: meta.countryCode,
          flag: meta.flag,
          currency: meta.currency,
          countryNameTh: meta.countryNameTh,
          impact,
          category: 'economic',
          title: translatedTitle,
          actual,
          forecast,
          previous,
          actualOutcome: actual === '—' ? 'pending' : 'inline',
          relatedAssets: meta.defaultAssets,
          macroTags: inferCalendarMacroTags(meta.currency, originalTitle, meta.baseMacroTags),
          descriptionTh: `${kindDesc} ${meta.countryNameTh} (${meta.currency}) · เวลาไทย ${timeLabel}`,
          isLiveSynced: true,
        },
        dedupKey
      );
    }
  }

  const events = Array.from(dedup.values()).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    // Within the same day: pin all-day holidays/meetings first, then sort chronologically UTC+7
    if (Boolean(a.isAllDay) !== Boolean(b.isAllDay)) {
      return a.isAllDay ? -1 : 1;
    }
    const aMs = a.eventTimestampIso ? Date.parse(a.eventTimestampIso) : 0;
    const bMs = b.eventTimestampIso ? Date.parse(b.eventTimestampIso) : 0;
    if (aMs && bMs && aMs !== bMs) return aMs - bMs;
    return a.time.localeCompare(b.time);
  });

  if (events.length > 0) {
    unifiedCalendarCache = {
      events,
      fetchedAt: Date.now(),
      expiresAt: Date.now() + CALENDAR_CACHE_TTL_MS,
    };
    return events;
  }

  if (unifiedCalendarCache && unifiedCalendarCache.events.length > 0) {
    return unifiedCalendarCache.events;
  }

  return [];
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
