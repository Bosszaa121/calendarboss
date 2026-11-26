import { ASSET_CATALOG } from '../data/assetCatalog';
import {
  AssetDirection,
  AssetDirectionForecast,
  CalendarEvent,
  DateTabKey,
  ImpactSeverity,
  NewsItem,
  PortfolioAsset,
  PortfolioImpactDetail,
} from '../types';

export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9./-]/g, '');
}

/**
 * Maps normalized ticker tokens & aliases -> canonical PortfolioAsset in user's actual portfolio.
 */
export function buildPortfolioSymbolMap(
  portfolio: PortfolioAsset[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of portfolio) {
    const canon = item.symbol.toUpperCase();
    const norm = normalizeSymbol(canon);
    map.set(norm, canon);

    if (norm.endsWith('.BK')) {
      map.set(norm.replace(/\.BK$/, ''), canon);
    } else if (item.category === 'Thai Stock') {
      map.set(`${norm}.BK`, canon);
    }

    if (norm.includes('/')) {
      map.set(norm.replace(/\//g, ''), canon);
    }
    if (norm === 'XAUUSD') map.set('XAU/USD', canon);
    if (norm === 'XAGUSD') map.set('XAG/USD', canon);

    const catalogMatch = ASSET_CATALOG.find(
      (c) => normalizeSymbol(c.symbol) === norm || normalizeSymbol(c.symbol) === norm.replace(/\.BK$/, '')
    );
    if (catalogMatch?.aliases) {
      for (const alias of catalogMatch.aliases) {
        map.set(normalizeSymbol(alias), canon);
      }
    }
  }
  return map;
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

const SEVERITY_RANK: Record<ImpactSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function inferThemesForAsset(asset: PortfolioAsset): Set<string> {
  const themes = new Set<string>(asset.themes || []);
  const norm = normalizeSymbol(asset.symbol).replace(/\.BK$/, '');

  const catalogItem = ASSET_CATALOG.find(
    (c) => normalizeSymbol(c.symbol) === norm
  );
  if (catalogItem) {
    for (const t of catalogItem.themes) themes.add(t);
  }

  // Fallback inferences for custom or AI-classified tickers
  if (asset.category === 'Thai Stock') themes.add('thai_equity');
  if (asset.category === 'US ETF' || asset.category === 'US Stock') {
    themes.add('us_equity');
    themes.add('us_rates_sensitive');
  }
  if (asset.category === 'Crypto') {
    themes.add('bitcoin');
    themes.add('crypto_spot');
    themes.add('us_rates_sensitive');
  }
  if (asset.category === 'Commodity') {
    themes.add('precious_metals');
    themes.add('dxy_sensitive');
    themes.add('us_rates_sensitive');
  }

  const sectorLower = (asset.sector || '').toLowerCase();
  if (sectorLower.includes('semi') || sectorLower.includes('chip') || sectorLower.includes('ชิป')) {
    themes.add('semiconductor');
    themes.add('ai_chips');
  }
  if (sectorLower.includes('tech') || sectorLower.includes('ai') || sectorLower.includes('เทค')) {
    themes.add('us_tech');
    themes.add('ai_chips');
  }
  if (sectorLower.includes('gold') || sectorLower.includes('ทอง')) {
    themes.add('gold');
    themes.add('precious_metals');
    themes.add('dxy_sensitive');
  }
  if (sectorLower.includes('silver') || sectorLower.includes('เงิน')) {
    themes.add('silver');
    themes.add('precious_metals');
    themes.add('dxy_sensitive');
  }
  if (sectorLower.includes('crypto') || sectorLower.includes('bitcoin') || sectorLower.includes('blockchain') || sectorLower.includes('บล็อกเชน')) {
    themes.add('bitcoin');
    themes.add('crypto_equity');
  }
  if (sectorLower.includes('food') || sectorLower.includes('dairy') || sectorLower.includes('อาหาร') || sectorLower.includes('นม')) {
    themes.add('thai_food');
    themes.add('dairy_import');
    themes.add('usd_thb_sensitive');
  }
  if (sectorLower.includes('bank') || sectorLower.includes('ธนาคาร')) {
    themes.add('thai_bank');
    themes.add('thai_rates_sensitive');
  }

  return themes;
}

function inferMacroTagsFromText(
  title: string,
  description: string,
  currency: string | undefined,
  existingTags: string[] | undefined
): Set<string> {
  const tags = new Set<string>(existingTags || []);
  const text = `${title} ${description}`.toLowerCase();

  if (
    text.includes('fed') ||
    text.includes('fomc') ||
    text.includes('เฟด') ||
    text.includes('bond yield') ||
    text.includes('บอนด์ยีลด์') ||
    text.includes('treasury')
  ) {
    tags.add('us_rates');
    tags.add('bond_yield');
    tags.add('dxy');
  }
  if (
    (text.includes('cpi') || text.includes('pce') || text.includes('เงินเฟ้อ')) &&
    (currency === 'USD' || text.includes('สหรัฐ') || text.includes('us '))
  ) {
    tags.add('us_inflation');
    tags.add('us_rates');
    tags.add('dxy');
  }
  if (
    text.includes('non-farm') ||
    text.includes('nfp') ||
    text.includes('jobless') ||
    text.includes('การจ้างงาน')
  ) {
    tags.add('us_jobs');
    tags.add('us_rates');
    tags.add('bond_yield');
  }
  if (
    text.includes('ai ') ||
    text.includes('ชิป') ||
    text.includes('semiconductor') ||
    text.includes('เซมิคอนดักเตอร์') ||
    text.includes('nvidia') ||
    text.includes('data center')
  ) {
    tags.add('ai_chips');
  }
  if (
    text.includes('bitcoin') ||
    text.includes('บิตคอยน์') ||
    text.includes('crypto') ||
    text.includes('คริปโต') ||
    text.includes('สินทรัพย์ดิจิทัล') ||
    text.includes('blockchain')
  ) {
    tags.add('crypto');
  }
  if (
    text.includes('ทองคำ') ||
    text.includes('gold') ||
    text.includes('โลหะเงิน') ||
    text.includes('silver') ||
    text.includes('dxy') ||
    text.includes('ดัชนีดอลลาร์')
  ) {
    tags.add('precious_metals');
    tags.add('dxy');
  }
  if (
    currency === 'THB' ||
    text.includes('กนง') ||
    text.includes('ธปท') ||
    text.includes('bot ') ||
    text.includes('เงินเฟ้อไทย') ||
    text.includes('ค่าเงินบาท') ||
    text.includes('usd/thb')
  ) {
    tags.add('thai_macro');
    if (text.includes('กนง') || text.includes('ธปท') || text.includes('bot')) {
      tags.add('bot_rate');
    }
    if (text.includes('เงินเฟ้อไทย') || text.includes('thailand cpi')) {
      tags.add('thai_cpi');
    }
    if (text.includes('บาท') || text.includes('thb')) {
      tags.add('usd_thb');
    }
  }
  if (
    text.includes('นม') ||
    text.includes('เนย') ||
    text.includes('dairy') ||
    text.includes('อาหาร') ||
    text.includes('food')
  ) {
    tags.add('food_dairy');
  }
  if (currency === 'CNY' || text.includes('จีน') || text.includes('china')) {
    tags.add('china_macro');
  }
  if (currency === 'JPY' || text.includes('boj') || text.includes('ญี่ปุ่น')) {
    tags.add('boj_jpy');
  }
  if (currency === 'EUR' || text.includes('ecb') || text.includes('ยูโร')) {
    tags.add('eu_macro');
  }

  return tags;
}

/**
 * Core Real-Time Smart Portfolio Correlation Engine.
 * Computes exact Direct & Indirect impacts (High / Medium / Low + Thai reason) strictly
 * against the user's actual held portfolio assets. Returns [] if portfolio is empty.
 */
export function analyzePortfolioImpacts(
  item: {
    title: string;
    description: string;
    currency?: string;
    category?: 'economic' | 'earnings' | 'dividend' | 'news';
    relatedAssets: string[];
    macroTags?: string[];
    aiImpacts?: PortfolioImpactDetail[];
  },
  portfolio: PortfolioAsset[],
  portfolioMap: Map<string, string>
): PortfolioImpactDetail[] {
  if (portfolio.length === 0) return [];

  const resultMap = new Map<string, PortfolioImpactDetail>();

  const upsertImpact = (candidate: PortfolioImpactDetail) => {
    const existing = resultMap.get(candidate.symbol);
    if (!existing) {
      resultMap.set(candidate.symbol, candidate);
      return;
    }
    // Prefer direct over indirect, and higher severity over lower
    const existingScore =
      (existing.relation === 'direct' ? 10 : 0) + SEVERITY_RANK[existing.severity];
    const candidateScore =
      (candidate.relation === 'direct' ? 10 : 0) + SEVERITY_RANK[candidate.severity];
    if (candidateScore > existingScore) {
      resultMap.set(candidate.symbol, candidate);
    }
  };

  // 1. Merge AI-provided impacts first (filtered strictly to currently held portfolio assets)
  if (Array.isArray(item.aiImpacts)) {
    for (const imp of item.aiImpacts) {
      const norm = normalizeSymbol(imp.symbol);
      const heldCanonical =
        portfolioMap.get(norm) ||
        portfolioMap.get(norm.replace(/\.BK$/, '')) ||
        portfolioMap.get(norm.replace(/\//g, ''));
      if (heldCanonical) {
        upsertImpact({
          symbol: heldCanonical,
          relation: imp.relation === 'indirect' ? 'indirect' : 'direct',
          severity:
            imp.severity === 'high' || imp.severity === 'low'
              ? imp.severity
              : 'medium',
          reasonTh: imp.reasonTh,
        });
      }
    }
  }

  // 2. Direct ticker mention in relatedAssets
  const explicitlyMentioned = new Set<string>();
  for (const tag of item.relatedAssets) {
    const norm = normalizeSymbol(tag);
    const heldCanonical =
      portfolioMap.get(norm) ||
      portfolioMap.get(norm.replace(/\.BK$/, '')) ||
      portfolioMap.get(norm.replace(/\//g, ''));
    if (heldCanonical) {
      explicitlyMentioned.add(heldCanonical);
    }
  }

  const macroTags = inferMacroTagsFromText(
    item.title,
    item.description,
    item.currency,
    item.macroTags
  );

  const isUsMacroCore =
    macroTags.has('us_rates') ||
    macroTags.has('us_inflation') ||
    macroTags.has('us_jobs') ||
    macroTags.has('bond_yield');

  // 3. Evaluate every held asset in the user's real portfolio
  for (const asset of portfolio) {
    const sym = asset.symbol.toUpperCase();
    const themes = inferThemesForAsset(asset);
    const isDirectlyNamed = explicitlyMentioned.has(sym);

    // Earnings / Dividend specifically for this asset -> Direct High
    if (isDirectlyNamed && (item.category === 'earnings' || item.category === 'dividend')) {
      upsertImpact({
        symbol: sym,
        relation: 'direct',
        severity: 'high',
        reasonTh:
          item.category === 'earnings'
            ? `กำหนดประกาศงบการเงินของ ${sym} โดยตรง ส่งผลต่อราคาทันที`
            : `วันขึ้นเครื่องหมาย XD ปันผลของ ${sym} โดยตรง`,
      });
      continue;
    }

    // Rule A: US Fed / CPI / PCE / NFP / Bond Yield
    if (isUsMacroCore) {
      if (
        themes.has('us_tech') ||
        themes.has('semiconductor') ||
        themes.has('ai_chips')
      ) {
        upsertImpact({
          symbol: sym,
          relation: 'direct',
          severity: 'high',
          reasonTh: `ดอกเบี้ย Fed และ Bond Yield กระทบตรงต่อ Valuation หุ้นเทค/ชิปใน ${sym}`,
        });
      } else if (themes.has('gold') || themes.has('silver') || themes.has('precious_metals')) {
        upsertImpact({
          symbol: sym,
          relation: 'direct',
          severity: 'high',
          reasonTh: `ทิศทางดอกเบี้ยสหรัฐฯ และดอลลาร์ (DXY) กำหนดต้นทุนค่าเสียโอกาสของ ${sym}`,
        });
      } else if (themes.has('bitcoin') || themes.has('crypto_equity') || themes.has('crypto_spot')) {
        upsertImpact({
          symbol: sym,
          relation: 'direct',
          severity: 'high',
          reasonTh: `สภาพคล่องดอลลาร์และแนวโน้มดอกเบี้ย Fed กระทบตรงต่อสินทรัพย์ดิจิทัลอย่าง ${sym}`,
        });
      } else if (themes.has('us_treasury_long')) {
        upsertImpact({
          symbol: sym,
          relation: 'direct',
          severity: 'high',
          reasonTh: `ราคาพันธบัตรระยะยาว ${sym} แปรผกผันโดยตรงกับ Bond Yield และเงินเฟ้อสหรัฐฯ`,
        });
      } else if (themes.has('us_treasury_short')) {
        upsertImpact({
          symbol: sym,
          relation: 'direct',
          severity: 'medium',
          reasonTh: `อัตราผลตอบแทนพันธบัตรระยะสั้นของ ${sym} ปรับตามทิศทางดอกเบี้ยนโยบาย Fed`,
        });
      } else if (themes.has('us_equity') || themes.has('global_equity')) {
        upsertImpact({
          symbol: sym,
          relation: 'direct',
          severity: 'high',
          reasonTh: `ตัวเลขมหภาคสหรัฐฯ ส่งผลโดยตรงต่อทิศทางดัชนีหุ้นสหรัฐฯ ใน ${sym}`,
        });
      } else if (sym === 'USD/THB' || sym === 'DXY') {
        upsertImpact({
          symbol: sym,
          relation: 'direct',
          severity: 'high',
          reasonTh: `ส่วนต่างดอกเบี้ยสหรัฐฯ กระทบตรงต่อทิศทางค่าเงินดอลลาร์และ ${sym}`,
        });
      } else if (themes.has('thai_equity')) {
        upsertImpact({
          symbol: sym,
          relation: 'indirect',
          severity: themes.has('usd_thb_sensitive') ? 'medium' : 'low',
          reasonTh: `กระทบทางอ้อมต่อ ${sym} ผ่านกระแสเงินทุนต่างชาติ (Fund Flow) และความผันผวนค่าเงินบาท`,
        });
      }
    }

    // Rule B: AI / Semiconductor Chips
    if (macroTags.has('ai_chips')) {
      if (themes.has('semiconductor') || themes.has('ai_chips')) {
        upsertImpact({
          symbol: sym,
          relation: 'direct',
          severity: 'high',
          reasonTh: `กระแสการลงทุน AI และชิปเซมิคอนดักเตอร์ขับเคลื่อนรายได้หลักของ ${sym} โดยตรง`,
        });
      } else if (themes.has('us_tech')) {
        upsertImpact({
          symbol: sym,
          relation: 'direct',
          severity: 'high',
          reasonTh: `หุ้นกลุ่มชิปและเทคมีน้ำหนักสูงใน ${sym} จึงได้รับผลกระทบเชิงทิศทางโดยตรง`,
        });
      } else if (themes.has('us_broad')) {
        upsertImpact({
          symbol: sym,
          relation: 'indirect',
          severity: 'medium',
          reasonTh: `กลุ่มเทคและ AI เป็นสัดส่วนหลักของดัชนี ส่งผลทางอ้อมต่อ ${sym}`,
        });
      }
    }

    // Rule C: Bitcoin / Digital Assets
    if (macroTags.has('crypto')) {
      if (themes.has('bitcoin') || themes.has('crypto_equity') || themes.has('crypto_spot')) {
        upsertImpact({
          symbol: sym,
          relation: 'direct',
          severity: 'high',
          reasonTh: `ทิศทางราคา Bitcoin และกระแสเงินเข้า Spot ETF กระทบตรงต่อ ${sym}`,
        });
      } else if (themes.has('us_tech') && isDirectlyNamed) {
        upsertImpact({
          symbol: sym,
          relation: 'indirect',
          severity: 'low',
          reasonTh: `สะท้อนบรรยากาศการเปิดรับความเสี่ยง (Risk-On) ในกลุ่มสินทรัพย์เติบโต`,
        });
      }
    }

    // Rule D: Gold / Silver / DXY
    if (macroTags.has('precious_metals') || macroTags.has('dxy')) {
      if (themes.has('gold') || themes.has('silver') || themes.has('precious_metals')) {
        upsertImpact({
          symbol: sym,
          relation: 'direct',
          severity: 'high',
          reasonTh: `ราคาทองคำ โลหะเงิน และดัชนีดอลลาร์ (DXY) กำหนดทิศทางราคาของ ${sym} โดยตรง`,
        });
      } else if (sym === 'DXY' || sym === 'USD/THB' || sym === 'EUR/USD') {
        upsertImpact({
          symbol: sym,
          relation: 'direct',
          severity: 'high',
          reasonTh: `การเคลื่อนไหวของดัชนีดอลลาร์ (DXY) กระทบโดยตรงต่อคู่เงิน ${sym}`,
        });
      } else if (themes.has('dairy_import') || (themes.has('thai_equity') && themes.has('usd_thb_sensitive'))) {
        upsertImpact({
          symbol: sym,
          relation: 'indirect',
          severity: 'medium',
          reasonTh: `ดอลลาร์แข็ง/อ่อนค่ากระทบทางอ้อมต่อค่าเงินบาทและต้นทุนนำเข้า/ส่งออกของ ${sym}`,
        });
      }
    }

    // Rule E: Thailand BoT Rate / Thai CPI / USD-THB / Dairy & Food Raw Materials
    if (
      macroTags.has('bot_rate') ||
      macroTags.has('thai_cpi') ||
      macroTags.has('thai_macro') ||
      macroTags.has('usd_thb') ||
      macroTags.has('food_dairy')
    ) {
      if (macroTags.has('food_dairy') && (themes.has('dairy_import') || themes.has('thai_food'))) {
        upsertImpact({
          symbol: sym,
          relation: 'direct',
          severity: 'high',
          reasonTh: `ต้นทุนวัตถุดิบนม-เนยและอาหารโลกมีผลโดยตรงต่ออัตรากำไรขั้นต้นของ ${sym}`,
        });
      } else if (
        (macroTags.has('bot_rate') || macroTags.has('thai_cpi') || macroTags.has('thai_macro')) &&
        themes.has('thai_equity')
      ) {
        const isHigh =
          themes.has('thai_bank') ||
          themes.has('thai_consumer') ||
          themes.has('thai_food') ||
          isDirectlyNamed;
        upsertImpact({
          symbol: sym,
          relation: 'direct',
          severity: isHigh ? 'high' : 'medium',
          reasonTh: `นโยบายดอกเบี้ย กนง., เงินเฟ้อไทย และกำลังซื้อในประเทศส่งผลโดยตรงต่อ ${sym}`,
        });
      } else if (macroTags.has('usd_thb') && (sym === 'USD/THB' || themes.has('usd_thb_sensitive'))) {
        upsertImpact({
          symbol: sym,
          relation: sym === 'USD/THB' ? 'direct' : 'indirect',
          severity: sym === 'USD/THB' ? 'high' : 'medium',
          reasonTh: `ความผันผวนของค่าเงินบาท (USD/THB) กระทบต้นทุนนำเข้าและรายได้สกุลเงินต่างประเทศของ ${sym}`,
        });
      }
    }

    // Rule F: China PMI / Industrial Demand
    if (macroTags.has('china_macro')) {
      if (themes.has('china_demand') || themes.has('silver')) {
        upsertImpact({
          symbol: sym,
          relation: themes.has('china_demand') ? 'direct' : 'indirect',
          severity: 'medium',
          reasonTh: `ภาคการผลิตและการบริโภคของจีนส่งผลต่ออุปสงค์สินค้าและรายได้ของ ${sym}`,
        });
      }
    }

    // Rule G: BoJ / JPY Carry Trade
    if (macroTags.has('boj_jpy')) {
      if (themes.has('jpy_sensitive') || themes.has('japan_equity')) {
        upsertImpact({
          symbol: sym,
          relation: 'direct',
          severity: 'high',
          reasonTh: `นโยบายดอกเบี้ย BoJ และค่าเงินเยนส่งผลโดยตรงต่อ ${sym}`,
        });
      } else if (themes.has('bitcoin') || themes.has('us_tech')) {
        upsertImpact({
          symbol: sym,
          relation: 'indirect',
          severity: 'low',
          reasonTh: `ความเสี่ยง Yen Carry Trade อาจสร้างแรงผันผวนทางอ้อมระยะสั้นต่อ ${sym}`,
        });
      }
    }

    // Rule H: Fallback direct ticker match if not covered above
    if (isDirectlyNamed && !resultMap.has(sym)) {
      upsertImpact({
        symbol: sym,
        relation: 'direct',
        severity: 'high',
        reasonTh: `เหตุการณ์นี้ระบุเกี่ยวข้องโดยตรงกับ ${sym} ในพอร์ตของคุณ`,
      });
    }
  }

  return Array.from(resultMap.values()).sort((a, b) => {
    if (a.relation !== b.relation) return a.relation === 'direct' ? -1 : 1;
    return SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
  });
}

export function getMatchedPortfolioSymbols(
  relatedAssets: string[],
  portfolioMap: Map<string, string>
): string[] {
  const matched = new Set<string>();
  for (const raw of relatedAssets) {
    const norm = normalizeSymbol(raw);
    const hit =
      portfolioMap.get(norm) ||
      portfolioMap.get(norm.replace(/\//g, '')) ||
      portfolioMap.get(norm.replace(/\.BK$/, ''));
    if (hit) matched.add(hit);
  }
  return Array.from(matched);
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
  economicDirectCount: number;
  economicIndirectCount: number;
  newsCount: number;
  nextEventTitle?: string;
  nextEventDate?: string;
  nextEventRelation?: 'direct' | 'indirect';
}

export function getAlertsForAsset(
  asset: PortfolioAsset,
  calendarEvents: CalendarEvent[],
  newsItems: NewsItem[]
): AssetAlertSummary {
  const singlePortfolio = [asset];
  const singleMap = buildPortfolioSymbolMap(singlePortfolio);

  const upcomingMatches: Array<{
    event: CalendarEvent;
    impact: PortfolioImpactDetail;
  }> = [];

  for (const ev of calendarEvents) {
    const diff = getDayDiffFromToday(ev.date);
    if (diff < 0 || diff > 14) continue;
    const impacts = analyzePortfolioImpacts(
      {
        title: ev.title,
        description: ev.descriptionTh,
        currency: ev.currency,
        category: ev.category,
        relatedAssets: ev.relatedAssets,
        macroTags: ev.macroTags,
        aiImpacts: ev.aiImpacts,
      },
      singlePortfolio,
      singleMap
    );
    if (impacts.length > 0) {
      upcomingMatches.push({ event: ev, impact: impacts[0] });
    }
  }

  upcomingMatches.sort(
    (a, b) =>
      a.event.date.localeCompare(b.event.date) ||
      a.event.time.localeCompare(b.event.time)
  );

  const earningsCount = upcomingMatches.filter(
    (m) => m.event.category === 'earnings'
  ).length;
  const dividendCount = upcomingMatches.filter(
    (m) => m.event.category === 'dividend'
  ).length;
  const economicDirectCount = upcomingMatches.filter(
    (m) => m.event.category === 'economic' && m.impact.relation === 'direct'
  ).length;
  const economicIndirectCount = upcomingMatches.filter(
    (m) => m.event.category === 'economic' && m.impact.relation === 'indirect'
  ).length;

  let newsCount = 0;
  for (const item of newsItems) {
    const impacts = analyzePortfolioImpacts(
      {
        title: item.headline,
        description: item.impactSummary,
        category: 'news',
        relatedAssets: item.relatedAssets,
        macroTags: item.macroTags,
        aiImpacts: item.aiImpacts,
      },
      singlePortfolio,
      singleMap
    );
    if (impacts.length > 0) newsCount++;
  }

  const priorityMatch =
    upcomingMatches.find(
      (m) => m.event.category === 'earnings' || m.event.category === 'dividend'
    ) ||
    upcomingMatches.find((m) => m.impact.relation === 'direct') ||
    upcomingMatches[0];

  return {
    earningsCount,
    dividendCount,
    economicDirectCount,
    economicIndirectCount,
    newsCount,
    nextEventTitle: priorityMatch?.event.title,
    nextEventDate: priorityMatch?.event.date,
    nextEventRelation: priorityMatch?.impact.relation,
  };
}

function parseNumericValue(raw: string): number | null {
  if (!raw || raw === '—' || raw === '-') return null;
  const cleaned = raw.replace(/[,$฿%+]/g, '').trim();
  const match = cleaned.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const base = Number(match[0]);
  if (Number.isNaN(base)) return null;
  const upper = raw.toUpperCase();
  if (upper.includes('B')) return base * 1e9;
  if (upper.includes('M')) return base * 1e6;
  if (upper.includes('K')) return base * 1e3;
  return base;
}

function inferThemesForTickerSymbol(
  symbol: string,
  portfolio: PortfolioAsset[]
): Set<string> {
  const norm = normalizeSymbol(symbol).replace(/\.BK$/, '');
  const held = portfolio.find(
    (p) => normalizeSymbol(p.symbol).replace(/\.BK$/, '') === norm
  );
  if (held) return inferThemesForAsset(held);

  const cat = ASSET_CATALOG.find(
    (c) => normalizeSymbol(c.symbol).replace(/\.BK$/, '') === norm
  );
  if (cat) {
    const s = new Set(cat.themes);
    if (cat.category === 'Thai Stock') s.add('thai_equity');
    if (cat.category === 'US ETF' || cat.category === 'US Stock') s.add('us_equity');
    if (cat.category === 'Crypto') s.add('bitcoin');
    if (cat.category === 'Commodity') s.add('precious_metals');
    return s;
  }

  const fallback = new Set<string>();
  if (norm === 'DXY' || norm === 'USD/THB' || norm === 'USD/JPY') fallback.add('dxy_sensitive');
  return fallback;
}

/**
 * Computes per-asset directional forecast (🟢 bullish / 🔴 bearish / ⚪ neutral)
 * + concise Thai reasoning for BOTH already-released events (Actual vs Forecast)
 * AND upcoming events (expected direction + conditional scenario if higher/lower).
 */
export function computeEventAssetDirections(
  event: CalendarEvent,
  portfolio: PortfolioAsset[],
  portfolioMap: Map<string, string>,
  portfolioImpacts?: PortfolioImpactDetail[]
): AssetDirectionForecast[] {
  const result = new Map<string, AssetDirectionForecast>();
  const isHeldSymbol = (sym: string) => {
    const norm = normalizeSymbol(sym);
    return (
      portfolioMap.has(norm) ||
      portfolioMap.has(norm.replace(/\.BK$/, '')) ||
      portfolioMap.has(norm.replace(/\//g, ''))
    );
  };

  // 1. Respect AI-provided directional forecasts first if present
  if (Array.isArray(event.assetForecasts) && event.assetForecasts.length > 0) {
    for (const fc of event.assetForecasts) {
      const sym = normalizeSymbol(fc.symbol);
      if (!sym) continue;
      const dir: AssetDirection =
        fc.direction === 'bullish' || fc.direction === 'bearish' ? fc.direction : 'neutral';
      result.set(sym, {
        symbol: sym,
        direction: dir,
        reasonTh: fc.reasonTh,
        scenarioNoteTh: fc.scenarioNoteTh,
        isPortfolioHeld: isHeldSymbol(sym),
      });
    }
  }

  // 2. Build candidate list: prioritized portfolio impacts first, then relatedAssets
  const orderedSymbols: string[] = [];
  const pushSym = (s: string) => {
    const clean = s.trim().toUpperCase();
    if (clean && !orderedSymbols.includes(clean)) orderedSymbols.push(clean);
  };

  if (portfolioImpacts && portfolioImpacts.length > 0) {
    for (const imp of portfolioImpacts) pushSym(imp.symbol);
  }
  for (const tag of event.relatedAssets) pushSym(tag);

  const macroTags = inferMacroTagsFromText(
    event.title,
    event.descriptionTh,
    event.currency,
    event.macroTags
  );
  const titleLower = event.title.toLowerCase();
  const isReleased = event.actualOutcome !== 'pending' && event.actual !== '—';
  const actualNum = parseNumericValue(event.actual);
  const forecastNum = parseNumericValue(event.forecast);
  const previousNum = parseNumericValue(event.previous);

  // Determine macro pulse:
  // For US CPI/PCE/Rates/Jobs: hotter-than-expected -> hawkish (+1), cooler -> dovish (-1)
  const isInflationOrRate =
    macroTags.has('us_inflation') ||
    macroTags.has('us_rates') ||
    titleLower.includes('cpi') ||
    titleLower.includes('pce') ||
    titleLower.includes('fomc') ||
    titleLower.includes('rate');
  const isJoblessClaims = titleLower.includes('jobless') || titleLower.includes('ว่างงาน');
  const isUsJobs = macroTags.has('us_jobs') || titleLower.includes('nfp') || titleLower.includes('payroll');

  let usHawkishSignal: 1 | -1 | 0 = 0; // +1 = hawkish (bad for tech/gold, good for DXY), -1 = dovish (good for tech/gold)
  if (isReleased) {
    if (actualNum !== null && forecastNum !== null) {
      if (isJoblessClaims) {
        // Lower jobless claims = stronger labor = hawkish
        usHawkishSignal = actualNum < forecastNum ? 1 : actualNum > forecastNum ? -1 : 0;
      } else if (isInflationOrRate || isUsJobs) {
        usHawkishSignal = actualNum > forecastNum ? 1 : actualNum < forecastNum ? -1 : 0;
      }
    } else if (event.actualOutcome === 'better' && (isInflationOrRate || isUsJobs)) {
      usHawkishSignal = 1;
    } else if (event.actualOutcome === 'worse' && (isInflationOrRate || isUsJobs)) {
      usHawkishSignal = -1;
    }
  } else if (forecastNum !== null && previousNum !== null) {
    // Pending event: compare forecast vs previous for baseline directional expectation
    if (isInflationOrRate) {
      usHawkishSignal = forecastNum < previousNum ? -1 : forecastNum > previousNum ? 1 : 0;
    } else if (isUsJobs && !isJoblessClaims) {
      usHawkishSignal = forecastNum > previousNum ? 1 : forecastNum < previousNum ? -1 : 0;
    }
  }

  for (const sym of orderedSymbols.slice(0, 6)) {
    if (result.has(sym)) continue;
    const themes = inferThemesForTickerSymbol(sym, portfolio);
    const held = isHeldSymbol(sym);

    let direction: AssetDirection = 'neutral';
    let reasonTh = '';
    let scenarioNoteTh: string | undefined;

    // Case 1: Earnings Event
    if (event.category === 'earnings') {
      if (isReleased) {
        if (event.actualOutcome === 'better') {
          direction = 'bullish';
          reasonTh = `งบจริง (${event.actual}) ดีกว่าคาด (${event.forecast}) หนุนแรงซื้อใน ${sym}`;
        } else if (event.actualOutcome === 'worse') {
          direction = 'bearish';
          reasonTh = `งบจริง (${event.actual}) ต่ำกว่าคาด (${event.forecast}) กดดันราคา ${sym}`;
        } else {
          direction = 'neutral';
          reasonTh = `งบออกมาใกล้เคียงคาดการณ์ (${event.actual}) ราคา ${sym} แกว่งตัวทรงตัว`;
        }
      } else {
        const expectsGrowth =
          forecastNum !== null && previousNum !== null && forecastNum > previousNum;
        direction = expectsGrowth ? 'bullish' : 'neutral';
        reasonTh = expectsGrowth
          ? `คาดกำไร (${event.forecast}) โตจากงวดก่อน (${event.previous}) หนุนคาดหวังเชิงบวกต่อ ${sym}`
          : `รอผลประกาศงบเทียบคาดการณ์ ${event.forecast}`;
        scenarioNoteTh = 'หากงบสูงกว่าคาด → 🟢 ขึ้น / หากต่ำกว่าคาด → 🔴 ลง';
      }
    }
    // Case 2: Dividend XD Event
    else if (event.category === 'dividend') {
      if (isReleased && event.actualOutcome === 'better') {
        direction = 'bullish';
        reasonTh = `จ่ายปันผล (${event.actual}) สูงกว่าคาด หนุนความเชื่อมั่นกระแสเงินสดของ ${sym}`;
      } else {
        direction = 'neutral';
        reasonTh = `วันขึ้นเครื่องหมาย XD ราคา ${sym} มักปรับลดลงใกล้เคียงมูลค่าปันผลที่จ่าย (${event.forecast})`;
        scenarioNoteTh = 'ถือข้ามวันก่อน XD เพื่อรับสิทธิ์ปันผล';
      }
    }
    // Case 3: Food / Dairy Raw Materials (e.g. GDT -> KCG)
    else if (macroTags.has('food_dairy') && (themes.has('dairy_import') || themes.has('thai_food'))) {
      const dairyUp =
        (isReleased && actualNum !== null && forecastNum !== null && actualNum > forecastNum) ||
        (!isReleased && forecastNum !== null && previousNum !== null && forecastNum > previousNum);
      direction = dairyUp ? 'bearish' : 'bullish';
      reasonTh = dairyUp
        ? `ราคานม-เนยโลกปรับขึ้น (${isReleased ? event.actual : event.forecast}) เพิ่มต้นทุนวัตถุดิบกดดันมาร์จิ้น ${sym}`
        : `ราคาวัตถุดิบนม-เนยชะลอตัวช่วยลดต้นทุนและหนุนอัตรากำไรของ ${sym}`;
      if (!isReleased) {
        scenarioNoteTh = 'หากดัชนีนมสูงกว่าคาด → 🔴 กดดันต้นทุน / หากต่ำกว่าคาด → 🟢 บวกต่อมาร์จิ้น';
      }
    }
    // Case 4: Thailand BoT Rate / Thai CPI
    else if (macroTags.has('bot_rate') || macroTags.has('thai_cpi')) {
      if (isReleased && event.actualOutcome === 'inline') {
        direction = 'neutral';
        reasonTh = `ตัวเลขไทยออกตามคาด (${event.actual}) ทำให้ ${sym} เคลื่อนไหวทรงตัว`;
      } else if (themes.has('thai_bank')) {
        direction = event.actualOutcome === 'worse' ? 'bearish' : 'neutral';
        reasonTh = `อัตราดอกเบี้ย กนง. ส่งผลต่อส่วนต่างดอกเบี้ย (NIM) ของ ${sym}`;
      } else {
        direction = 'neutral';
        reasonTh = `ทิศทางดอกเบี้ยและเงินเฟ้อไทยกระทบกำลังซื้อในประเทศของ ${sym}`;
      }
      if (!isReleased) {
        scenarioNoteTh = 'หากลดดอกเบี้ย → 🟢 หนุนหุ้นค้าปลีก-อาหาร / คงดอกเบี้ย → ⚪ ทรงตัว';
      }
    }
    // Case 5: China PMI -> Silver / Energy / Tourism
    else if (macroTags.has('china_macro')) {
      const chinaStrong =
        (isReleased && event.actualOutcome === 'better') ||
        (!isReleased && forecastNum !== null && forecastNum >= 50.2);
      direction = chinaStrong ? 'bullish' : 'bearish';
      reasonTh = chinaStrong
        ? `ภาคการผลิตจีนขยายตัวหนุนอุปสงค์โภคภัณฑ์และรายได้ของ ${sym}`
        : `เศรษฐกิจจีนชะลอตัวกดดันความต้องการสินค้าและแรงซื้อใน ${sym}`;
      if (!isReleased) {
        scenarioNoteTh = `หากสูงกว่าคาด (${event.forecast}) → 🟢 ขึ้น / หากต่ำกว่า 50.0 → 🔴 ลง`;
      }
    }
    // Case 6: Japan BoJ / JPY
    else if (macroTags.has('boj_jpy')) {
      const bojHawkish =
        (isReleased && event.actualOutcome === 'better') ||
        (!isReleased && forecastNum !== null && previousNum !== null && forecastNum > previousNum);
      if (sym === 'USD/JPY') {
        direction = bojHawkish ? 'bearish' : 'bullish';
        reasonTh = bojHawkish
          ? 'BoJ มีแนวโน้มคุมเข้มหนุนเยนแข็งค่า (กด USD/JPY ลง)'
          : 'ดอกเบี้ยญี่ปุ่นทรงตัวต่ำหนุน USD/JPY';
      } else {
        direction = bojHawkish ? 'bearish' : 'neutral';
        reasonTh = bojHawkish
          ? `ความเสี่ยง BoJ ขึ้นดอกเบี้ยและ Yen Carry Trade กดดันสินทรัพย์เสี่ยง ${sym} ระยะสั้น`
          : `นโยบาย BoJ ทรงตัวไม่สร้างแรงกดดันต่อ ${sym}`;
      }
      if (!isReleased) {
        scenarioNoteTh = 'หาก BoJ ขึ้นดอกเบี้ยแรงกว่าคาด → 🔴 กดดันสินทรัพย์เสี่ยง';
      }
    }
    // Case 7: Eurozone / UK Macro -> DXY / EUR/USD / Gold
    else if (macroTags.has('eu_macro') || macroTags.has('uk_macro')) {
      const weakEurope =
        (isReleased && event.actualOutcome === 'worse') ||
        (!isReleased && forecastNum !== null && previousNum !== null && forecastNum < previousNum);
      if (sym === 'DXY') {
        direction = weakEurope ? 'bullish' : 'bearish';
        reasonTh = weakEurope
          ? 'เศรษฐกิจยุโรปอ่อนแอเพิ่มโอกาสลดดอกเบี้ย หนุนดอลลาร์ (DXY) แข็งค่า'
          : 'ยุโรปฟื้นตัวลดแรงหนุนดอลลาร์';
      } else if (sym === 'EUR/USD' || sym === 'GBP/USD') {
        direction = weakEurope ? 'bearish' : 'bullish';
        reasonTh = weakEurope
          ? `ตัวเลขยุโรปต่ำกว่าคาด (${isReleased ? event.actual : event.forecast}) กดดัน ${sym}`
          : `ตัวเลขยุโรปแข็งแกร่งหนุน ${sym}`;
      } else if (themes.has('gold') || themes.has('silver') || themes.has('precious_metals')) {
        direction = weakEurope ? 'bearish' : 'bullish';
        reasonTh = weakEurope
          ? `ดอลลาร์แข็งค่าเทียบยูโรสร้างแรงต้านระยะสั้นต่อ ${sym}`
          : `ดอลลาร์อ่อนค่าหนุนราคา ${sym}`;
      } else {
        direction = 'neutral';
        reasonTh = `ผลกระทบทางอ้อมต่อ ${sym} ผ่านค่าเงินดอลลาร์`;
      }
    }
    // Case 8: US Core Macro (CPI, PCE, FOMC, NFP, Jobless Claims, Bond Yield)
    else if (isInflationOrRate || isUsJobs || macroTags.has('bond_yield') || macroTags.has('dxy')) {
      if (sym === 'DXY' || sym === 'USD/THB') {
        direction = usHawkishSignal > 0 ? 'bullish' : usHawkishSignal < 0 ? 'bearish' : 'neutral';
        reasonTh =
          usHawkishSignal > 0
            ? `ตัวเลขสหรัฐฯ แกร่ง/เงินเฟ้อสูง หนุนยีลด์และ ${sym} แข็งค่า`
            : usHawkishSignal < 0
            ? `เงินเฟ้อสหรัฐฯ ชะลอตัวเปิดทาง Fed ลดดอกเบี้ย กดดัน ${sym} อ่อนค่า`
            : `รอตัวเลขสหรัฐฯ ชี้ทิศทาง ${sym}`;
      } else if (themes.has('us_treasury_short')) {
        direction = 'neutral';
        reasonTh = `${sym} ผันผวนต่ำมาก รักษาเสถียรภาพกระแสเงินสดได้ดีในช่วงประกาศตัวเลข`;
      } else if (
        themes.has('us_tech') ||
        themes.has('semiconductor') ||
        themes.has('ai_chips') ||
        themes.has('us_equity') ||
        themes.has('gold') ||
        themes.has('silver') ||
        themes.has('precious_metals') ||
        themes.has('bitcoin') ||
        themes.has('crypto_equity') ||
        themes.has('us_treasury_long')
      ) {
        if (isJoblessClaims && isReleased && usHawkishSignal > 0 && themes.has('us_equity') && !themes.has('us_treasury_long')) {
          // Strong labor with no recession fear is mildly supportive for equities, bearish for gold/TLT
          direction = 'bullish';
          reasonTh = `แรงงานสหรัฐฯ แกร่งกว่าคาด (${event.actual}) ลดความกังวลเศรษฐกิจถดถอย หนุนหุ้น ${sym}`;
        } else if (usHawkishSignal > 0) {
          direction = 'bearish';
          reasonTh = `ตัวเลขหนุนบอนด์ยีลด์และดอลลาร์แข็งค่า กดดัน Valuation และราคา ${sym}`;
        } else if (usHawkishSignal < 0) {
          direction = 'bullish';
          reasonTh = `แนวโน้มเงินเฟ้อชะลอ (${isReleased ? event.actual : event.forecast} เทียบก่อนหน้า ${event.previous}) เปิดทาง Fed ผ่อนคลาย หนุน ${sym} ปรับขึ้น`;
        } else {
          direction = 'neutral';
          reasonTh = `ตัวเลขตามคาด ${sym} แกว่งตัวในกรอบ`;
        }
        if (!isReleased) {
          scenarioNoteTh = `หากออกต่ำกว่าคาด (${event.forecast}) → 🟢 ขึ้น / หากสูงกว่าคาด → 🔴 ลง`;
        }
      } else if (themes.has('thai_equity')) {
        direction = usHawkishSignal < 0 ? 'bullish' : usHawkishSignal > 0 ? 'bearish' : 'neutral';
        reasonTh =
          usHawkishSignal < 0
            ? `ดอลลาร์อ่อนลงช่วยหนุน Fund Flow และลดแรงกดดันเงินบาทต่อ ${sym}`
            : usHawkishSignal > 0
            ? `ยีลด์สหรัฐฯ สูงขึ้นอาจชะลอ Fund Flow ต่างชาติระยะสั้นต่อ ${sym}`
            : `ผลกระทบทางอ้อมต่อ ${sym} อยู่ในระดับทรงตัว`;
      }
    }

    if (!reasonTh) {
      reasonTh = `ติดตามผลกระทบต่อ ${sym} หลังประกาศตัวเลขจริง`;
    }

    result.set(sym, {
      symbol: sym,
      direction,
      reasonTh,
      scenarioNoteTh,
      isPortfolioHeld: held,
    });
  }

  return Array.from(result.values()).sort((a, b) => {
    if (Boolean(a.isPortfolioHeld) !== Boolean(b.isPortfolioHeld)) {
      return a.isPortfolioHeld ? -1 : 1;
    }
    return 0;
  });
}

