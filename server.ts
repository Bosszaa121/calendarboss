import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

function getTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysIso(days: number): string {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(target.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function extractJsonBlock(rawText: string): string {
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    return fenced[1].trim();
  }
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return rawText.slice(firstBrace, lastBrace + 1);
  }
  return rawText.trim();
}

function createGeminiClient(apiKey: string) {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractGroundingSources(
  response: unknown
): Array<{ title: string; uri: string }> {
  const resObj = response as {
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: Array<{ web?: { title?: string; uri?: string } }>;
      };
    }>;
  };
  const rawChunks = resObj.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources: Array<{ title: string; uri: string }> = [];
  const seenUris = new Set<string>();

  for (const chunk of rawChunks) {
    const web = chunk?.web;
    if (web?.uri && !seenUris.has(web.uri)) {
      seenUris.add(web.uri);
      sources.push({
        title: web.title || web.uri,
        uri: web.uri,
      });
    }
  }
  return sources.slice(0, 8);
}

interface PortfolioEntryInput {
  symbol: string;
  name: string;
  category: string;
  sector: string;
  topHoldings?: string[];
}

function parsePortfolioPayload(rawPortfolio: unknown, rawSymbols?: unknown): PortfolioEntryInput[] {
  if (Array.isArray(rawPortfolio)) {
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
        name: typeof item.name === 'string' ? item.name.slice(0, 80) : String(item.symbol),
        category: typeof item.category === 'string' ? item.category : 'US Stock',
        sector: typeof item.sector === 'string' ? item.sector.slice(0, 60) : '',
        topHoldings: Array.isArray(item.topHoldings)
          ? item.topHoldings.filter((h): h is string => typeof h === 'string').slice(0, 6)
          : undefined,
      }));
  }
  if (Array.isArray(rawSymbols)) {
    return rawSymbols
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .slice(0, 25)
      .map((s) => ({ symbol: s.trim().toUpperCase(), name: s.trim(), category: '', sector: '' }));
  }
  return [];
}

