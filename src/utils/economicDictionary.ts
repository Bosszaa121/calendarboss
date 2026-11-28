import type { CalendarEventKind, RegionFilterKey } from '../types.ts';

export interface CountryCurrencyMeta {
  countryCode: string;
  currency: string;
  flag: string;
  countryNameTh: string;
  regionGroup: Exclude<RegionFilterKey, 'ALL'> | 'GLOBAL';
  baseMacroTags: string[];
  defaultAssets: string[];
}

export const REGION_FILTER_OPTIONS: Array<{
  key: RegionFilterKey;
  label: string;
}> = [
  { key: 'ALL', label: '🌐 ทั้งหมด' },
  { key: 'US', label: '🇺🇸 สหรัฐฯ (USD)' },
  { key: 'ASIA', label: '🇯🇵🇰🇷🇨🇳 เอเชีย (JPY/KRW/CNY)' },
  { key: 'TH', label: '🇹🇭 ไทย (THB)' },
  { key: 'EUROPE', label: '🇪🇺🇬🇧 ยุโรป (EUR/GBP)' },
  { key: 'ANZ', label: '🇦🇺🇳🇿 ออสฯ/นิวซีแลนด์ (AUD/NZD)' },
];

/**
 * Complete 54+ country dictionary covering BiQuote + ForexFactory economic calendars
 * (includes individual Eurozone economies DE/FR/ES/IT/NL, Asia JP/KR/CN/TH/SG/HK/IN, ANZ, Americas, EMEA).
 */
