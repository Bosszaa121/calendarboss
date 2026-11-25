import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', hasGeminiKey: Boolean(process.env.GEMINI_API_KEY) });
  });

  app.post('/api/sync', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์ จึงไม่สามารถดึงข้อมูลแบบเรียลไทม์จาก Google Search ได้ในขณะนี้',
      });
      return;
    }

    const rawSymbols: unknown = req.body?.symbols;
    const symbols = Array.isArray(rawSymbols)
      ? rawSymbols
          .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
          .slice(0, 20)
      : ['NVDA', 'VOO', 'QQQ', 'PTT.BK', 'BTC', 'USD/THB'];

    const today = getTodayIso();
    const endDate = addDaysIso(14);
    const yesterday = addDaysIso(-1);

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `คุณเป็นนักวิเคราะห์ตลาดการเงินระดับโลก ใช้ Google Search ค้นหาข้อมูลการลงทุนล่าสุด ณ วันที่ ${today} สำหรับพอร์ตโฟลิโอที่ถือครอง: ${symbols.join(', ')}

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
      "countryCode": "<US|TH|JP|EU|GB|NZ|CN|AU>",
      "flag": "<อีโมจิธงชาติ เช่น 🇺🇸 🇹🇭 🇯🇵 🇪🇺 🇬🇧 🇳🇿 🇨🇳>",
      "currency": "<USD|THB|JPY|EUR|GBP|NZD|CNY|AUD>",
      "countryNameTh": "<ชื่อประเทศภาษาไทย>",
      "impact": <1 | 2 | 3>,
      "category": "<economic | earnings | dividend>",
      "title": "<ชื่อเหตุการณ์ภาษาไทยพร้อมชื่อย่ออังกฤษ>",
      "actual": "<ค่าจริง หรือ — ถ้ายังไม่ประกาศ>",
      "forecast": "<ค่าคาดการณ์ หรือ —>",
      "previous": "<ค่าครั้งก่อน หรือ —>",
      "actualOutcome": "<better | worse | inline | pending>",
      "relatedAssets": ["<Ticker ที่เกี่ยวข้อง เช่น NVDA, VOO, USD/THB, BTC>"],
      "descriptionTh": "<คำอธิบายสั้นๆ 1 ประโยคว่ากระทบตลาดอย่างไร>"
    }
  ],
  "newsItems": [
    {
      "timeLabel": "<เช่น ล่าสุดวันนี้ หรือ 1 ชม. ที่แล้ว>",
      "source": "<ชื่อแหล่งข่าว เช่น Bloomberg, Reuters, CNBC, SET>",
      "headline": "<พาดหัวข่าวภาษาไทยที่กระชับ ชัดเจน>",
      "impactSummary": "<อธิบายสั้นๆ 1-2 ประโยคว่าข่าวนี้ส่งผลบวกหรือลบต่อสินทรัพย์อย่างไร>",
      "sentiment": "<bullish | bearish | neutral>",
      "relatedAssets": ["<Ticker ที่ได้รับผลกระทบ>"],
      "countryFlag": "<อีโมจิธงชาติหรือ 🌐>"
    }
  ]
}

เงื่อนไขสำคัญ:
- สร้าง calendarEvents จำนวน 8-12 รายการจริงที่สำคัญในช่วง ${yesterday} ถึง ${endDate} ให้ครอบคลุมทั้งตัวเลขเศรษฐกิจ (CPI, GDP, Fed/ECB/BoJ/BoT), ประกาศงบ (earnings) และวันขึ้น XD ปันผล (dividend) โดยเฉพาะที่เกี่ยวข้องกับ ${symbols.join(', ')}
- สร้าง newsItems จำนวน 6-8 ข่าวจริงล่าสุดที่มีผลต่อตลาดโลกและสินทรัพย์ ${symbols.join(', ')}
- ตอบกลับเป็น JSON ที่ถูกต้องตาม syntax เท่านั้น`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const rawText = response.text ?? '';
      const jsonStr = extractJsonBlock(rawText);
      const parsed = JSON.parse(jsonStr);

      const rawChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
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

      const syncedAt = new Date().toISOString();

      const calendarEvents = Array.isArray(parsed.calendarEvents)
        ? parsed.calendarEvents.map((ev: Record<string, unknown>, idx: number) => ({
            id: `live-ev-${Date.now()}-${idx}`,
            date: typeof ev.date === 'string' ? ev.date : today,
            time: typeof ev.time === 'string' ? ev.time : '19:30',
            countryCode: typeof ev.countryCode === 'string' ? ev.countryCode : 'US',
            flag: typeof ev.flag === 'string' ? ev.flag : '🌐',
            currency: typeof ev.currency === 'string' ? ev.currency : 'USD',
            countryNameTh: typeof ev.countryNameTh === 'string' ? ev.countryNameTh : 'ต่างประเทศ',
            impact: ev.impact === 3 || ev.impact === 2 || ev.impact === 1 ? ev.impact : 2,
            category:
              ev.category === 'earnings' || ev.category === 'dividend'
                ? ev.category
                : 'economic',
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
            descriptionTh: typeof ev.descriptionTh === 'string' ? ev.descriptionTh : '',
            isLiveSynced: true,
          }))
        : [];

      const newsItems = Array.isArray(parsed.newsItems)
        ? parsed.newsItems.map((item: Record<string, unknown>, idx: number) => ({
            id: `live-news-${Date.now()}-${idx}`,
            publishedAt: syncedAt,
            timeLabel: typeof item.timeLabel === 'string' ? item.timeLabel : 'ล่าสุดวันนี้',
            source: typeof item.source === 'string' ? item.source : 'Global Wire',
            headline: typeof item.headline === 'string' ? item.headline : '',
            impactSummary: typeof item.impactSummary === 'string' ? item.impactSummary : '',
            sentiment:
              item.sentiment === 'bullish' || item.sentiment === 'bearish'
                ? item.sentiment
                : 'neutral',
            relatedAssets: Array.isArray(item.relatedAssets)
              ? item.relatedAssets.filter((x): x is string => typeof x === 'string')
              : [],
            countryFlag: typeof item.countryFlag === 'string' ? item.countryFlag : '🌐',
            isLiveSynced: true,
          })).filter((n: { headline: string }) => n.headline.length > 0)
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
              updatedLabel: 'อัปเดตสดจากเว็บ',
            }
          : undefined;

      res.json({
        calendarEvents,
        newsItems,
        fearGreed,
        sources: sources.slice(0, 6),
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
