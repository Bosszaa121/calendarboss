import { ASSET_CATALOG } from '../data/assetCatalog';
import { CalendarEvent, DateTabKey, NewsItem, PortfolioAsset } from '../types';

function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9./-]/g, '');
}

/**
 * Returns a Set of normalized ticker tokens + known aliases for the user's portfolio.
 */
export function buildPortfolioSymbolMap(portfolio: PortfolioAsset[]): Map<string, string> {
  // Maps normalized token -> canonical symbol in user's portfolio
  const map = new Map<string, string>();
  for (const item of portfolio) {
    const canon = item.symbol.toUpperCase();
    const norm = normalizeSymbol(canon);
    map.set(norm, canon);

    // Strip .BK suffix for Thai stocks so "PTT" matches "PTT.BK"
    if (norm.endsWith('.BK')) {
      map.set(norm.replace(/\.BK$/, ''), canon);
    }

    // Strip slashes so "USDTHB" matches "USD/THB"
    if (norm.includes('/')) {
      map.set(norm.replace(/\//g, ''), canon);
    }

    // Check catalog aliases
    const catalogMatch = ASSET_CATALOG.find(
      (c) => normalizeSymbol(c.symbol) === norm
    );
    if (catalogMatch?.aliases) {
      for (const alias of catalogMatch.aliases) {
        map.set(normalizeSymbol(alias), canon);
      }
    }
  }
  return map;
}

export function getMatchedPortfolioSymbols(
  relatedAssets: string[],
  portfolioMap: Map<string, string>
): string[] {
  const matched = new Set<string>();
  for (const raw of relatedAssets) {
    const norm = normalizeSymbol(raw);
    const noSlash = norm.replace(/\//g, '');
    const noBk = norm.replace(/\.BK$/, '');

    const hit =
      portfolioMap.get(norm) ||
      portfolioMap.get(noSlash) ||
      portfolioMap.get(noBk);

    if (hit) {
      matched.add(hit);
    }
  }
  return Array.from(matched);
}

export function isAssetTagMatched(
  assetTag: string,
  portfolioMap: Map<string, string>
): boolean {
  const norm = normalizeSymbol(assetTag);
  return (
    portfolioMap.has(norm) ||
    portfolioMap.has(norm.replace(/\//g, '')) ||
    portfolioMap.has(norm.replace(/\.BK$/, ''))
  );
}

export function getOffsetDateIso(dayOffset: number): string {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(target.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDayDiffFromToday(isoDate: string): number {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return 0;
  const target = new Date(parts[0], parts[1] - 1, parts[2]);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function matchesDateTab(isoDate: string, tab: DateTabKey): boolean {
  const diff = getDayDiffFromToday(isoDate);
  switch (tab) {
    case 'yesterday':
      return diff === -1;
    case 'today':
      return diff === 0;
    case 'tomorrow':
      return diff === 1;
    case 'this_week':
      return diff >= 0 && diff <= 6;
    case 'next_week':
      return diff >= 7 && diff <= 14;
    default:
      return true;
  }
}

const THAI_MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

const THAI_DAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

export function formatThaiShortDate(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return isoDate;
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  const dayName = THAI_DAYS_SHORT[dateObj.getDay()];
  const dayNum = dateObj.getDate();
  const monthName = THAI_MONTHS_SHORT[dateObj.getMonth()];
  return `${dayName} ${dayNum} ${monthName}`;
}

export function getFearGreedLabelTh(value: number): string {
  if (value <= 24) return 'กลัวสุดขีด (Extreme Fear)';
  if (value <= 44) return 'กลัว (Fear)';
  if (value <= 55) return 'เป็นกลาง (Neutral)';
  if (value <= 74) return 'โลภ (Greed)';
  return 'โลภสุดขีด (Extreme Greed)';
}

export interface AssetAlertSummary {
  earningsCount: number;
  dividendCount: number;
  economicCount: number;
  newsCount: number;
  nextEventTitle?: string;
  nextEventDate?: string;
  nextEventCategory?: 'economic' | 'earnings' | 'dividend';
}

export function getAlertsForAsset(
  symbol: string,
  calendarEvents: CalendarEvent[],
  newsItems: NewsItem[]
): AssetAlertSummary {
  const singleMap = buildPortfolioSymbolMap([
    {
      id: symbol,
      symbol,
      name: symbol,
      category: 'Stock',
      market: '',
      flag: '',
      currency: '',
      addedAt: '',
    },
  ]);

  const upcomingEvents = calendarEvents
    .filter((ev) => getDayDiffFromToday(ev.date) >= 0 && getDayDiffFromToday(ev.date) <= 14)
    .filter((ev) => getMatchedPortfolioSymbols(ev.relatedAssets, singleMap).length > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const earningsCount = upcomingEvents.filter((e) => e.category === 'earnings').length;
  const dividendCount = upcomingEvents.filter((e) => e.category === 'dividend').length;
  const economicCount = upcomingEvents.filter((e) => e.category === 'economic').length;

  const matchedNews = newsItems.filter(
    (n) => getMatchedPortfolioSymbols(n.relatedAssets, singleMap).length > 0
  );

  // Prioritize earnings/dividend for headline alert
  const priorityEvent =
    upcomingEvents.find((e) => e.category === 'earnings' || e.category === 'dividend') ||
    upcomingEvents[0];

  return {
    earningsCount,
    dividendCount,
    economicCount,
    newsCount: matchedNews.length,
    nextEventTitle: priorityEvent?.title,
    nextEventDate: priorityEvent?.date,
    nextEventCategory: priorityEvent?.category,
  };
}