export const COUNTRY_META_BY_CODE: Record<string, CountryCurrencyMeta> = {
  US: { countryCode: 'US', currency: 'USD', flag: '🇺🇸', countryNameTh: 'สหรัฐฯ', regionGroup: 'US', baseMacroTags: ['us_rates', 'dxy'], defaultAssets: ['QQQM', 'SPY', 'GLD', 'DXY'] },
  TH: { countryCode: 'TH', currency: 'THB', flag: '🇹🇭', countryNameTh: 'ไทย', regionGroup: 'TH', baseMacroTags: ['thai_macro', 'bot_rate', 'usd_thb'], defaultAssets: ['SET', 'USD/THB'] },
  JP: { countryCode: 'JP', currency: 'JPY', flag: '🇯🇵', countryNameTh: 'ญี่ปุ่น', regionGroup: 'ASIA', baseMacroTags: ['boj_jpy'], defaultAssets: ['USD/JPY', 'QQQM'] },
  KR: { countryCode: 'KR', currency: 'KRW', flag: '🇰🇷', countryNameTh: 'เกาหลีใต้', regionGroup: 'ASIA', baseMacroTags: ['china_macro', 'ai_chips'], defaultAssets: ['SMH', 'USD/KRW'] },
  CN: { countryCode: 'CN', currency: 'CNY', flag: '🇨🇳', countryNameTh: 'จีน', regionGroup: 'ASIA', baseMacroTags: ['china_macro'], defaultAssets: ['GLD', 'SLV', 'COPPER'] },
  HK: { countryCode: 'HK', currency: 'HKD', flag: '🇭🇰', countryNameTh: 'ฮ่องกง', regionGroup: 'ASIA', baseMacroTags: ['china_macro'], defaultAssets: ['HSI', 'CNY'] },
  SG: { countryCode: 'SG', currency: 'SGD', flag: '🇸🇬', countryNameTh: 'สิงคโปร์', regionGroup: 'ASIA', baseMacroTags: ['china_macro'], defaultAssets: ['USD/SGD'] },
  IN: { countryCode: 'IN', currency: 'INR', flag: '🇮🇳', countryNameTh: 'อินเดีย', regionGroup: 'ASIA', baseMacroTags: ['precious_metals'], defaultAssets: ['GLD', 'USD/INR'] },
  TW: { countryCode: 'TW', currency: 'TWD', flag: '🇹🇼', countryNameTh: 'ไต้หวัน', regionGroup: 'ASIA', baseMacroTags: ['ai_chips'], defaultAssets: ['SMH', 'TSM'] },
  ID: { countryCode: 'ID', currency: 'IDR', flag: '🇮🇩', countryNameTh: 'อินโดนีเซีย', regionGroup: 'ASIA', baseMacroTags: ['china_macro'], defaultAssets: ['USD/IDR'] },
  MY: { countryCode: 'MY', currency: 'MYR', flag: '🇲🇾', countryNameTh: 'มาเลเซีย', regionGroup: 'ASIA', baseMacroTags: ['china_macro'], defaultAssets: ['USD/MYR'] },
  VN: { countryCode: 'VN', currency: 'VND', flag: '🇻🇳', countryNameTh: 'เวียดนาม', regionGroup: 'ASIA', baseMacroTags: ['china_macro'], defaultAssets: ['USD/VND'] },
  PH: { countryCode: 'PH', currency: 'PHP', flag: '🇵🇭', countryNameTh: 'ฟิลิปปินส์', regionGroup: 'ASIA', baseMacroTags: ['china_macro'], defaultAssets: ['USD/PHP'] },
  EU: { countryCode: 'EU', currency: 'EUR', flag: '🇪🇺', countryNameTh: 'ยูโรโซน', regionGroup: 'EUROPE', baseMacroTags: ['eu_macro'], defaultAssets: ['EUR/USD', 'DXY'] },
  EZ: { countryCode: 'EU', currency: 'EUR', flag: '🇪🇺', countryNameTh: 'ยูโรโซน', regionGroup: 'EUROPE', baseMacroTags: ['eu_macro'], defaultAssets: ['EUR/USD', 'DXY'] },
  DE: { countryCode: 'DE', currency: 'EUR', flag: '🇩🇪', countryNameTh: 'เยอรมนี', regionGroup: 'EUROPE', baseMacroTags: ['eu_macro'], defaultAssets: ['EUR/USD', 'DXY'] },
  FR: { countryCode: 'FR', currency: 'EUR', flag: '🇫🇷', countryNameTh: 'ฝรั่งเศส', regionGroup: 'EUROPE', baseMacroTags: ['eu_macro'], defaultAssets: ['EUR/USD', 'DXY'] },
  ES: { countryCode: 'ES', currency: 'EUR', flag: '🇪🇸', countryNameTh: 'สเปน', regionGroup: 'EUROPE', baseMacroTags: ['eu_macro'], defaultAssets: ['EUR/USD', 'DXY'] },
  IT: { countryCode: 'IT', currency: 'EUR', flag: '🇮🇹', countryNameTh: 'อิตาลี', regionGroup: 'EUROPE', baseMacroTags: ['eu_macro'], defaultAssets: ['EUR/USD', 'DXY'] },
  NL: { countryCode: 'NL', currency: 'EUR', flag: '🇳🇱', countryNameTh: 'เนเธอร์แลนด์', regionGroup: 'EUROPE', baseMacroTags: ['eu_macro'], defaultAssets: ['EUR/USD'] },
  BE: { countryCode: 'BE', currency: 'EUR', flag: '🇧🇪', countryNameTh: 'เบลเยียม', regionGroup: 'EUROPE', baseMacroTags: ['eu_macro'], defaultAssets: ['EUR/USD'] },
  AT: { countryCode: 'AT', currency: 'EUR', flag: '🇦🇹', countryNameTh: 'ออสเตรีย', regionGroup: 'EUROPE', baseMacroTags: ['eu_macro'], defaultAssets: ['EUR/USD'] },
  PT: { countryCode: 'PT', currency: 'EUR', flag: '🇵🇹', countryNameTh: 'โปรตุเกส', regionGroup: 'EUROPE', baseMacroTags: ['eu_macro'], defaultAssets: ['EUR/USD'] },
  IE: { countryCode: 'IE', currency: 'EUR', flag: '🇮🇪', countryNameTh: 'ไอร์แลนด์', regionGroup: 'EUROPE', baseMacroTags: ['eu_macro'], defaultAssets: ['EUR/USD'] },
  FI: { countryCode: 'FI', currency: 'EUR', flag: '🇫🇮', countryNameTh: 'ฟินแลนด์', regionGroup: 'EUROPE', baseMacroTags: ['eu_macro'], defaultAssets: ['EUR/USD'] },
  GR: { countryCode: 'GR', currency: 'EUR', flag: '🇬🇷', countryNameTh: 'กรีซ', regionGroup: 'EUROPE', baseMacroTags: ['eu_macro'], defaultAssets: ['EUR/USD'] },
  GB: { countryCode: 'GB', currency: 'GBP', flag: '🇬🇧', countryNameTh: 'อังกฤษ', regionGroup: 'EUROPE', baseMacroTags: ['uk_macro'], defaultAssets: ['GBP/USD', 'DXY'] },
  UK: { countryCode: 'GB', currency: 'GBP', flag: '🇬🇧', countryNameTh: 'อังกฤษ', regionGroup: 'EUROPE', baseMacroTags: ['uk_macro'], defaultAssets: ['GBP/USD', 'DXY'] },
  CH: { countryCode: 'CH', currency: 'CHF', flag: '🇨🇭', countryNameTh: 'สวิตเซอร์แลนด์', regionGroup: 'EUROPE', baseMacroTags: ['eu_macro', 'precious_metals'], defaultAssets: ['GLD', 'USD/CHF'] },
  SE: { countryCode: 'SE', currency: 'SEK', flag: '🇸🇪', countryNameTh: 'สวีเดน', regionGroup: 'EUROPE', baseMacroTags: ['eu_macro'], defaultAssets: ['EUR/USD'] },
  NO: { countryCode: 'NO', currency: 'NOK', flag: '🇳🇴', countryNameTh: 'นอร์เวย์', regionGroup: 'EUROPE', baseMacroTags: ['oil_commodity', 'eu_macro'], defaultAssets: ['WTI', 'EUR/USD'] },
  DK: { countryCode: 'DK', currency: 'DKK', flag: '🇩🇰', countryNameTh: 'เดนมาร์ก', regionGroup: 'EUROPE', baseMacroTags: ['eu_macro'], defaultAssets: ['EUR/USD'] },
  PL: { countryCode: 'PL', currency: 'PLN', flag: '🇵🇱', countryNameTh: 'โปแลนด์', regionGroup: 'EUROPE', baseMacroTags: ['eu_macro'], defaultAssets: ['EUR/USD'] },
  CZ: { countryCode: 'CZ', currency: 'CZK', flag: '🇨🇿', countryNameTh: 'เช็ก', regionGroup: 'EUROPE', baseMacroTags: ['eu_macro'], defaultAssets: ['EUR/USD'] },
  HU: { countryCode: 'HU', currency: 'HUF', flag: '🇭🇺', countryNameTh: 'ฮังการี', regionGroup: 'EUROPE', baseMacroTags: ['eu_macro'], defaultAssets: ['EUR/USD'] },
  RO: { countryCode: 'RO', currency: 'RON', flag: '🇷🇴', countryNameTh: 'โรมาเนีย', regionGroup: 'EUROPE', baseMacroTags: ['eu_macro'], defaultAssets: ['EUR/USD'] },
  TR: { countryCode: 'TR', currency: 'TRY', flag: '🇹🇷', countryNameTh: 'ตุรกี', regionGroup: 'EUROPE', baseMacroTags: ['eu_macro'], defaultAssets: ['GLD'] },
  RU: { countryCode: 'RU', currency: 'RUB', flag: '🇷🇺', countryNameTh: 'รัสเซีย', regionGroup: 'EUROPE', baseMacroTags: ['oil_commodity'], defaultAssets: ['WTI', 'GLD'] },
  UA: { countryCode: 'UA', currency: 'UAH', flag: '🇺🇦', countryNameTh: 'ยูเครน', regionGroup: 'EUROPE', baseMacroTags: ['oil_commodity'], defaultAssets: ['GLD'] },
  AU: { countryCode: 'AU', currency: 'AUD', flag: '🇦🇺', countryNameTh: 'ออสเตรเลีย', regionGroup: 'ANZ', baseMacroTags: ['china_demand', 'precious_metals'], defaultAssets: ['AUD/USD', 'GLD', 'COPPER'] },
  NZ: { countryCode: 'NZ', currency: 'NZD', flag: '🇳🇿', countryNameTh: 'นิวซีแลนด์', regionGroup: 'ANZ', baseMacroTags: ['food_dairy'], defaultAssets: ['NZD/USD', 'KCG'] },
  CA: { countryCode: 'CA', currency: 'CAD', flag: '🇨🇦', countryNameTh: 'แคนาดา', regionGroup: 'GLOBAL', baseMacroTags: ['oil_commodity'], defaultAssets: ['WTI', 'USD/CAD'] },
  BR: { countryCode: 'BR', currency: 'BRL', flag: '🇧🇷', countryNameTh: 'บราซิล', regionGroup: 'GLOBAL', baseMacroTags: ['oil_commodity'], defaultAssets: ['COPPER', 'WTI'] },
  MX: { countryCode: 'MX', currency: 'MXN', flag: '🇲🇽', countryNameTh: 'เม็กซิโก', regionGroup: 'GLOBAL', baseMacroTags: ['precious_metals'], defaultAssets: ['SLV', 'USD/MXN'] },
  CL: { countryCode: 'CL', currency: 'CLP', flag: '🇨🇱', countryNameTh: 'ชิลี', regionGroup: 'GLOBAL', baseMacroTags: ['oil_commodity'], defaultAssets: ['COPPER'] },
  CO: { countryCode: 'CO', currency: 'COP', flag: '🇨🇴', countryNameTh: 'โคลอมเบีย', regionGroup: 'GLOBAL', baseMacroTags: ['oil_commodity'], defaultAssets: ['WTI'] },
  PE: { countryCode: 'PE', currency: 'PEN', flag: '🇵🇪', countryNameTh: 'เปรู', regionGroup: 'GLOBAL', baseMacroTags: ['precious_metals'], defaultAssets: ['COPPER', 'SLV'] },
  AR: { countryCode: 'AR', currency: 'ARS', flag: '🇦🇷', countryNameTh: 'อาร์เจนตินา', regionGroup: 'GLOBAL', baseMacroTags: ['us_rates'], defaultAssets: ['DXY'] },
  ZA: { countryCode: 'ZA', currency: 'ZAR', flag: '🇿🇦', countryNameTh: 'แอฟริกาใต้', regionGroup: 'GLOBAL', baseMacroTags: ['precious_metals'], defaultAssets: ['GLD'] },
  SA: { countryCode: 'SA', currency: 'SAR', flag: '🇸🇦', countryNameTh: 'ซาอุดีอาระเบีย', regionGroup: 'GLOBAL', baseMacroTags: ['oil_commodity'], defaultAssets: ['WTI', 'BRENT'] },
  AE: { countryCode: 'AE', currency: 'AED', flag: '🇦🇪', countryNameTh: 'สหรัฐอาหรับเอมิเรตส์', regionGroup: 'GLOBAL', baseMacroTags: ['oil_commodity'], defaultAssets: ['WTI', 'BRENT'] },
  QA: { countryCode: 'QA', currency: 'QAR', flag: '🇶🇦', countryNameTh: 'กาตาร์', regionGroup: 'GLOBAL', baseMacroTags: ['oil_commodity'], defaultAssets: ['WTI'] },
  IL: { countryCode: 'IL', currency: 'ILS', flag: '🇮🇱', countryNameTh: 'อิสราเอล', regionGroup: 'GLOBAL', baseMacroTags: ['oil_commodity'], defaultAssets: ['GLD', 'WTI'] },
  EG: { countryCode: 'EG', currency: 'EGP', flag: '🇪🇬', countryNameTh: 'อียิปต์', regionGroup: 'GLOBAL', baseMacroTags: ['oil_commodity'], defaultAssets: ['WTI'] },
  NG: { countryCode: 'NG', currency: 'NGN', flag: '🇳🇬', countryNameTh: 'ไนจีเรีย', regionGroup: 'GLOBAL', baseMacroTags: ['oil_commodity'], defaultAssets: ['WTI'] },
  WW: { countryCode: 'GLOBAL', currency: 'ALL', flag: '🌍', countryNameTh: 'ทั่วโลก', regionGroup: 'GLOBAL', baseMacroTags: ['oil_commodity', 'us_rates'], defaultAssets: ['WTI', 'GLD', 'DXY'] },
  ALL: { countryCode: 'GLOBAL', currency: 'ALL', flag: '🌍', countryNameTh: 'ทั่วโลก', regionGroup: 'GLOBAL', baseMacroTags: ['oil_commodity', 'us_rates'], defaultAssets: ['WTI', 'GLD', 'DXY'] },
  GLOBAL: { countryCode: 'GLOBAL', currency: 'ALL', flag: '🌍', countryNameTh: 'ทั่วโลก', regionGroup: 'GLOBAL', baseMacroTags: ['oil_commodity', 'us_rates'], defaultAssets: ['WTI', 'GLD', 'DXY'] },
};