const VALID_CATEGORIES = new Set([
  'US ETF',
  'Thai Stock',
  'US Stock',
  'Crypto',
  'Commodity',
  'Forex',
]);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', hasGeminiKey: Boolean(process.env.GEMINI_API_KEY) });
  });

  // 1. Auto-classify any custom ticker using Gemini AI
  app.post('/api/classify-asset', async (req, res) => {
    const rawSymbol = typeof req.body?.symbol === 'string' ? req.body.symbol.trim() : '';
    const cleanedSymbol = rawSymbol
      .toUpperCase()
      .replace(/[^A-Z0-9./-]/g, '')
      .slice(0, 20);

    if (!cleanedSymbol) {
      res.status(400).json({ error: 'กรุณาระบุชื่อย่อสินทรัพย์ (Ticker) ที่ถูกต้อง' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์สำหรับจำแนก Ticker อัตโนมัติ',
      });
      return;
    }

    try {
      const ai = createGeminiClient(apiKey);
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `ระบุข้อมูลทางการเงินของ Ticker "${cleanedSymbol}" อย่างแม่นยำ (รองรับทั้ง US ETF, หุ้นไทย SET/mai, หุ้นสหรัฐฯ, คริปโต, โภคภัณฑ์ และ Forex)
- ถ้าเป็นหุ้นไทยใน SET/mai เช่น KCG, PTT, OSP, NETBAY, JMT ให้ตั้ง category = "Thai Stock", market = "SET" หรือ "mai", flag = "🇹🇭", currency = "THB", hasDividends = true, hasEarnings = true
- ถ้าเป็น ETF หุ้นสหรัฐฯ เช่น QQQM, SMH, BLOK, VOO, SCHD ให้ตั้ง category = "US ETF", flag = "🇺🇸", currency = "USD", ระบุ topHoldings 3-4 ตัวหลัก (เช่น NVDA, AAPL, MSFT), hasDividends = true, hasEarnings = true
- ถ้าเป็น ETF ทอง/เงิน/คริปโต หรือ Crypto/Commodity เช่น GLD, SLV, IBIT, BTC, ETH, XAUUSD, XAGUSD ให้ตั้ง hasDividends = false, hasEarnings = false
- ถ้าเป็น ETF พันธบัตร เช่น SGOV, JPST, TLT ให้ตั้ง hasDividends = true, hasEarnings = false
- ใน themes ให้เลือกแท็กที่เกี่ยวข้องจากชุดนี้ (สูงสุด 5 แท็ก): us_equity, us_broad, us_tech, semiconductor, ai_chips, us_dividend, us_rates_sensitive, us_treasury_short, us_treasury_long, crypto_equity, crypto_spot, bitcoin, gold, silver, precious_metals, dxy_sensitive, thai_equity, thai_food, dairy_import, thai_bank, thai_energy, thai_consumer, thai_tourism, thai_healthcare, thai_dividend, thai_rates_sensitive, usd_thb_sensitive, china_demand, oil_commodity, global_equity, japan_equity, jpy_sensitive, eu_macro_sensitive`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              symbol: { type: Type.STRING },
              name: { type: Type.STRING },
              category: {
                type: Type.STRING,
                enum: ['US ETF', 'Thai Stock', 'US Stock', 'Crypto', 'Commodity', 'Forex'],
              },
              market: { type: Type.STRING },
              flag: { type: Type.STRING },
              currency: { type: Type.STRING },
              sector: { type: Type.STRING },
              themes: { type: Type.ARRAY, items: { type: Type.STRING } },
              topHoldings: { type: Type.ARRAY, items: { type: Type.STRING } },
              hasDividends: { type: Type.BOOLEAN },
              hasEarnings: { type: Type.BOOLEAN },
            },
            required: ['symbol', 'name', 'category', 'market', 'flag', 'currency', 'sector', 'themes'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const category = VALID_CATEGORIES.has(parsed.category) ? parsed.category : 'US Stock';

      res.json({
        symbol: cleanedSymbol,
        name:
          typeof parsed.name === 'string' && parsed.name.trim()
            ? parsed.name.trim().slice(0, 140)
            : cleanedSymbol,
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
            ? parsed.currency.trim().slice(0, 12)
            : category === 'Thai Stock'
            ? 'THB'
            : 'USD',
        sector:
          typeof parsed.sector === 'string' && parsed.sector.trim()
            ? parsed.sector.trim().slice(0, 80)
            : 'ทั่วไป (General)',
        themes: Array.isArray(parsed.themes)
          ? parsed.themes
              .filter((t: unknown): t is string => typeof t === 'string' && t.trim().length > 0)
              .map((t: string) => t.trim().slice(0, 40))
              .slice(0, 6)
          : [],
        topHoldings: Array.isArray(parsed.topHoldings)
          ? parsed.topHoldings
              .filter((t: unknown): t is string => typeof t === 'string' && t.trim().length > 0)
              .map((t: string) => t.trim().toUpperCase().slice(0, 15))
              .slice(0, 5)
          : undefined,
        hasDividends: typeof parsed.hasDividends === 'boolean' ? parsed.hasDividends : undefined,
        hasEarnings: typeof parsed.hasEarnings === 'boolean' ? parsed.hasEarnings : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ไม่สามารถจำแนก Ticker ได้';
      console.error('[/api/classify-asset] error:', message);
      res.status(502).json({ error: `ไม่สามารถจำแนก Ticker ด้วย AI ได้: ${message}` });
    }
  });

  // 2. Live Calendar + News + Directional Asset Forecasts via Google Search Grounding
  app.post('/api/sync', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์ จึงไม่สามารถดึงข้อมูลแบบเรียลไทม์จาก Google Search ได้ในขณะนี้',
      });
      return;
    }

    const portfolioEntries = parsePortfolioPayload(req.body?.portfolio, req.body?.symbols);
    const hasPortfolio = portfolioEntries.length > 0;
    const portfolioSummaryText = hasPortfolio
      ? portfolioEntries
          .map((p) => `${p.symbol} (${p.category}${p.sector ? ` · ${p.sector}` : ''})`)
          .join(', ')
      : 'พอร์ตยังว่าง (วิเคราะห์ทิศทางต่อสินทรัพย์หลักทั่วโลก เช่น QQQM, SMH, GLD, SLV, VOO, BTC, KCG)';

    const today = getTodayIso();
    const endDate = addDaysIso(14);
    const yesterday = addDaysIso(-1);

    try {
      const ai = createGeminiClient(apiKey);
      const prompt = `คุณเป็นนักวิเคราะห์ตลาดการเงินระดับโลก ใช้ Google Search ค้นหาข้อมูลเศรษฐกิจและข่าวการลงทุนล่าสุด ณ วันที่ ${today}
สินทรัพย์จริงในพอร์ตของผู้ใช้ขณะนี้: ${portfolioSummaryText}

กรุณาสรุปข้อมูลล่าสุดเป็นภาษาไทยทั้งหมดในรูปแบบ JSON เพียงอย่างเดียว (ห้ามมีข้อความอื่นนอก JSON) ตามโครงสร้างต่อไปนี้:
{
  "fearGreed": {
    "value": <ตัวเลข CNN Fear & Greed Index ล่าสุด 0-100>,
    "previousClose": <ตัวเลขวันก่อนหน้า>,
    "oneWeekAgo": <ตัวเลขสัปดาห์ที่แล้ว>,
    "oneMonthAgo": <ตัวเลขเดือนที่แล้ว>,
    "marketNote": "<สรุปบรรยากาศตลาดโลกสั้นๆ 1 ประโยคภาษาไทย>"
  },
  "calendarEvents": [
    {
      "date": "<YYYY-MM-DD ระหว่าง ${yesterday} ถึง ${endDate}>",
      "time": "<HH:mm เวลาไทย ICT>",
      "countryCode": "<US|TH|CN|EU|JP|GB|NZ|AU>",
      "flag": "<อีโมจิธงชาติ เช่น 🇺🇸 🇹🇭 🇨🇳 🇪🇺 🇯🇵 🇬🇧 🇳🇿>",
      "currency": "<USD|THB|CNY|EUR|JPY|GBP|NZD|AUD>",
      "countryNameTh": "<ชื่อประเทศภาษาไทย>",
      "impact": <1 | 2 | 3>,
      "category": "<economic | earnings | dividend>",
      "title": "<ชื่อเหตุการณ์ภาษาไทยพร้อมชื่อย่ออังกฤษ>",
      "actual": "<ค่าจริง หรือ — ถ้ายังไม่ประกาศ>",
      "forecast": "<ค่าคาดการณ์ หรือ —>",
      "previous": "<ค่าครั้งก่อน หรือ —>",
      "actualOutcome": "<better | worse | inline | pending>",
      "relatedAssets": ["<Ticker ที่เกี่ยวข้อง>"],
      "macroTags": ["<เลือกจาก: us_rates, us_inflation, us_jobs, bond_yield, dxy, ai_chips, crypto, precious_metals, bot_rate, thai_cpi, thai_macro, usd_thb, food_dairy, china_macro, boj_jpy, eu_macro, uk_macro>"],
      "descriptionTh": "<คำอธิบายสั้นๆ 1 ประโยคว่ากระทบตลาดอย่างไร>",
      "assetForecasts": [
        {
          "symbol": "<Ticker ในพอร์ตหรือสินทรัพย์ที่เกี่ยวข้องโดยตรง เช่น QQQM, SMH, GLD, KCG>",
          "direction": "<bullish | bearish | neutral>",
          "reasonTh": "<เหตุผลสั้นกระชับภาษาไทยว่าทำไมคาดว่าจะขึ้น/ลง/คงที่ (เทียบ Actual vs Forecast หรือแนวโน้มก่อนประกาศ)>",
          "scenarioNoteTh": "<ถ้ายังไม่ประกาศ ให้ระบุเงื่อนไข เช่น หากสูงกว่าคาด → ลง / ต่ำกว่าคาด → ขึ้น>"
        }
      ],
      "aiImpacts": [
        {
          "symbol": "<ต้องเป็น Ticker ที่อยู่ในพอร์ตจริงของผู้ใช้เท่านั้น>",
          "relation": "<direct | indirect>",
          "severity": "<high | medium | low>",
          "direction": "<bullish | bearish | neutral>",
          "reasonTh": "<เหตุผลสั้นกระชับ 1 ประโยคว่ากระทบทางตรงหรือทางอ้อมอย่างไร>"
        }
      ]
    }
  ],
  "newsItems": [
    {
      "timeLabel": "<เช่น ล่าสุดวันนี้ หรือ 1 ชม. ที่แล้ว>",
      "source": "<ชื่อแหล่งข่าว เช่น Bloomberg, Reuters, CNBC, SET>",
      "headline": "<พาดหัวข่าวภาษาไทยที่กระชับ ชัดเจน>",
      "impactSummary": "<อธิบายสั้นๆ 1-2 ประโยคว่าข่าวนี้ส่งผลบวกหรือลบต่อตลาดอย่างไร>",
      "sentiment": "<bullish | bearish | neutral>",
      "relatedAssets": ["<Ticker ที่ได้รับผลกระทบ>"],
      "macroTags": ["<เลือกจากชุดเดียวกับด้านบน>"],
      "countryCode": "<US|TH|CN|EU|JP|GB|GLOBAL>",
      "countryFlag": "<อีโมจิธงชาติ เช่น 🇺🇸 🇹🇭 🇨🇳 🇪🇺 🇯🇵 🇬🇧 🌐>",
      "aiImpacts": [
        {
          "symbol": "<ต้องเป็น Ticker ที่อยู่ในพอร์ตจริงของผู้ใช้เท่านั้น>",
          "relation": "<direct | indirect>",
          "severity": "<high | medium | low>",
          "direction": "<bullish | bearish | neutral>",
          "reasonTh": "<เหตุผลสั้นกระชับว่าส่งผลต่อสินทรัพย์นี้ในพอร์ตอย่างไร>"
        }
      ]
    }
  ]
}

เงื่อนไขสำคัญ:
- สร้าง calendarEvents จำนวน 10-14 รายการจริงที่สำคัญในช่วง ${yesterday} ถึง ${endDate} ครอบคลุมหลายประเทศ (🇺🇸 สหรัฐฯ, 🇹🇭 ไทย, 🇨🇳 จีน, 🇪🇺 ยุโรป, 🇯🇵 ญี่ปุ่น, 🇬🇧 อังกฤษ)
- ทุกเหตุการณ์ใน calendarEvents ต้องมี assetForecasts 2-4 สินทรัพย์ พร้อมทิศทาง bullish (ขึ้น) / bearish (ลง) / neutral (คงที่) ทั้งรายการที่ประกาศแล้วและที่กำลังจะประกาศ
- สร้าง newsItems จำนวน 8-10 ข่าวจริงล่าสุดที่มีผลต่อตลาดโลกและสินทรัพย์ในพอร์ตของผู้ใช้ พร้อมระบุ countryCode และ countryFlag
- ใน aiImpacts ให้ใส่เฉพาะ Ticker ที่มีอยู่ในพอร์ตจริงของผู้ใช้เท่านั้น (ถ้าพอร์ตว่างให้ใส่ [])
- ตอบกลับเป็น JSON ที่ถูกต้องตาม syntax เท่านั้น`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          tools: [{ googleSearch: {} }],
        },
      });

      const parsed = JSON.parse(extractJsonBlock(response.text ?? ''));
      const sources = extractGroundingSources(response);
      const syncedAt = new Date().toISOString();

      const sanitizeAiImpacts = (rawImpacts: unknown) => {
        if (!Array.isArray(rawImpacts)) return [];
        return rawImpacts
          .filter(
            (x): x is Record<string, unknown> =>
              Boolean(x) &&
              typeof x === 'object' &&
              typeof (x as Record<string, unknown>).symbol === 'string'
          )
          .map((x) => ({
            symbol: String(x.symbol).trim().toUpperCase(),
            relation: x.relation === 'indirect' ? 'indirect' : 'direct',
            severity: x.severity === 'high' || x.severity === 'low' ? x.severity : 'medium',
            direction:
              x.direction === 'bullish' || x.direction === 'bearish' ? x.direction : 'neutral',
            reasonTh: typeof x.reasonTh === 'string' ? x.reasonTh.slice(0, 200) : '',
          }))
          .filter((x) => x.reasonTh.length > 0);
      };

      const sanitizeForecasts = (rawForecasts: unknown) => {
        if (!Array.isArray(rawForecasts)) return [];
        return rawForecasts
          .filter(
            (x): x is Record<string, unknown> =>
              Boolean(x) &&
              typeof x === 'object' &&
              typeof (x as Record<string, unknown>).symbol === 'string'
          )
          .map((x) => ({
            symbol: String(x.symbol).trim().toUpperCase(),
            direction:
              x.direction === 'bullish' || x.direction === 'bearish' ? x.direction : 'neutral',
            reasonTh: typeof x.reasonTh === 'string' ? x.reasonTh.slice(0, 200) : '',
            scenarioNoteTh:
              typeof x.scenarioNoteTh === 'string' && x.scenarioNoteTh.trim()
                ? x.scenarioNoteTh.slice(0, 160)
                : undefined,
          }))
          .filter((x) => x.symbol.length > 0 && x.reasonTh.length > 0);
      };

      const calendarEvents = Array.isArray(parsed.calendarEvents)
        ? parsed.calendarEvents.map((ev: Record<string, unknown>, idx: number) => ({
            id: `live-ev-${Date.now()}-${idx}`,
            date: typeof ev.date === 'string' ? ev.date : today,
            time: typeof ev.time === 'string' ? ev.time : '19:30',
            countryCode: typeof ev.countryCode === 'string' ? ev.countryCode.toUpperCase() : 'US',
            flag: typeof ev.flag === 'string' ? ev.flag : '🌐',
            currency: typeof ev.currency === 'string' ? ev.currency : 'USD',
            countryNameTh:
              typeof ev.countryNameTh === 'string' ? ev.countryNameTh : 'ต่างประเทศ',
            impact: ev.impact === 3 || ev.impact === 2 || ev.impact === 1 ? ev.impact : 2,
            category:
              ev.category === 'earnings' || ev.category === 'dividend' ? ev.category : 'economic',
            title: typeof ev.title === 'string' ? ev.title : 'เหตุการณ์เศรษฐกิจสำคัญ',
            actual: typeof ev.actual === 'string' ? ev.actual : '—',
            forecast: typeof ev.forecast === 'string' ? ev.forecast : '—',
            previous: typeof ev.previous === 'string' ? ev.previous : '—',
            actualOutcome:
              ev.actualOutcome === 'better' ||
              ev.actualOutcome === 'worse' ||
              ev.actualOutcome === 'inline'
                ? ev.actualOutcome
                : 'pending',
            relatedAssets: Array.isArray(ev.relatedAssets)
              ? ev.relatedAssets.filter((x): x is string => typeof x === 'string')
              : [],
            macroTags: Array.isArray(ev.macroTags)
              ? ev.macroTags.filter((x): x is string => typeof x === 'string')
              : [],
            descriptionTh: typeof ev.descriptionTh === 'string' ? ev.descriptionTh : '',
            assetForecasts: sanitizeForecasts(ev.assetForecasts),
            aiImpacts: sanitizeAiImpacts(ev.aiImpacts),
            isLiveSynced: true,
          }))
        : [];

      const newsItems = Array.isArray(parsed.newsItems)
        ? parsed.newsItems
            .map((item: Record<string, unknown>, idx: number) => ({
              id: `live-news-${Date.now()}-${idx}`,
              publishedAt: syncedAt,
              timeLabel: typeof item.timeLabel === 'string' ? item.timeLabel : 'ล่าสุดวันนี้',
              source: typeof item.source === 'string' ? item.source : 'Global Wire',
              headline: typeof item.headline === 'string' ? item.headline : '',
              impactSummary:
                typeof item.impactSummary === 'string' ? item.impactSummary : '',
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
              countryCode:
                typeof item.countryCode === 'string' ? item.countryCode.toUpperCase() : 'GLOBAL',
              countryFlag: typeof item.countryFlag === 'string' ? item.countryFlag : '🌐',
              aiImpacts: sanitizeAiImpacts(item.aiImpacts),
              isLiveSynced: true,
            }))
            .filter((n: { headline: string }) => n.headline.length > 0)
        : [];

      const fearGreed =
        parsed.fearGreed && typeof parsed.fearGreed.value === 'number'
          ? {
              value: Math.min(100, Math.max(0, Math.round(parsed.fearGreed.value))),
              previousClose:
                typeof parsed.fearGreed.previousClose === 'number'
                  ? Math.round(parsed.fearGreed.previousClose)
                  : undefined,
              oneWeekAgo:
                typeof parsed.fearGreed.oneWeekAgo === 'number'
                  ? Math.round(parsed.fearGreed.oneWeekAgo)
                  : undefined,
              oneMonthAgo:
                typeof parsed.fearGreed.oneMonthAgo === 'number'
                  ? Math.round(parsed.fearGreed.oneMonthAgo)
                  : undefined,
              marketNote:
                typeof parsed.fearGreed.marketNote === 'string'
                  ? parsed.fearGreed.marketNote
                  : undefined,
              updatedLabel: 'อัปเดตสดจาก Google Search',
            }
          : undefined;

      res.json({
        calendarEvents,
        newsItems,
        fearGreed,
        sources,
        syncedAt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการซิงค์ข้อมูล';
      console.error('[/api/sync] error:', message);
      res.status(502).json({
        error: `ไม่สามารถซิงค์ข้อมูลสดได้ในขณะนี้: ${message}`,
      });
    }
  });

  // 3. Portfolio Earnings Summary & XD Dividend Tracker via Google Search Grounding
  app.post('/api/earnings-xd', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์',
      });
      return;
    }

    const portfolioEntries = parsePortfolioPayload(req.body?.portfolio);
    if (portfolioEntries.length === 0) {
      res.json({
        earnings: [],
        dividends: [],
        sources: [],
        syncedAt: new Date().toISOString(),
      });
      return;
    }

    const today = getTodayIso();
    const portfolioDesc = portfolioEntries
      .map(
        (p) =>
          `${p.symbol} (${p.name} · ${p.category}${
            p.topHoldings?.length ? ` · Top Holdings: ${p.topHoldings.join(', ')}` : ''
          })`
      )
      .join('\n- ');

    try {
      const ai = createGeminiClient(apiKey);
      const prompt = `คุณเป็นนักวิเคราะห์งบการเงินและปันผลระดับสถาบัน ใช้ Google Search ค้นหาข้อมูลงบการเงินล่าสุดและกำหนดวันขึ้นเครื่องหมาย XD ล่าสุด ณ วันที่ ${today} สำหรับสินทรัพย์ในพอร์ตต่อไปนี้:
- ${portfolioDesc}

กรุณาตอบกลับเป็น JSON เพียงอย่างเดียวตามโครงสร้างนี้ (ห้ามมีข้อความอื่นนอก JSON):
{
  "earnings": [
    {
      "portfolioSymbol": "<Ticker ในพอร์ตของผู้ใช้>",
      "reportedSymbol": "<Ticker ของบริษัทที่รายงานงบ (ถ้าเป็นหุ้นรายตัวเช่น KCG/NVDA ให้ตรงกับ portfolioSymbol; ถ้าเป็น Equity ETF เช่น QQQM/SMH/BLOK ให้ดึง Top Holdings 1-2 ตัวหลัก เช่น NVDA, TSM, AVGO, AAPL, MSFT, COIN)>",
      "reportedName": "<ชื่อเต็มบริษัท>",
      "isTopHolding": <true ถ้าเป็น Top Holding ของ ETF, false ถ้าเป็นหุ้นรายตัว>,
      "holdingWeight": "<สัดส่วนน้ำหนักใน ETF เช่น 20.4% ถ้ามี>",
      "flag": "<อีโมจิธงชาติ เช่น 🇺🇸 🇹🇭 🇹🇼>",
      "reportDate": "<YYYY-MM-DD วันที่ประกาศงบล่าสุดหรือกำลังจะประกาศ หรือ — ถ้าไม่อิงงบ>",
      "periodLabel": "<เช่น Q3 2026 หรือ กำลังประกาศงบ หรือ ไม่อิงงบการเงิน>",
      "revenueSummary": "<สรุปรายได้และ % YoY เช่น รายได้ $35.1B (+68% YoY)>",
      "profitSummary": "<สรุปกำไร/EPS เทียบคาดการณ์ เช่น EPS $0.89 (ดีกว่าคาด +6%)>",
      "yoyChange": "<เช่น +68% YoY>",
      "status": "<beat | inline | miss | upcoming | not_applicable>",
      "trendSummaryTh": "<สรุปแนวโน้มธุรกิจ 2-3 บรรทัดภาษาไทยที่อ่านเข้าใจง่าย>",
      "daysUntil": <จำนวนวันจนถึงวันประกาศงบ ถ้าเป็นอนาคตให้ใส่เลข >= 0, ถ้าประกาศไปแล้วให้ใส่เลขติดลบ, ถ้าไม่ทราบใส่ null>
    }
  ],
  "dividends": [
    {
      "symbol": "<Ticker ในพอร์ตของผู้ใช้>",
      "name": "<ชื่อเต็ม>",
      "flag": "<อีโมจิธงชาติ>",
      "applicable": <true ถ้าจ่ายปันผล, false สำหรับสินทรัพย์ที่ไม่มีปันผลเช่น GLD, SLV, BTC, ETH, XAUUSD, XAGUSD, IBIT>,
      "notApplicableReasonTh": "<ถ้า applicable=false ให้ใส่ 'ไม่มีปันผล / ไม่อิงงบการเงิน'>",
      "xdDate": "<YYYY-MM-DD วันขึ้นเครื่องหมาย XD ล่าสุด/ถัดไป หรือ —>",
      "daysUntilXD": <จำนวนวันจนถึงวัน XD ถัดไป หรือ null>,
      "dps": "<เงินปันผลต่อหุ้น/หน่วย เช่น ฿0.38 หรือ $0.265 หรือ —>",
      "dividendYield": "<อัตราปันผลต่อปี เช่น 4.1% หรือ —>",
      "payDate": "<YYYY-MM-DD วันจ่ายเงินปันผล หรือ —>",
      "frequency": "<เช่น รายไตรมาส / ปีละ 2 ครั้ง / รายเดือน>",
      "noteTh": "<หมายเหตุสั้นๆ 1 ประโยคภาษาไทย>"
    }
  ]
}

เงื่อนไขสำคัญ:
- ครอบคลุมทุก Ticker ในพอร์ตของผู้ใช้ให้ครบถ้วน
- สำหรับ GLD, SLV, BTC, ETH, XAUUSD, XAGUSD, IBIT หรือสินทรัพย์โภคภัณฑ์/คริปโตที่ไม่มีปันผลและไม่อิงงบ ให้ใส่ status = "not_applicable" ใน earnings และ applicable = false พร้อม notApplicableReasonTh = "ไม่มีปันผล / ไม่อิงงบการเงิน" ใน dividends
- สำหรับ ETF พันธบัตร (เช่น SGOV, JPST, TLT) มีปันผลรายเดือน (applicable = true) แต่ไม่อิงงบการเงินบริษัท (status = "not_applicable")
- ใช้ข้อมูลจริงจาก Google Search เท่านั้น และตอบเป็น JSON ที่ถูกต้องตาม syntax`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          tools: [{ googleSearch: {} }],
        },
      });

      const parsed = JSON.parse(extractJsonBlock(response.text ?? ''));
      const sources = extractGroundingSources(response);
      const syncedAt = new Date().toISOString();

      const validStatuses = new Set(['beat', 'inline', 'miss', 'upcoming', 'not_applicable']);

      const earnings = Array.isArray(parsed.earnings)
        ? parsed.earnings.map((e: Record<string, unknown>, idx: number) => ({
            id: `live-earn-${Date.now()}-${idx}`,
            portfolioSymbol:
              typeof e.portfolioSymbol === 'string'
                ? e.portfolioSymbol.trim().toUpperCase()
                : '',
            reportedSymbol:
              typeof e.reportedSymbol === 'string'
                ? e.reportedSymbol.trim().toUpperCase()
                : '',
            reportedName: typeof e.reportedName === 'string' ? e.reportedName : '',
            isTopHolding: Boolean(e.isTopHolding),
            holdingWeight:
              typeof e.holdingWeight === 'string' && e.holdingWeight.trim()
                ? e.holdingWeight.trim()
                : undefined,
            flag: typeof e.flag === 'string' ? e.flag : '🌐',
            reportDate: typeof e.reportDate === 'string' ? e.reportDate : '—',
            periodLabel: typeof e.periodLabel === 'string' ? e.periodLabel : 'ล่าสุด',
            revenueSummary: typeof e.revenueSummary === 'string' ? e.revenueSummary : '—',
            profitSummary: typeof e.profitSummary === 'string' ? e.profitSummary : '—',
            yoyChange: typeof e.yoyChange === 'string' ? e.yoyChange : undefined,
            status:
              typeof e.status === 'string' && validStatuses.has(e.status)
                ? e.status
                : 'upcoming',
            trendSummaryTh: typeof e.trendSummaryTh === 'string' ? e.trendSummaryTh : '',
            daysUntil: typeof e.daysUntil === 'number' ? Math.round(e.daysUntil) : null,
            isLiveSynced: true,
          }))
        : [];

      const dividends = Array.isArray(parsed.dividends)
        ? parsed.dividends.map((d: Record<string, unknown>, idx: number) => ({
            id: `live-div-${Date.now()}-${idx}`,
            symbol: typeof d.symbol === 'string' ? d.symbol.trim().toUpperCase() : '',
            name: typeof d.name === 'string' ? d.name : '',
            flag: typeof d.flag === 'string' ? d.flag : '🌐',
            applicable: d.applicable !== false,
            notApplicableReasonTh:
              d.applicable === false
                ? typeof d.notApplicableReasonTh === 'string' && d.notApplicableReasonTh.trim()
                  ? d.notApplicableReasonTh
                  : 'ไม่มีปันผล / ไม่อิงงบการเงิน'
                : undefined,
            xdDate: typeof d.xdDate === 'string' ? d.xdDate : '—',
            daysUntilXD: typeof d.daysUntilXD === 'number' ? Math.round(d.daysUntilXD) : null,
            dps: typeof d.dps === 'string' ? d.dps : '—',
            dividendYield: typeof d.dividendYield === 'string' ? d.dividendYield : '—',
            payDate: typeof d.payDate === 'string' ? d.payDate : '—',
            frequency: typeof d.frequency === 'string' ? d.frequency : undefined,
            noteTh: typeof d.noteTh === 'string' ? d.noteTh : undefined,
            isLiveSynced: true,
          }))
        : [];

      res.json({
        earnings,
        dividends,
        sources,
        syncedAt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ไม่สามารถดึงข้อมูลงบและวัน XD ได้';
      console.error('[/api/earnings-xd] error:', message);
      res.status(502).json({
        error: `ไม่สามารถอัปเดตข้อมูลงบการเงินและวัน XD ได้: ${message}`,
      });
    }
  });

  // 4. Social Media Deep Insights Feed (10-15 items across X.com, Facebook, YouTube) via Google Search Grounding
  app.post('/api/social-insights', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์',
      });
      return;
    }

    const portfolioEntries = parsePortfolioPayload(req.body?.portfolio);
    const focusTickers =
      portfolioEntries.length > 0
        ? portfolioEntries.map((p) => `${p.symbol} (${p.category})`).join(', ')
        : 'QQQM, SMH, BLOK, GLD, SLV, VOO, KCG, PTT, NVDA, BTC';

    const today = getTodayIso();

    try {
      const ai = createGeminiClient(apiKey);
      const prompt = `คุณเป็นบรรณาธิการข่าวการลงทุนและโซเชียลมีเดีย ใช้ Google Search ค้นหากระแสข่าว ประเด็นร้อน บทวิเคราะห์ และมุมมองนักลงทุนล่าสุด ณ วันที่ ${today} จากทั้ง 3 แพลตฟอร์มหลัก ได้แก่ X (x.com), Facebook (เพจวิเคราะห์หุ้น/การลงทุนไทยและต่างประเทศ) และ YouTube (ช่องหุ้น เศรษฐกิจ ETF และคริปโต) ที่เกี่ยวข้องกับสินทรัพย์ต่อไปนี้: ${focusTickers} และภาพรวมเศรษฐกิจโลก

กรุณาสรุปเป็น JSON เพียงอย่างเดียวจำนวน 12 รายการ (แบ่งสัดส่วนครบทั้ง x, facebook และ youtube แพลตฟอร์มละ 4 รายการ) ตามโครงสร้างต่อไปนี้:
{
  "items": [
    {
      "platform": "<x | facebook | youtube>",
      "channelName": "<ชื่อบัญชี/เพจ/ช่อง YouTube เช่น @KobeissiLetter, ลงทุนแมน, Finnomena, THE STANDARD WEALTH, SemiAnalysis>",
      "handleOrPage": "<ชื่อ Handle หรือป้ายช่อง เช่น @KobeissiLetter หรือ Facebook · Finnomena หรือ YouTube · ลงทุนแมน>",
      "timeLabel": "<เวลาอัปเดต เช่น 30 นาทีที่แล้ว, 2 ชม. ที่แล้ว, วันนี้>",
      "title": "<หัวข้อประเด็นร้อนภาษาไทยที่ดึงดูดและชัดเจน>",
      "deepSummaryTh": "<บทสรุปเชิงลึก 2-3 ประโยคภาษาไทย อธิบายประเด็นสำคัญ ตัวเลข หรือข้อมูลที่มีการถกเถียง>",
      "analystViewTh": "<มุมมองนักวิเคราะห์/เพจ/ช่อง 1-2 ประโยคว่าควรวางแผนหรือจับตาจุดใด>",
      "sentiment": "<bullish | bearish | watch>",
      "relatedAssets": ["<Ticker ที่เกี่ยวข้อง เช่น QQQM, SMH, GLD, KCG>"],
      "countryFlag": "<อีโมจิธงชาติ เช่น 🇺🇸 🇹🇭 🇨🇳 🇯🇵 🌐>",
      "sourceUrl": "<URL จริงจากผลการค้นหาถ้ามี หรือเว้นว่าง>",
      "searchQuery": "<คำค้นหาสั้นๆ สำหรับค้นหาประเด็นนี้ต่อบนแพลตฟอร์ม>"
    }
  ]
}

เงื่อนไขสำคัญ:
- สร้าง items จำนวน 12 รายการ (10-15 รายการ) กระจายครบทั้ง X.com, Facebook และ YouTube
- เน้นความสดใหม่และเชื่อมโยงโดยตรงกับสินทรัพย์ในพอร์ตของผู้ใช้ (${focusTickers})
- ใช้ภาษาไทยที่คมชัดระดับมืออาชีพ
- ตอบกลับเป็น JSON ที่ถูกต้องตาม syntax เท่านั้น`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          tools: [{ googleSearch: {} }],
        },
      });

      const parsed = JSON.parse(extractJsonBlock(response.text ?? ''));
      const sources = extractGroundingSources(response);
      const syncedAt = new Date().toISOString();

      const items = Array.isArray(parsed.items)
        ? parsed.items
            .map((it: Record<string, unknown>, idx: number) => {
              const rawPlat = String(it.platform || '').toLowerCase();
              const platform =
                rawPlat === 'facebook' || rawPlat === 'youtube' ? rawPlat : 'x';
              const rawSent = String(it.sentiment || '').toLowerCase();
              const sentiment =
                rawSent === 'bullish' || rawSent === 'bearish' ? rawSent : 'watch';
              const rawUrl = typeof it.sourceUrl === 'string' ? it.sourceUrl.trim() : '';
              const safeUrl =
                rawUrl.startsWith('https://') || rawUrl.startsWith('http://')
                  ? rawUrl
                  : undefined;

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
                timeLabel: typeof it.timeLabel === 'string' ? it.timeLabel : 'ล่าสุดวันนี้',
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
                countryFlag: typeof it.countryFlag === 'string' ? it.countryFlag : '🌐',
                sourceUrl: safeUrl,
                searchQuery:
                  typeof it.searchQuery === 'string' && it.searchQuery.trim()
                    ? it.searchQuery.trim()
                    : undefined,
                isLiveSynced: true,
              };
            })
            .filter((x: { title: string }) => x.title.length > 0)
        : [];

      res.json({
        items,
        sources,
        syncedAt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ไม่สามารถดึงฟีดโซเชียลได้';
      console.error('[/api/social-insights] error:', message);
      res.status(502).json({
        error: `ไม่สามารถอัปเดตฟีดข่าวโซเชียลได้ในขณะนี้: ${message}`,
      });
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
    console.log(`InvestCal server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start InvestCal server:', err);
  process.exit(1);
});