const CURRENCY_TO_COUNTRY_CODE: Record<string, string> = {
  USD: 'US',
  THB: 'TH',
  JPY: 'JP',
  KRW: 'KR',
  CNY: 'CN',
  CNH: 'CN',
  HKD: 'HK',
  SGD: 'SG',
  INR: 'IN',
  TWD: 'TW',
  IDR: 'ID',
  MYR: 'MY',
  VND: 'VN',
  PHP: 'PH',
  EUR: 'EU',
  GBP: 'GB',
  CHF: 'CH',
  SEK: 'SE',
  NOK: 'NO',
  DKK: 'DK',
  PLN: 'PL',
  CZK: 'CZ',
  HUF: 'HU',
  RON: 'RO',
  TRY: 'TR',
  RUB: 'RU',
  AUD: 'AU',
  NZD: 'NZ',
  CAD: 'CA',
  BRL: 'BR',
  MXN: 'MX',
  CLP: 'CL',
  COP: 'CO',
  PEN: 'PE',
  ARS: 'AR',
  ZAR: 'ZA',
  SAR: 'SA',
  AED: 'AE',
  ILS: 'IL',
  ALL: 'GLOBAL',
};

export function resolveCountryCurrencyMeta(
  rawCountryCode?: string,
  rawCurrency?: string
): CountryCurrencyMeta {
  const cc = (rawCountryCode || '').trim().toUpperCase();
  const cur = (rawCurrency || '').trim().toUpperCase();

  if (cc && COUNTRY_META_BY_CODE[cc]) {
    const base = COUNTRY_META_BY_CODE[cc];
    return cur && cur !== 'ALL' ? { ...base, currency: cur } : base;
  }

  // ForexFactory passes currency codes like USD, EUR, JPY, AUD, ALL inside `country`
  if (cc && CURRENCY_TO_COUNTRY_CODE[cc]) {
    const mapped = COUNTRY_META_BY_CODE[CURRENCY_TO_COUNTRY_CODE[cc]];
    if (mapped) return mapped;
  }

  if (cur && CURRENCY_TO_COUNTRY_CODE[cur]) {
    const mapped = COUNTRY_META_BY_CODE[CURRENCY_TO_COUNTRY_CODE[cur]];
    if (mapped) return mapped;
  }

  return {
    countryCode: cc || 'GLOBAL',
    currency: cur || cc || 'GLOBAL',
    flag: '🌍',
    countryNameTh: cc || cur || 'ทั่วโลก',
    regionGroup: 'GLOBAL',
    baseMacroTags: ['us_rates'],
    defaultAssets: ['GLD', 'DXY'],
  };
}

const ASIA_COUNTRIES = new Set(['JP', 'KR', 'CN', 'HK', 'SG', 'IN', 'TW', 'ID', 'MY', 'VN', 'PH']);
const ASIA_CURRENCIES = new Set(['JPY', 'KRW', 'CNY', 'CNH', 'HKD', 'SGD', 'INR', 'TWD', 'IDR', 'MYR', 'VND', 'PHP']);
const EUROPE_COUNTRIES = new Set([
  'EU', 'EZ', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'PT', 'IE', 'FI', 'GR',
  'GB', 'UK', 'CH', 'SE', 'NO', 'DK', 'PL', 'CZ', 'HU', 'RO', 'TR', 'RU', 'UA',
]);
const EUROPE_CURRENCIES = new Set(['EUR', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'TRY']);
const ANZ_COUNTRIES = new Set(['AU', 'NZ']);
const ANZ_CURRENCIES = new Set(['AUD', 'NZD']);

export function getRegionGroupForCode(
  countryCode?: string,
  currency?: string
): Exclude<RegionFilterKey, 'ALL'> | 'GLOBAL' {
  const cc = (countryCode || '').trim().toUpperCase();
  const cur = (currency || '').trim().toUpperCase();
  if (cc === 'US' || cur === 'USD') return 'US';
  if (cc === 'TH' || cur === 'THB') return 'TH';
  if (ASIA_COUNTRIES.has(cc) || ASIA_CURRENCIES.has(cur)) return 'ASIA';
  if (EUROPE_COUNTRIES.has(cc) || EUROPE_CURRENCIES.has(cur)) return 'EUROPE';
  if (ANZ_COUNTRIES.has(cc) || ANZ_CURRENCIES.has(cur)) return 'ANZ';
  return 'GLOBAL';
}

export function matchesRegionFilter(
  filter: RegionFilterKey,
  countryCode?: string,
  currency?: string,
  explicitRegionGroup?: string
): boolean {
  if (filter === 'ALL') return true;
  if (explicitRegionGroup && explicitRegionGroup.toUpperCase() === filter) {
    return true;
  }
  return getRegionGroupForCode(countryCode, currency) === filter;
}

/**
 * Classifies calendar entries so Holidays, OPEC/G7 Meetings, Speeches, and Elections
 * are ALWAYS preserved with distinct labels instead of discarded.
 */
export function classifyEventKind(
  title: string,
  rawType?: string
): CalendarEventKind {
  const t = (title || '').toLowerCase();
  const typeLower = (rawType || '').toLowerCase();

  if (
    typeLower === 'holiday' ||
    t.includes('holiday') ||
    t.includes('day off') ||
    t.includes('early close') ||
    t.includes('market closed') ||
    t.includes('bank closed') ||
    t.includes('วันหยุด')
  ) {
    return 'holiday';
  }
  if (
    t.includes('election') ||
    t.includes('referendum') ||
    t.includes('parliamentary vote') ||
    t.includes('presidential vote') ||
    t.includes('เลือกตั้ง')
  ) {
    return 'election';
  }
  if (
    t.includes('opec') ||
    t.includes('g7') ||
    t.includes('g20') ||
    t.includes('summit') ||
    t.includes('meeting') ||
    t.includes('eurogroup') ||
    t.includes('ecofin') ||
    t.includes('conference') ||
    t.includes('symposium') ||
    t.includes('ประชุม')
  ) {
    return 'meeting';
  }
  if (
    t.includes('speech') ||
    t.includes('speaks') ||
    t.includes('testif') ||
    t.includes('remarks') ||
    t.includes('press conference') ||
    t.includes('address') ||
    t.includes('interview') ||
    typeLower === 'event' ||
    t.includes('แถลง')
  ) {
    return 'speech';
  }
  return 'indicator';
}

/**
 * Formats BiQuote numeric values with units/multipliers without turning null into 0.
 */
export function formatBiQuoteValue(
  value: number | string | null | undefined,
  unit?: string | null,
  multiplier?: string | null
): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || '—';
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';

  const unitLower = (unit || '').trim().toLowerCase();
  const multLower = (multiplier || '').trim().toLowerCase();

  let suffix = '';
  if (unitLower === '%' || unitLower === 'percent' || unitLower === 'percentage') {
    suffix = '%';
  } else if (multLower.includes('trillion')) {
    suffix = 'T';
  } else if (multLower.includes('billion')) {
    suffix = 'B';
  } else if (multLower.includes('million')) {
    suffix = 'M';
  } else if (multLower.includes('thousand')) {
    suffix = 'K';
  }

  const formattedNum =
    Math.abs(value) >= 1000 && !suffix
      ? value.toLocaleString('en-US', { maximumFractionDigits: 2 })
      : Number(value.toFixed(2)).toString();

  return `${formattedNum}${suffix}`;
}

/**
 * Zero-AI-Quota Thai Economic Term Dictionary.
 * Translates 75+ macro indicators, central bank events, meetings, and holidays across 54 countries.
 */
const ECONOMIC_TERM_RULES: Array<[RegExp, string]> = [
  [/\bBank Holiday\b/gi, 'วันหยุดธนาคาร'],
  [/\bNational Holiday\b/gi, 'วันหยุดนักขัตฤกษ์'],
  [/\bPublic Holiday\b/gi, 'วันหยุดราชการ'],
  [/\bHoliday\b/gi, 'วันหยุดตลาด'],
  [/\bOPEC\+?\s*JMMC\s*Meetings?\b/gi, 'ประชุมคณะกรรมการ OPEC+ (JMMC)'],
  [/\bOPEC\+?\s*Meetings?\b/gi, 'ประชุมกลุ่ม OPEC+'],
  [/\bG7\s*Meetings?\b/gi, 'ประชุมผู้นำ G7'],
  [/\bG20\s*Meetings?\b/gi, 'ประชุมกลุ่ม G20'],
  [/\bEurogroup\s*Meetings?\b/gi, 'ประชุมรัฐมนตรีคลังยูโรโซน (Eurogroup)'],
  [/\bECOFIN\s*Meetings?\b/gi, 'ประชุมคลังยุโรป (ECOFIN)'],
  [/\bGeneral Election\b/gi, 'การเลือกตั้งทั่วไป'],
  [/\bPresidential Election\b/gi, 'การเลือกตั้งประธานาธิบดี'],
  [/\bElection\b/gi, 'การเลือกตั้ง'],
  [/\bCore\s*CPI\b/gi, 'เงินเฟ้อพื้นฐาน Core CPI'],
  [/\bCPI\b/gi, 'เงินเฟ้อ CPI'],
  [/\bConsumer Price Index\b/gi, 'ดัชนีราคาผู้บริโภค (CPI)'],
  [/\bHarmonised Index of Consumer Prices\b/gi, 'เงินเฟ้อยุโรป (HICP)'],
  [/\bHICP\b/gi, 'เงินเฟ้อยุโรป (HICP)'],
  [/\bCore\s*PCE\s*Price Index\b/gi, 'เงินเฟ้อพื้นฐาน Core PCE'],
  [/\bPCE\s*Price Index\b/gi, 'เงินเฟ้อ PCE'],
  [/\bCore\s*PPI\b/gi, 'ดัชนีราคาผู้ผลิตพื้นฐาน Core PPI'],
  [/\bPPI\b/gi, 'ดัชนีราคาผู้ผลิต PPI'],
  [/\bProducer Price Index\b/gi, 'ดัชนีราคาผู้ผลิต (PPI)'],
  [/\bNon-?Farm\s*(Employment Change|Payrolls)\b/gi, 'การจ้างงานนอกภาคเกษตร (NFP)'],
  [/\bADP\s*Non-?Farm\s*Employment Change\b/gi, 'การจ้างงานภาคเอกชน ADP'],
  [/\bInitial\s*Jobless\s*Claims\b/gi, 'ผู้ขอรับสวัสดิการว่างงานรายสัปดาห์'],
  [/\bContinuing\s*Jobless\s*Claims\b/gi, 'ผู้รับสวัสดิการว่างงานต่อเนื่อง'],
  [/\bUnemployment\s*Claims\b/gi, 'ผู้ขอรับสวัสดิการว่างงาน'],
  [/\bUnemployment\s*Rate\b/gi, 'อัตราว่างงาน'],
  [/\bUnemployment\s*Change\b/gi, 'การเปลี่ยนแปลงผู้ว่างงาน'],
  [/\bUnemployment\b/gi, 'อัตราว่างงาน'],
  [/\bEmployment\s*Change\b/gi, 'การเปลี่ยนแปลงการจ้างงาน'],
  [/\bJOLTS\s*Job\s*Openings\b/gi, 'ตำแหน่งงานว่างเปิดรับ (JOLTS)'],
  [/\bAverage\s*Hourly\s*Earnings\b/gi, 'รายได้เฉลี่ยต่อชั่วโมง'],
  [/\bCore\s*Retail\s*Sales\b/gi, 'ยอดขายปลีกพื้นฐาน'],
  [/\bRetail\s*Sales\b/gi, 'ยอดขายปลีก'],
  [/\bIndustrial\s*Production\b/gi, 'ดัชนีการผลิตภาคอุตสาหกรรม'],
  [/\bIndustrial\s*Output\b/gi, 'ผลผลิตภาคอุตสาหกรรม'],
  [/\bManufacturing\s*Production\b/gi, 'การผลิตภาคอุตสาหกรรม'],
  [/\bISM\s*Manufacturing\s*PMI\b/gi, 'ดัชนี ISM PMI ภาคการผลิต'],
  [/\bISM\s*Services\s*PMI\b/gi, 'ดัชนี ISM PMI ภาคบริการ'],
  [/\bComposite\s*PMI\b/gi, 'ดัชนี PMI รวม'],
  [/\bManufacturing\s*PMI\b/gi, 'ดัชนี PMI ภาคการผลิต'],
  [/\bServices\s*PMI\b/gi, 'ดัชนี PMI ภาคบริการ'],
  [/\bConstruction\s*PMI\b/gi, 'ดัชนี PMI ภาคก่อสร้าง'],
  [/\bPMI\b/gi, 'ดัชนี PMI'],
  [/\bGDP\s*Price\s*Index\b/gi, 'ดัชนีราคา GDP'],
  [/\bGDP\b/gi, 'จีดีพี (GDP)'],
  [/\bGross\s*Domestic\s*Product\b/gi, 'จีดีพี (GDP)'],
  [/\bInterest\s*Rate\s*Decision\b/gi, 'มติอัตราดอกเบี้ย'],
  [/\bFederal\s*Funds\s*Rate\b/gi, 'มติอัตราดอกเบี้ยเฟด (Fed)'],
  [/\bMonetary\s*Policy\s*Statement\b/gi, 'แถลงการณ์นโยบายการเงิน'],
  [/\bMonetary\s*Policy\s*Meeting\s*Minutes\b/gi, 'รายงานประชุมนโยบายการเงิน'],
  [/\bFOMC\s*Meeting\s*Minutes\b/gi, 'รายงานประชุมเฟด (FOMC Minutes)'],
  [/\bFOMC\s*Statement\b/gi, 'แถลงการณ์เฟด (FOMC)'],
  [/\bPress\s*Conference\b/gi, 'แถลงข่าวหลังประชุม'],
  [/\bTrade\s*Balance\b/gi, 'ดุลการค้า'],
  [/\bBalance\s*of\s*Trade\b/gi, 'ดุลการค้า'],
  [/\bCurrent\s*Account\b/gi, 'ดุลบัญชีเดินสะพัด'],
  [/\bExports\b/gi, 'ยอดส่งออก'],
  [/\bImports\b/gi, 'ยอดนำเข้า'],
  [/\bConsumer\s*Confidence\b/gi, 'ดัชนีความเชื่อมั่นผู้บริโภค'],
  [/\bConsumer\s*Sentiment\b/gi, 'ดัชนีความเชื่อมั่นผู้บริโภค'],
  [/\bBusiness\s*Confidence\b/gi, 'ดัชนีความเชื่อมั่นภาคธุรกิจ'],
  [/\bBusiness\s*Climate\b/gi, 'ดัชนีบรรยากาศทางธุรกิจ'],
  [/\bEconomic\s*Sentiment\b/gi, 'ดัชนีความเชื่อมั่นทางเศรษฐกิจ'],
  [/\bDurable\s*Goods\s*Orders\b/gi, 'ยอดสั่งซื้อสินค้าคงทน'],
  [/\bFactory\s*Orders\b/gi, 'ยอดสั่งซื้อภาคโรงงาน'],
  [/\bHousing\s*Starts\b/gi, 'ยอดเริ่มสร้างบ้านใหม่'],
  [/\bBuilding\s*Permits\b/gi, 'ยอดใบอนุญาตก่อสร้าง'],
  [/\bExisting\s*Home\s*Sales\b/gi, 'ยอดขายบ้านมือสอง'],
  [/\bNew\s*Home\s*Sales\b/gi, 'ยอดขายบ้านใหม่'],
  [/\bPending\s*Home\s*Sales\b/gi, 'ยอดทำสัญญาซื้อบ้านรอปิดการขาย'],
  [/\bCrude\s*Oil\s*Inventories\b/gi, 'สต็อกน้ำมันดิบ'],
  [/\bNatural\s*Gas\s*Storage\b/gi, 'สต็อกก๊าซธรรมชาติ'],
  [/\bGDT\s*Price\s*Index\b/gi, 'ดัชนีราคานมโลก (GDT)'],
  [/\bBond\s*Auction\b/gi, 'ประมูลพันธบัตร'],
  [/\bBill\s*Auction\b/gi, 'ประมูลตั๋วเงินคลัง'],
  [/\bNote\s*Auction\b/gi, 'ประมูลพันธบัตร'],
  [/\bSpeaks\b/gi, 'กล่าวแถลงการณ์'],
  [/\bSpeech\b/gi, 'กล่าวแถลงการณ์'],
  [/\bTestifies\b/gi, 'เข้าแถลงต่อสภา'],
  [/\bMinutes\b/gi, 'รายงานการประชุม'],
  [/\bInflation\s*Rate\b/gi, 'อัตราเงินเฟ้อ'],
  [/\bInflation\s*Expectations\b/gi, 'คาดการณ์เงินเฟ้อ'],
  [/\bHousehold\s*Spending\b/gi, 'การใช้จ่ายภาคครัวเรือน'],
  [/\bPersonal\s*Spending\b/gi, 'การใช้จ่ายส่วนบุคคล'],
  [/\bPersonal\s*Income\b/gi, 'รายได้ส่วนบุคคล'],
  [/\bForeign\s*Exchange\s*Reserves\b/gi, 'ทุนสำรองระหว่างประเทศ'],
  [/\bFX\s*Reserves\b/gi, 'ทุนสำรองระหว่างประเทศ'],
  [/\bMoney\s*Supply\b/gi, 'ปริมาณเงินหมุนเวียน'],
  [/\bNew\s*Loans\b/gi, 'ยอดปล่อยสินเชื่อใหม่'],
  [/\bFlash\b/gi, 'เบื้องต้น'],
  [/\bFinal\b/gi, 'ฉบับสมบูรณ์'],
  [/\bPrelim\b/gi, 'เบื้องต้น'],
  [/\bRevised\b/gi, 'ทบทวน'],
];

export function translateEconomicTitleTh(
  originalTitle: string,
  countryNameTh: string,
  currency: string
): string {
  const clean = (originalTitle || '').trim();
  if (!clean) return `ตัวเลขเศรษฐกิจ${countryNameTh} (${currency})`;

  // Already Thai
  if (/[\u0E00-\u0E7F]/.test(clean)) return clean;

  let translated = clean;
  let matchedAny = false;

  for (const [pattern, replacement] of ECONOMIC_TERM_RULES) {
    if (pattern.test(translated)) {
      matchedAny = true;
      translated = translated.replace(pattern, replacement);
    }
    pattern.lastIndex = 0;
  }

  translated = translated
    .replace(/\bm\/m\b/gi, 'รายเดือน (m/m)')
    .replace(/\by\/y\b/gi, 'รายปี (y/y)')
    .replace(/\bq\/q\b/gi, 'รายไตรมาส (q/q)')
    .replace(/\bMoM\b/g, 'รายเดือน (m/m)')
    .replace(/\bYoY\b/g, 'รายปี (y/y)')
    .replace(/\bQoQ\b/g, 'รายไตรมาส (q/q)')
    .replace(/\s+/g, ' ')
    .trim();

  if (!matchedAny) {
    return `${clean} — ${countryNameTh} (${currency})`;
  }

  // Ensure country context is clear if not already inside title
  if (
    countryNameTh &&
    countryNameTh !== 'ทั่วโลก' &&
    !translated.includes(countryNameTh)
  ) {
    return `${translated} (${countryNameTh})`;
  }
  return translated;
}

/**
 * Infers accurate country flag, currency code, and region group for every global RSS news item.
 */
export function inferNewsRegionMeta(
  title: string,
  source: string,
  feedHint: string
): {
  countryCode: string;
  currency: string;
  countryFlag: string;
  regionGroup: Exclude<RegionFilterKey, 'ALL'> | 'GLOBAL';
} {
  const text = `${title} ${source}`.toLowerCase();

  if (
    /[\u0E00-\u0E7F]/.test(title) ||
    text.includes('thailand') ||
    text.includes('thai ') ||
    text.includes('baht') ||
    text.includes('thb') ||
    text.includes('กนง') ||
    text.includes('ธปท') ||
    text.includes('หุ้นไทย') ||
    text.includes('set index')
  ) {
    return { countryCode: 'TH', currency: 'THB', countryFlag: '🇹🇭', regionGroup: 'TH' };
  }
  if (
    text.includes('japan') ||
    text.includes('boj') ||
    text.includes('yen') ||
    text.includes('nikkei') ||
    text.includes('jpy') ||
    text.includes('tokyo')
  ) {
    return { countryCode: 'JP', currency: 'JPY', countryFlag: '🇯🇵', regionGroup: 'ASIA' };
  }
  if (
    text.includes('korea') ||
    text.includes('kospi') ||
    text.includes('won') ||
    text.includes('krw') ||
    text.includes('bank of korea') ||
    text.includes('samsung') ||
    text.includes('sk hynix')
  ) {
    return { countryCode: 'KR', currency: 'KRW', countryFlag: '🇰🇷', regionGroup: 'ASIA' };
  }
  if (
    text.includes('china') ||
    text.includes('chinese') ||
    text.includes('pboc') ||
    text.includes('yuan') ||
    text.includes('cny') ||
    text.includes('beijing') ||
    text.includes('shanghai') ||
    text.includes('hong kong') ||
    text.includes('hang seng')
  ) {
    return { countryCode: 'CN', currency: 'CNY', countryFlag: '🇨🇳', regionGroup: 'ASIA' };
  }
  if (
    text.includes('australia') ||
    text.includes('rba') ||
    text.includes('aud') ||
    text.includes('asx') ||
    text.includes('sydney')
  ) {
    return { countryCode: 'AU', currency: 'AUD', countryFlag: '🇦🇺', regionGroup: 'ANZ' };
  }
  if (
    text.includes('new zealand') ||
    text.includes('rbnz') ||
    text.includes('nzd') ||
    text.includes('fonterra') ||
    text.includes('dairy')
  ) {
    return { countryCode: 'NZ', currency: 'NZD', countryFlag: '🇳🇿', regionGroup: 'ANZ' };
  }
  if (
    text.includes('uk ') ||
    text.includes('britain') ||
    text.includes('british') ||
    text.includes('bank of england') ||
    text.includes('boe') ||
    text.includes('pound') ||
    text.includes('sterling') ||
    text.includes('gbp') ||
    text.includes('ftse')
  ) {
    return { countryCode: 'GB', currency: 'GBP', countryFlag: '🇬🇧', regionGroup: 'EUROPE' };
  }
  if (
    text.includes('euro') ||
    text.includes('ecb') ||
    text.includes('europe') ||
    text.includes('germany') ||
    text.includes('france') ||
    text.includes('spain') ||
    text.includes('italy') ||
    text.includes('lagarde') ||
    text.includes('dax')
  ) {
    return { countryCode: 'EU', currency: 'EUR', countryFlag: '🇪🇺', regionGroup: 'EUROPE' };
  }
  if (
    text.includes('opec') ||
    text.includes('geopolit') ||
    text.includes('middle east') ||
    text.includes('gold') ||
    text.includes('silver') ||
    text.includes('copper') ||
    text.includes('crude oil') ||
    text.includes('brent') ||
    text.includes('bitcoin') ||
    text.includes('crypto') ||
    text.includes('ethereum')
  ) {
    return { countryCode: 'GLOBAL', currency: 'Global', countryFlag: '🌍', regionGroup: 'GLOBAL' };
  }
  if (
    feedHint === 'us_wallstreet' ||
    text.includes('fed') ||
    text.includes('fomc') ||
    text.includes('wall street') ||
    text.includes('nasdaq') ||
    text.includes('s&p') ||
    text.includes('dow jones') ||
    text.includes('treasury') ||
    text.includes('u.s.') ||
    text.includes('us ') ||
    text.includes('dollar') ||
    text.includes('nvidia') ||
    text.includes('apple')
  ) {
    return { countryCode: 'US', currency: 'USD', countryFlag: '🇺🇸', regionGroup: 'US' };
  }
  if (feedHint === 'asia') {
    return { countryCode: 'JP', currency: 'JPY', countryFlag: '🇯🇵', regionGroup: 'ASIA' };
  }
  if (feedHint === 'europe_global') {
    return { countryCode: 'EU', currency: 'EUR', countryFlag: '🇪🇺', regionGroup: 'EUROPE' };
  }
  return { countryCode: 'GLOBAL', currency: 'Global', countryFlag: '🌍', regionGroup: 'GLOBAL' };
}
