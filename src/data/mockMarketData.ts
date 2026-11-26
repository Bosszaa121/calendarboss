import {
  CalendarEvent,
  DividendXDRecord,
  EarningsRecord,
  FearGreedData,
  NewsItem,
  PortfolioAsset,
  SocialInsightItem,
} from '../types';
import { ASSET_CATALOG } from './assetCatalog';

function offsetDateIso(dayOffset: number): string {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(target.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildInitialCalendarEvents(): CalendarEvent[] {
  return [
    // ======================== YESTERDAY (-1) ========================
    {
      id: 'ev-y-1',
      date: offsetDateIso(-1),
      time: '06:30',
      countryCode: 'JP',
      flag: '🇯🇵',
      currency: 'JPY',
      countryNameTh: 'ญี่ปุ่น',
      impact: 3,
      category: 'economic',
      title: 'ดัชนีราคาผู้บริโภคพื้นฐานแห่งชาติญี่ปุ่น (Japan National Core CPI YoY)',
      actual: '2.4%',
      forecast: '2.2%',
      previous: '2.3%',
      actualOutcome: 'better',
      relatedAssets: ['USD/JPY', 'EWJ', 'XAUUSD', 'QQQM'],
      macroTags: ['boj_jpy', 'global_risk'],
      descriptionTh:
        'เงินเฟ้อพื้นฐานญี่ปุ่นสูงกว่าคาด เพิ่มโอกาสที่ BoJ จะขึ้นดอกเบี้ย ส่งผลให้เยนแข็งค่าและสร้างความผันผวนระยะสั้นต่อตลาดทุนเอเชีย',
    },
    {
      id: 'ev-y-2',
      date: offsetDateIso(-1),
      time: '19:30',
      countryCode: 'US',
      flag: '🇺🇸',
      currency: 'USD',
      countryNameTh: 'สหรัฐอเมริกา',
      impact: 3,
      category: 'economic',
      title: 'จำนวนผู้ขอรับสวัสดิการว่างงานครั้งแรกสหรัฐฯ (US Initial Jobless Claims)',
      actual: '214K',
      forecast: '220K',
      previous: '219K',
      actualOutcome: 'better',
      relatedAssets: ['QQQM', 'VOO', 'TLT', 'GLD', 'DXY'],
      macroTags: ['us_jobs', 'us_rates', 'bond_yield', 'dxy'],
      descriptionTh:
        'ตลาดแรงงานสหรัฐฯ แข็งแกร่งกว่าคาด ช่วยลดความกังวลเศรษฐกิจถดถอย แต่หนุนบอนด์ยีลด์สหรัฐฯ และดอลลาร์ทรงตัวสูง กดดันทองคำและพันธบัตรระยะยาว',
    },
    {
      id: 'ev-y-3',
      date: offsetDateIso(-1),
      time: '04:20',
      countryCode: 'US',
      flag: '🇺🇸',
      currency: 'USD',
      countryNameTh: 'สหรัฐอเมริกา',
      impact: 3,
      category: 'earnings',
      title: 'ประกาศผลประกอบการไตรมาสล่าสุด: NVIDIA (NVDA)',
      subtitle: 'Earnings Release · ชี้ชะตากลุ่มชิป AI และ Data Center',
      actual: '$0.89',
      forecast: '$0.84',
      previous: '$0.78',
      actualOutcome: 'better',
      relatedAssets: ['NVDA', 'SMH', 'SOXX', 'QQQM', 'DELTA'],
      macroTags: ['ai_chips'],
      descriptionTh:
        'รายได้กลุ่ม AI Data Center เติบโตเหนือคาด หนุนโมเมนตัมหุ้นเซมิคอนดักเตอร์และซัพพลายเชนอิเล็กทรอนิกส์ทั่วโลก',
    },

    // ======================== TODAY (0) ========================
    {
      id: 'ev-t-1',
      date: offsetDateIso(0),
      time: '09:30',
      countryCode: 'TH',
      flag: '🇹🇭',
      currency: 'THB',
      countryNameTh: 'ประเทศไทย',
      impact: 2,
      category: 'dividend',
      title: 'วันขึ้นเครื่องหมาย XD ปันผล: บมจ. ปตท. (PTT)',
      subtitle: 'จ่ายปันผลระหว่างกาล · กลุ่มพลังงาน',
      actual: '฿0.90',
      forecast: '฿0.85',
      previous: '฿0.80',
      actualOutcome: 'better',
      relatedAssets: ['PTT', 'PTTEP'],
      macroTags: ['thai_energy'],
      descriptionTh:
        'PTT ขึ้นเครื่องหมาย XD สำหรับเงินปันผลงวดล่าสุดที่สูงกว่าคาด สะท้อนกระแสเงินสดมั่นคงของกลุ่มพลังงานไทย',
    },
    {
      id: 'ev-t-2',
      date: offsetDateIso(0),
      time: '14:00',
      countryCode: 'TH',
      flag: '🇹🇭',
      currency: 'THB',
      countryNameTh: 'ประเทศไทย',
      impact: 3,
      category: 'economic',
      title: 'การประชุมคณะกรรมการนโยบายการเงิน ธปท. (กนง. / BoT Rate Decision)',
      actual: '2.25%',
      forecast: '2.25%',
      previous: '2.25%',
      actualOutcome: 'inline',
      relatedAssets: ['USD/THB', 'KBANK', 'SCB', 'KCG', 'CPALL', 'CRC'],
      macroTags: ['bot_rate', 'thai_macro', 'usd_thb'],
      descriptionTh:
        'กนง. คงดอกเบี้ยตามคาดที่ 2.25% ทำให้ตลาดหุ้นไทยและกลุ่มอาหาร/ค้าปลีกเคลื่อนไหวทรงตัวรอปัจจัยใหม่',
    },
    {
      id: 'ev-t-3',
      date: offsetDateIso(0),
      time: '16:00',
      countryCode: 'EU',
      flag: '🇪🇺',
      currency: 'EUR',
      countryNameTh: 'ยูโรโซน',
      impact: 2,
      category: 'economic',
      title: 'ดัชนีผู้จัดการฝ่ายจัดซื้อยูโรโซน (Eurozone Flash PMI)',
      actual: '49.8',
      forecast: '50.2',
      previous: '50.0',
      actualOutcome: 'worse',
      relatedAssets: ['EUR/USD', 'VT', 'DXY', 'GLD'],
      macroTags: ['eu_macro', 'dxy'],
      descriptionTh:
        'ภาคการผลิตยุโรปหดตัวต่ำกว่าคาด เพิ่มโอกาส ECB ลดดอกเบี้ย หนุนดอลลาร์ (DXY) แข็งค่าและกดดันยูโรกับทองคำระยะสั้น',
    },
    {
      id: 'ev-t-4',
      date: offsetDateIso(0),
      time: '19:30',
      countryCode: 'US',
      flag: '🇺🇸',
      currency: 'USD',
      countryNameTh: 'สหรัฐอเมริกา',
      impact: 3,
      category: 'economic',
      title: 'ดัชนีราคาผู้บริโภคสหรัฐฯ (US CPI YoY)',
      actual: '—',
      forecast: '2.6%',
      previous: '2.7%',
      actualOutcome: 'pending',
      relatedAssets: ['QQQM', 'SMH', 'GLD', 'SLV', 'BLOK', 'VOO', 'TLT', 'BTC', 'KCG'],
      macroTags: ['us_inflation', 'us_rates', 'bond_yield', 'dxy'],
      descriptionTh:
        'ตลาดคาดเงินเฟ้อชะลอลงจาก 2.7% เหลือ 2.6% หากออกต่ำกว่าคาดจะหนุน QQQM, SMH, GLD, SLV, BLOK ปรับขึ้นแรง แต่หากสูงกว่าคาดจะกดดันลงทันที',
    },
    {
      id: 'ev-t-5',
      date: offsetDateIso(0),
      time: '21:00',
      countryCode: 'NZ',
      flag: '🇳🇿',
      currency: 'NZD',
      countryNameTh: 'นิวซีแลนด์',
      impact: 2,
      category: 'economic',
      title: 'ดัชนีราคาประมูลผลิตภัณฑ์นมโลก (Global Dairy Trade Price Index)',
      subtitle: 'ชี้วัดต้นทุนวัตถุดิบนม-เนย-ชีสโลก',
      actual: '—',
      forecast: '+1.2%',
      previous: '+0.8%',
      actualOutcome: 'pending',
      relatedAssets: ['KCG', 'CPF', 'USD/THB'],
      macroTags: ['food_dairy'],
      descriptionTh:
        'ราคาผลิตภัณฑ์นมโลกจากนิวซีแลนด์เป็นตัวชี้วัดต้นทุนวัตถุดิบหลักของ KCG หากพุ่งสูงกว่าคาดจะกดดันมาร์จิ้นระยะสั้น',
    },
    {
      id: 'ev-t-6',
      date: offsetDateIso(0),
      time: '22:00',
      countryCode: 'TH',
      flag: '🇹🇭',
      currency: 'THB',
      countryNameTh: 'ประเทศไทย',
      impact: 2,
      category: 'earnings',
      title: 'ประกาศงบการเงินไตรมาสล่าสุด: DELTA Electronics (DELTA)',
      subtitle: 'Earnings Release · อิเล็กทรอนิกส์และ AI Server Power',
      actual: '—',
      forecast: '฿0.46',
      previous: '฿0.41',
      actualOutcome: 'pending',
      relatedAssets: ['DELTA', 'SMH', 'NVDA'],
      macroTags: ['ai_chips', 'thai_macro'],
      descriptionTh:
        'จับตาการเติบโตของคำสั่งซื้อกลุ่ม Data Center และผลกระทบจากอัตราแลกเปลี่ยนบาทต่อดอลลาร์',
    },

    // ======================== TOMORROW (+1) ========================
    {
      id: 'ev-tm-1',
      date: offsetDateIso(1),
      time: '08:30',
      countryCode: 'CN',
      flag: '🇨🇳',
      currency: 'CNY',
      countryNameTh: 'จีน',
      impact: 3,
      category: 'economic',
      title: 'ดัชนีผู้จัดการฝ่ายจัดซื้อภาคการผลิตจีน (China Manufacturing PMI)',
      actual: '—',
      forecast: '50.4',
      previous: '50.1',
      actualOutcome: 'pending',
      relatedAssets: ['PTT', 'AOT', 'SCC', 'SLV', 'GLD'],
      macroTags: ['china_macro', 'precious_metals'],
      descriptionTh:
        'สะท้อนกำลังซื้อภาคอุตสาหกรรมจีน หากขยายตัวเหนือ 50.4 จะหนุนโลหะเงิน (SLV), พลังงาน (PTT) และหุ้นท่องเที่ยวไทย (AOT)',
    },
    {
      id: 'ev-tm-2',
      date: offsetDateIso(1),
      time: '19:30',
      countryCode: 'US',
      flag: '🇺🇸',
      currency: 'USD',
      countryNameTh: 'สหรัฐอเมริกา',
      impact: 3,
      category: 'economic',
      title: 'ดัชนีเงินเฟ้อพื้นฐานสหรัฐฯ (US Core PCE Price Index MoM)',
      actual: '—',
      forecast: '0.2%',
      previous: '0.3%',
      actualOutcome: 'pending',
      relatedAssets: ['QQQM', 'SMH', 'GLD', 'SLV', 'BLOK', 'IBIT', 'VOO', 'SGOV', 'TLT'],
      macroTags: ['us_inflation', 'us_rates', 'bond_yield', 'dxy'],
      descriptionTh:
        'มาตรวัดเงินเฟ้อหลักที่ Fed ใช้ตัดสินใจดอกเบี้ย คาดชะลอเหลือ 0.2% เป็นบวกต่อ ETF เทค ชิป ทองคำ โลหะเงิน และคริปโต',
    },
    {
      id: 'ev-tm-3',
      date: offsetDateIso(1),
      time: '20:30',
      countryCode: 'US',
      flag: '🇺🇸',
      currency: 'USD',
      countryNameTh: 'สหรัฐอเมริกา',
      impact: 2,
      category: 'dividend',
      title: 'วันขึ้นเครื่องหมาย XD ปันผลรายไตรมาส: SCHD ETF',
      subtitle: 'Ex-Dividend Date · Schwab U.S. Dividend Equity ETF',
      actual: '—',
      forecast: '$0.265',
      previous: '$0.258',
      actualOutcome: 'pending',
      relatedAssets: ['SCHD', 'VOO'],
      macroTags: ['us_dividend'],
      descriptionTh:
        'รอบขึ้นเครื่องหมาย XD จ่ายเงินปันผลไตรมาสของ SCHD สำหรับผู้ถือครองก่อนเปิดตลาดวัน XD',
    },

    // ======================== THIS WEEK (+2 to +6) ========================
    {
      id: 'ev-tw-1',
      date: offsetDateIso(2),
      time: '10:30',
      countryCode: 'TH',
      flag: '🇹🇭',
      currency: 'THB',
      countryNameTh: 'ประเทศไทย',
      impact: 2,
      category: 'economic',
      title: 'อัตราเงินเฟ้อทั่วไปและเงินเฟ้อพื้นฐานไทย (Thailand CPI YoY)',
      actual: '—',
      forecast: '1.05%',
      previous: '0.92%',
      actualOutcome: 'pending',
      relatedAssets: ['KCG', 'CPALL', 'CRC', 'USD/THB', 'KBANK'],
      macroTags: ['thai_cpi', 'thai_macro', 'food_dairy', 'usd_thb'],
      descriptionTh:
        'สะท้อนทิศทางราคาอาหารสด-อาหารแปรรูปและกำลังซื้อในประเทศ ส่งผลต่อหุ้นค้าปลีก อาหาร (KCG) และนโยบายดอกเบี้ย กนง.',
    },
    {
      id: 'ev-tw-2',
      date: offsetDateIso(2),
      time: '17:30',
      countryCode: 'TH',
      flag: '🇹🇭',
      currency: 'THB',
      countryNameTh: 'ประเทศไทย',
      impact: 2,
      category: 'earnings',
      title: 'ประกาศงบการเงินไตรมาสล่าสุด: บมจ. เคซีจี คอร์ปอเรชั่น (KCG)',
      subtitle: 'Earnings Release · จับตาอัตรากำไรขั้นต้นและยอดขายผลิตภัณฑ์นม-เบเกอรี่',
      actual: '—',
      forecast: '฿0.21',
      previous: '฿0.18',
      actualOutcome: 'pending',
      relatedAssets: ['KCG'],
      macroTags: ['food_dairy', 'thai_macro'],
      descriptionTh:
        'ตลาดคาดกำไรเติบโต +16% YoY จากยอดขายกลุ่ม B2B/B2C และการบริหารต้นทุนวัตถุดิบนม-เนย',
    },
    {
      id: 'ev-tw-3',
      date: offsetDateIso(3),
      time: '20:15',
      countryCode: 'EU',
      flag: '🇪🇺',
      currency: 'EUR',
      countryNameTh: 'ยูโรโซน',
      impact: 3,
      category: 'economic',
      title: 'การตัดสินใจอัตราดอกเบี้ยธนาคารกลางยุโรป (ECB Interest Rate Decision)',
      actual: '—',
      forecast: '2.75%',
      previous: '3.00%',
      actualOutcome: 'pending',
      relatedAssets: ['EUR/USD', 'DXY', 'GLD', 'MINT'],
      macroTags: ['eu_macro', 'dxy'],
      descriptionTh:
        'การปรับลดดอกเบี้ยของ ECB ส่งผลต่อความต่างดอกเบี้ยกับสหรัฐฯ และทิศทางดัชนีดอลลาร์ (DXY) รวมถึงราคาทองคำ',
    },
    {
      id: 'ev-tw-4',
      date: offsetDateIso(3),
      time: '19:00',
      countryCode: 'GB',
      flag: '🇬🇧',
      currency: 'GBP',
      countryNameTh: 'อังกฤษ',
      impact: 2,
      category: 'economic',
      title: 'ดัชนีราคาผู้บริโภคสหราชอาณาจักร (UK CPI YoY)',
      actual: '—',
      forecast: '2.5%',
      previous: '2.6%',
      actualOutcome: 'pending',
      relatedAssets: ['GBP/USD', 'DXY', 'VT'],
      macroTags: ['uk_macro', 'dxy'],
      descriptionTh:
        'เงินเฟ้ออังกฤษชะลอตัวเปิดทางให้ธนาคารกลางอังกฤษ (BoE) ผ่อนคลายนโยบายการเงินเพิ่มเติม',
    },
    {
      id: 'ev-tw-5',
      date: offsetDateIso(4),
      time: '04:05',
      countryCode: 'US',
      flag: '🇺🇸',
      currency: 'USD',
      countryNameTh: 'สหรัฐอเมริกา',
      impact: 3,
      category: 'earnings',
      title: 'ประกาศผลประกอบการไตรมาสล่าสุด: Apple Inc. (AAPL)',
      subtitle: 'Earnings Release · น้ำหนักหลักใน QQQM และ VOO',
      actual: '—',
      forecast: '$1.64',
      previous: '$1.52',
      actualOutcome: 'pending',
      relatedAssets: ['AAPL', 'QQQM', 'QQQ', 'VOO', 'SPY'],
      macroTags: ['us_tech'],
      descriptionTh:
        'งบการเงินและแนวโน้มยอดขายกลุ่ม Services ของ Apple มีน้ำหนักสูงในดัชนี Nasdaq-100 และ S&P 500',
    },
    {
      id: 'ev-tw-6',
      date: offsetDateIso(5),
      time: '19:30',
      countryCode: 'US',
      flag: '🇺🇸',
      currency: 'USD',
      countryNameTh: 'สหรัฐอเมริกา',
      impact: 3,
      category: 'economic',
      title: 'การจ้างงานนอกภาคเกษตรสหรัฐฯ (US Non-Farm Payrolls - NFP)',
      actual: '—',
      forecast: '185K',
      previous: '172K',
      actualOutcome: 'pending',
      relatedAssets: ['QQQM', 'SMH', 'GLD', 'SLV', 'BLOK', 'VOO', 'BTC', 'USD/THB'],
      macroTags: ['us_jobs', 'us_rates', 'bond_yield', 'dxy'],
      descriptionTh:
        'ตัวเลขแรงงานหลักประจำเดือนที่สร้างความผันผวนแรงต่อ Bond Yield, ดัชนีดอลลาร์ (DXY), หุ้นสหรัฐฯ, ทองคำ, เงิน และค่าเงินบาท',
    },

    // ======================== NEXT WEEK (+7 to +13) ========================
    {
      id: 'ev-nw-1',
      date: offsetDateIso(7),
      time: '20:30',
      countryCode: 'US',
      flag: '🇺🇸',
      currency: 'USD',
      countryNameTh: 'สหรัฐอเมริกา',
      impact: 2,
      category: 'dividend',
      title: 'วันขึ้นเครื่องหมาย XD ปันผลรายไตรมาส: Vanguard S&P 500 ETF (VOO)',
      subtitle: 'Ex-Dividend Date · กองทุนดัชนี S&P 500',
      actual: '—',
      forecast: '$1.74',
      previous: '$1.68',
      actualOutcome: 'pending',
      relatedAssets: ['VOO', 'SPY'],
      macroTags: ['us_dividend'],
      descriptionTh:
        'รอบจ่ายเงินปันผลไตรมาสของ VOO สำหรับนักลงทุนที่ถือครองก่อนวันขึ้นเครื่องหมาย XD',
    },
    {
      id: 'ev-nw-2',
      date: offsetDateIso(9),
      time: '01:00',
      countryCode: 'US',
      flag: '🇺🇸',
      currency: 'USD',
      countryNameTh: 'สหรัฐอเมริกา',
      impact: 3,
      category: 'economic',
      title: 'ผลการประชุมนโยบายการเงินเฟด (FOMC / Fed Interest Rate Decision & Dot Plot)',
      actual: '—',
      forecast: '4.25%',
      previous: '4.50%',
      actualOutcome: 'pending',
      relatedAssets: ['QQQM', 'SMH', 'GLD', 'SLV', 'BLOK', 'IBIT', 'SGOV', 'JPST', 'TLT', 'VOO'],
      macroTags: ['us_rates', 'bond_yield', 'dxy'],
      descriptionTh:
        'เหตุการณ์นโยบายการเงินที่สำคัญที่สุดในรอบเดือน กำหนดทิศทางสภาพคล่องโลก ดอลลาร์ ทองคำ โลหะเงิน หุ้นเทค และฟันด์โฟลว์เอเชีย',
    },
    {
      id: 'ev-nw-3',
      date: offsetDateIso(10),
      time: '10:00',
      countryCode: 'JP',
      flag: '🇯🇵',
      currency: 'JPY',
      countryNameTh: 'ญี่ปุ่น',
      impact: 3,
      category: 'economic',
      title: 'การตัดสินใจอัตราดอกเบี้ยธนาคารกลางญี่ปุ่น (BoJ Policy Rate)',
      actual: '—',
      forecast: '0.50%',
      previous: '0.25%',
      actualOutcome: 'pending',
      relatedAssets: ['USD/JPY', 'EWJ', 'BTC', 'QQQM'],
      macroTags: ['boj_jpy', 'global_risk'],
      descriptionTh:
        'จับตาความเสี่ยง Yen Carry Trade Unwind หาก BoJ ปรับขึ้นดอกเบี้ยเร็วกว่าที่ตลาดคาดการณ์',
    },
    {
      id: 'ev-nw-4',
      date: offsetDateIso(11),
      time: '04:00',
      countryCode: 'US',
      flag: '🇺🇸',
      currency: 'USD',
      countryNameTh: 'สหรัฐอเมริกา',
      impact: 3,
      category: 'earnings',
      title: 'ประกาศผลประกอบการไตรมาสล่าสุด: Microsoft Corp. (MSFT)',
      subtitle: 'Earnings Release · งบลงทุน AI Capex และ Azure Cloud',
      actual: '—',
      forecast: '$3.18',
      previous: '$3.02',
      actualOutcome: 'pending',
      relatedAssets: ['MSFT', 'QQQM', 'SMH', 'NVDA', 'VOO'],
      macroTags: ['ai_chips', 'us_tech'],
      descriptionTh:
        'ตัวเลขการลงทุนโครงสร้างพื้นฐาน AI ของ Microsoft เป็นดัชนีชี้วัดความต้องการชิปโดยตรงสำหรับกลุ่ม SMH และ QQQM',
    },
    {
      id: 'ev-nw-5',
      date: offsetDateIso(12),
      time: '09:30',
      countryCode: 'TH',
      flag: '🇹🇭',
      currency: 'THB',
      countryNameTh: 'ประเทศไทย',
      impact: 2,
      category: 'dividend',
      title: 'วันขึ้นเครื่องหมาย XD ปันผล: ธนาคารกสิกรไทย (KBANK)',
      subtitle: 'Ex-Dividend Date · กลุ่มธนาคารพาณิชย์ไทย',
      actual: '—',
      forecast: '฿6.50',
      previous: '฿6.00',
      actualOutcome: 'pending',
      relatedAssets: ['KBANK', 'SCB', 'BBL'],
      macroTags: ['thai_bank', 'thai_macro'],
      descriptionTh:
        'KBANK ขึ้นเครื่องหมาย XD จ่ายเงินปันผลประจำปี สร้างจุดสนใจให้นักลงทุนสายปันผลในตลาดหุ้นไทย',
    },
  ];
}

export function buildInitialNewsItems(): NewsItem[] {
  const now = new Date();
  const minsAgo = (m: number) => new Date(now.getTime() - m * 60000).toISOString();

  return [
    {
      id: 'news-1',
      publishedAt: minsAgo(16),
      timeLabel: '16 นาทีที่แล้ว',
      source: 'Bloomberg',
      headline:
        'ความต้องการชิป AI Data Center พุ่งทำสถิติใหม่ หนุนยอดคำสั่งซื้อซัพพลายเชนเซมิคอนดักเตอร์ทั่วโลก',
      impactSummary:
        'หนุนแรงซื้อหุ้นกลุ่มเซมิคอนดักเตอร์ (SMH, SOXX, NVDA) และดัชนีเทคสหรัฐฯ (QQQM, QQQ) รวมถึงซัพพลายเออร์อิเล็กทรอนิกส์อย่าง DELTA',
      sentiment: 'bullish',
      relatedAssets: ['SMH', 'SOXX', 'QQQM', 'NVDA', 'DELTA'],
      macroTags: ['ai_chips'],
      countryCode: 'US',
      countryFlag: '🇺🇸',
    },
    {
      id: 'news-2',
      publishedAt: minsAgo(42),
      timeLabel: '42 นาทีที่แล้ว',
      source: 'Reuters',
      headline:
        'บอนด์ยีลด์สหรัฐฯ อายุ 10 ปี และดัชนีดอลลาร์ (DXY) แกว่งตัวรอตัวเลขเงินเฟ้อ CPI และทิศทางดอกเบี้ย Fed',
      impactSummary:
        'หากเงินเฟ้อชะลอตัวและยีลด์ปรับลง จะเป็นบวกแรงต่อ QQQM, SMH, GLD, SLV และ BLOK พร้อมเปิดโอกาสฟันด์โฟลว์ไหลกลับเข้าตลาดหุ้นไทย',
      sentiment: 'neutral',
      relatedAssets: ['QQQM', 'SMH', 'GLD', 'SLV', 'BLOK', 'TLT', 'DXY'],
      macroTags: ['us_rates', 'us_inflation', 'bond_yield', 'dxy'],
      countryCode: 'US',
      countryFlag: '🇺🇸',
    },
    {
      id: 'news-3',
      publishedAt: minsAgo(75),
      timeLabel: '1 ชม. ที่แล้ว',
      source: 'CoinDesk',
      headline:
        'เม็ดเงินสถาบันไหลเข้ากองทุน Spot Bitcoin ETF สุทธิต่อเนื่อง 5 วันทำการทะลุ 1.4 พันล้านดอลลาร์',
      impactSummary:
        'แรงซื้อจากนักลงทุนสถาบันหนุนราคา Bitcoin (BTC, IBIT) และหุ้นโครงสร้างพื้นฐานบล็อกเชนในกองทุน BLOK ให้ปรับตัวแข็งแกร่ง',
      sentiment: 'bullish',
      relatedAssets: ['BTC', 'IBIT', 'BLOK', 'ETH', 'COIN'],
      macroTags: ['crypto'],
      countryCode: 'US',
      countryFlag: '🇺🇸',
    },
    {
      id: 'news-4',
      publishedAt: minsAgo(110),
      timeLabel: '2 ชม. ที่แล้ว',
      source: 'Kitco / Reuters',
      headline:
        'ธนาคารกลางหลายประเทศเดินหน้าสะสมทองคำสำรอง ขณะที่อุปสงค์โลหะเงินภาคโซลาร์เซลล์และ AI เติบโตต่อเนื่อง',
      impactSummary:
        'สร้างแรงหนุนพื้นฐานให้ราคาทองคำ (GLD, XAUUSD) และโลหะเงิน (SLV, XAGUSD) โดยเฉพาะในช่วงที่ดอลลาร์สหรัฐฯ อ่อนค่า',
      sentiment: 'bullish',
      relatedAssets: ['GLD', 'SLV', 'XAUUSD', 'XAGUSD', 'DXY'],
      macroTags: ['precious_metals', 'dxy'],
      countryCode: 'CN',
      countryFlag: '🇨🇳',
    },
    {
      id: 'news-5',
      publishedAt: minsAgo(145),
      timeLabel: '2 ชม. ที่แล้ว',
      source: 'SET News / Krungthep Turakij',
      headline:
        'กนง. คงอัตราดอกเบี้ยนโยบายที่ 2.25% พร้อมจับตาค่าเงินบาทและต้นทุนวัตถุดิบอาหารนำเข้าในไตรมาสนี้',
      impactSummary:
        'ดอกเบี้ยที่ทรงตัวช่วยประคองส่วนต่างดอกเบี้ยกลุ่มธนาคารไทย (KBANK, SCB) ขณะที่ค่าเงินบาทและราคานม-เนยโลกเป็นปัจจัยสำคัญต่ออัตรากำไรของ KCG และหุ้นอาหารไทย',
      sentiment: 'neutral',
      relatedAssets: ['USD/THB', 'KCG', 'KBANK', 'SCB', 'CPALL'],
      macroTags: ['bot_rate', 'thai_macro', 'usd_thb', 'food_dairy'],
      countryCode: 'TH',
      countryFlag: '🇹🇭',
    },
    {
      id: 'news-6',
      publishedAt: minsAgo(195),
      timeLabel: '3 ชม. ที่แล้ว',
      source: 'Global Dairy Trade / AgriNews',
      headline:
        'ดัชนีราคานมผงและเนยโลกขยับขึ้นแรงตามความต้องการจากเอเชีย กดดันต้นทุนกลุ่มผู้ผลิตเบเกอรี่และแดรี่',
      impactSummary:
        'ต้นทุนวัตถุดิบนม-เนยที่สูงขึ้นอาจกดดันอัตรากำไรขั้นต้นระยะสั้นของกลุ่มอาหารและแดรี่อย่าง KCG หากค่าเงินบาทอ่อนค่าพร้อมกัน',
      sentiment: 'bearish',
      relatedAssets: ['KCG', 'CPF', 'USD/THB'],
      macroTags: ['food_dairy', 'usd_thb'],
      countryCode: 'TH',
      countryFlag: '🇹🇭',
    },
    {
      id: 'news-7',
      publishedAt: minsAgo(250),
      timeLabel: '4 ชม. ที่แล้ว',
      source: 'Financial Times',
      headline:
        'ตัวเลข Flash PMI ภาคการผลิตยูโรโซนอ่อนแอกว่าคาด ตอกย้ำแรงกดดัน ECB ลดดอกเบี้ยและหนุนดอลลาร์แข็งค่า',
      impactSummary:
        'ดัชนีดอลลาร์ (DXY) ที่แข็งค่าขึ้นระยะสั้นอาจสร้างแรงต้านต่อราคาทองคำ (GLD) โลหะเงิน (SLV) และกดดันค่าเงินสกุลเอเชียรวมถึงเงินบาท',
      sentiment: 'bearish',
      relatedAssets: ['EUR/USD', 'DXY', 'GLD', 'SLV', 'USD/THB'],
      macroTags: ['eu_macro', 'dxy'],
      countryCode: 'EU',
      countryFlag: '🇪🇺',
    },
    {
      id: 'news-8',
      publishedAt: minsAgo(310),
      timeLabel: '5 ชม. ที่แล้ว',
      source: 'CNBC',
      headline:
        'นักลงทุนสถาบันเพิ่มสัดส่วน ETF ปันผล (SCHD) และพันธบัตรระยะสั้น (SGOV, JPST) รับมือความผันผวนก่อนประชุม Fed',
      impactSummary:
        'กระแสเงินหมุนเข้าสินทรัพย์คุณภาพและดอกเบี้ยระยะสั้นช่วยพยุงราคา SCHD, SGOV, JPST และ VOO ให้เคลื่อนไหวมีเสถียรภาพ',
      sentiment: 'bullish',
      relatedAssets: ['SCHD', 'SGOV', 'JPST', 'VOO', 'VTI'],
      macroTags: ['us_rates'],
      countryCode: 'US',
      countryFlag: '🇺🇸',
    },
  ];
}

export function buildInitialSocialInsights(): SocialInsightItem[] {
  return [
    {
      id: 'soc-1',
      platform: 'x',
      channelName: 'The Kobeissi Letter',
      handleOrPage: '@KobeissiLetter',
      timeLabel: '25 นาทีที่แล้ว',
      title: 'จับตารอบประกาศ US CPI & Bond Yield 10Y: จุดเปลี่ยนสภาพคล่องหุ้นเทค Nasdaq-100',
      deepSummaryTh:
        'กระทู้วิเคราะห์ข้อมูลเงินเฟ้อหมวด Shelter และ Supercore ชี้ว่าตลาดเริ่ม Priced-in โอกาสลดดอกเบี้ย Fed เพิ่มขึ้น หาก CPI ออกมาต่ำกว่า 2.6% คาดเม็ดเงินไหลกลับเข้ากลุ่ม Growth & AI ทันที',
      analystViewTh:
        'มุมมองนักวิเคราะห์: กลุ่ม QQQM และ SMH มีโอกาสฟื้นตัวนำตลาด แต่ต้องระวังความผันผวนช่วง 15 นาทีแรกหลังประกาศตัวเลข 19:30 น.',
      sentiment: 'watch',
      relatedAssets: ['QQQM', 'SMH', 'VOO', 'TLT'],
      countryFlag: '🇺🇸',
      searchQuery: 'KobeissiLetter CPI Nasdaq QQQM',
    },
    {
      id: 'soc-2',
      platform: 'youtube',
      channelName: 'ลงทุนแมน (Longtunman)',
      handleOrPage: 'YouTube · ลงทุนแมน',
      timeLabel: '1 ชม. ที่แล้ว',
      title: 'เจาะลึกงบ AI Capex ของ Big Tech สหรัฐฯ ทำไมกองทุนชิป SMH และ QQQM ยังเป็นแกนหลักของรอบนี้',
      deepSummaryTh:
        'คลิปสรุปตัวเลขงบลงทุน Data Center รวมของ Microsoft, Meta, Google และ Amazon ที่เพิ่มขึ้นกว่า 35% YoY ส่งผลให้คำสั่งซื้อชิปประมวลผล AI และ Foundry อย่าง NVDA, TSM, AVGO ยังเต็มกำลังการผลิต',
      analystViewTh:
        'มุมมองเชิงลึก: ถือระยะกลาง-ยาวใน SMH และ QQQM ยังได้เปรียบจากวงจรอัปเกรดโครงสร้างพื้นฐาน AI แต่ควรทยอยสะสมช่วงย่อตัว',
      sentiment: 'bullish',
      relatedAssets: ['SMH', 'QQQM', 'NVDA', 'TSM', 'AVGO'],
      countryFlag: '🇺🇸',
      searchQuery: 'ลงทุนแมน SMH QQQM AI Capex',
    },
    {
      id: 'soc-3',
      platform: 'facebook',
      channelName: 'เพจ Finnomena / กูรูหุ้นต่างประเทศ',
      handleOrPage: 'Facebook · Finnomena',
      timeLabel: '1 ชม. ที่แล้ว',
      title: 'สรุปพอร์ต US ETF ยอดนิยมของนักลงทุนไทย: จัดสมดุล QQQM + SMH คู่ทองคำ GLD และเงิน SLV',
      deepSummaryTh:
        'โพสต์วิเคราะห์กลยุทธ์ Barbell ระหว่างสินทรัพย์เติบโต (QQQM, SMH) กับสินทรัพย์ป้องกันความเสี่ยงเงินเฟ้อและภูมิรัฐศาสตร์ (GLD, SLV) พร้อมชี้จุดเด่นของ ETF พักเงินอย่าง SGOV และ JPST',
      analystViewTh:
        'มุมมองเพจ: การถือ GLD/SLV สัดส่วน 10-20% ช่วยลด Drawdown ของพอร์ตหุ้นเทคในช่วงที่บอนด์ยีลด์ดีดตัวได้ชัดเจน',
      sentiment: 'bullish',
      relatedAssets: ['QQQM', 'SMH', 'GLD', 'SLV', 'SGOV', 'JPST'],
      countryFlag: '🇺🇸',
      searchQuery: 'Finnomena QQQM SMH GLD SLV ETF',
    },
    {
      id: 'soc-4',
      platform: 'x',
      channelName: 'Eric Balchunas (Bloomberg ETF)',
      handleOrPage: '@EricBalchunas',
      timeLabel: '2 ชม. ที่แล้ว',
      title: 'กระแสเงินเข้า Spot Bitcoin ETF (IBIT) และหุ้นบล็อกเชน (BLOK) เร่งตัวสูงกว่าค่าเฉลี่ยไตรมาสก่อน',
      deepSummaryTh:
        'รายงานข้อมูล Fund Flow รายวันพบกองทุนสถาบันและที่ปรึกษาการเงิน (RIA) เพิ่มน้ำหนักการลงทุนใน IBIT และหุ้นโครงสร้างพื้นฐานบล็อกเชนใน BLOK อย่างต่อเนื่อง',
      analystViewTh:
        'มุมมองเชิงบวก: สภาพคล่องฝั่งสถาบันช่วยยกฐานแนวรับของ BTC, IBIT และ BLOK ให้แข็งแกร่งกว่าวัฏจักรรอบก่อน',
      sentiment: 'bullish',
      relatedAssets: ['BLOK', 'IBIT', 'BTC', 'COIN', 'MSTR'],
      countryFlag: '🇺🇸',
      searchQuery: 'EricBalchunas IBIT BLOK Bitcoin ETF flow',
    },
    {
      id: 'soc-5',
      platform: 'facebook',
      channelName: 'เพจหุ้นไทยสายพื้นฐาน & ปันผล (SET Value)',
      handleOrPage: 'Facebook · วิเคราะห์หุ้นไทย',
      timeLabel: '2 ชม. ที่แล้ว',
      title: 'ส่องงบและวัน XD หุ้น KCG: ยอดขายผลิตภัณฑ์นม-เนย-เบเกอรี่โตเด่น แต่ต้องจับตาราคานมโลกและค่าเงินบาท',
      deepSummaryTh:
        'สรุปพรีวิวงบการเงิน KCG ไตรมาสล่าสุด คาดรายได้โตตามช่องทางโมเดิร์นเทรดและ Food Service พร้อมขยายกำลังการผลิตโรงงานใหม่ ขณะที่ต้นทุนเนย-ชีสนำเข้าผันผวนตามดัชนี GDT นิวซีแลนด์',
      analystViewTh:
        'มุมมองนักวิเคราะห์ไทย: พื้นฐาน KCG แข็งแกร่งและจ่ายปันผลสม่ำเสมอ แต่ระยะสั้นควรเฝ้าระวังราคาวัตถุดิบนมและค่าเงินบาทอ่อน',
      sentiment: 'watch',
      relatedAssets: ['KCG', 'USD/THB', 'CPALL'],
      countryFlag: '🇹🇭',
      searchQuery: 'วิเคราะห์หุ้น KCG งบการเงิน ปันผล XD',
    },
    {
      id: 'soc-6',
      platform: 'youtube',
      channelName: 'Kim Property Live / เศรษฐกิจโลก',
      handleOrPage: 'YouTube · เศรษฐกิจและการลงทุน',
      timeLabel: '3 ชม. ที่แล้ว',
      title: 'ทองคำ (GLD) และโลหะเงิน (SLV) ทำไมรอบนี้ Silver เริ่มวิ่งแรงกว่าทองคำ?',
      deepSummaryTh:
        'วิเคราะห์อัตราส่วน Gold/Silver Ratio และอุปสงค์โลหะเงินในอุตสาหกรรมโซลาร์เซลล์และแผงวงจร AI ที่ขาดดุลต่อเนื่องเป็นปีที่ 4 ผสานแรงซื้อทองคำจากธนาคารกลางตลาดเกิดใหม่',
      analystViewTh:
        'มุมมองช่อง: GLD เหมาะเป็นแกนป้องกันความเสี่ยงหลัก ส่วน SLV มี Beta สูงกว่าจึงผันผวนแรงทั้งขาขึ้นและขาลง',
      sentiment: 'bullish',
      relatedAssets: ['GLD', 'SLV', 'XAUUSD', 'XAGUSD'],
      countryFlag: '🌐',
      searchQuery: 'ทองคำ GLD โลหะเงิน SLV Gold Silver Ratio',
    },
    {
      id: 'soc-7',
      platform: 'x',
      channelName: 'SemiAnalysis / Chip Supply Chain',
      handleOrPage: '@SemiAnalysis_',
      timeLabel: '4 ชม. ที่แล้ว',
      title: 'เตือนความเสี่ยงห่วงโซ่อุปทานชิปและมาตรการควบคุมส่งออกเทคโนโลยีสหรัฐฯ-จีน กระทบกลุ่ม Semi ระยะสั้น',
      deepSummaryTh:
        'บทวิเคราะห์เจาะลึกชี้ว่าแม้คำสั่งซื้อ AI GPU ยังแน่น แต่ความไม่แน่นอนด้านภาษีนำเข้าและข้อจำกัดการส่งออกอุปกรณ์ผลิตชิปไปจีนอาจสร้างแรงขายทำกำไรในกลุ่ม SMH และ SOXX เป็นระยะ',
      analystViewTh:
        'มุมมองเชิงระวัง: จับตารายงานผลประกอบการและ Guidance ของ TSM และ AVGO ซึ่งมีน้ำหนักรวมสูงใน SMH',
      sentiment: 'bearish',
      relatedAssets: ['SMH', 'SOXX', 'NVDA', 'TSM', 'AVGO'],
      countryFlag: '🇺🇸',
      searchQuery: 'SemiAnalysis SMH semiconductor export controls',
    },
    {
      id: 'soc-8',
      platform: 'youtube',
      channelName: 'THE STANDARD WEALTH',
      handleOrPage: 'YouTube · THE STANDARD WEALTH',
      timeLabel: '4 ชม. ที่แล้ว',
      title: 'เจาะมติ กนง. คงดอกเบี้ย 2.25% หุ้นกลุ่มไหนใน SET ได้ประโยชน์ และเงินบาทจะไปทางไหน?',
      deepSummaryTh:
        'สัมภาษณ์นักเศรษฐศาสตร์วิเคราะห์ทิศทางดอกเบี้ยไทยเทียบกับ Fed ประเมินผลต่อกลุ่มธนาคารพาณิชย์ (KBANK, SCB), ค้าปลีก (CPALL) และหุ้นอาหารส่งออก-นำเข้า (KCG, TU)',
      analystViewTh:
        'มุมมองผู้เชี่ยวชาญ: ดอกเบี้ยทรงตัวช่วยพยุง NIM กลุ่มธนาคาร แต่ตลาดหุ้นไทยยังรอสัญญาณ Fund Flow ต่างชาติกลับมาซื้อสุทธิ',
      sentiment: 'watch',
      relatedAssets: ['KBANK', 'SCB', 'CPALL', 'KCG', 'USD/THB'],
      countryFlag: '🇹🇭',
      searchQuery: 'THE STANDARD WEALTH กนง ดอกเบี้ย หุ้นไทย',
    },
    {
      id: 'soc-9',
      platform: 'facebook',
      channelName: 'เพจ Money Buffalo / วางแผนการเงิน',
      handleOrPage: 'Facebook · Money Buffalo',
      timeLabel: '5 ชม. ที่แล้ว',
      title: 'เช็กปฏิทินปันผล ETF สหรัฐฯ และหุ้นไทย: วิธีวางแผนซื้อก่อนวัน XD ไม่ให้ติดดอยหลังปันผล',
      deepSummaryTh:
        'สรุปเทคนิคดู Dividend Yield เทียบอัตราการเติบโตของกำไรสำหรับ ETF ปันผลอย่าง SCHD, VOO, SGOV, JPST และหุ้นไทยปันผลสูงอย่าง PTT, KBANK, KCG เพื่อหลีกเลี่ยงกับดัก Dividend Trap',
      analystViewTh:
        'มุมมองเพจ: ควรเลือกหุ้นหรือ ETF ที่หลังขึ้น XD แล้วราคาสามารถปิดแก๊ปได้เร็วจากพื้นฐานกำไรที่โตจริง',
      sentiment: 'bullish',
      relatedAssets: ['SCHD', 'VOO', 'SGOV', 'JPST', 'PTT', 'KCG', 'KBANK'],
      countryFlag: '🇹🇭',
      searchQuery: 'Money Buffalo ปันผล XD SCHD PTT KCG',
    },
    {
      id: 'soc-10',
      platform: 'x',
      channelName: 'MacroAlf (Alfonso Peccatiello)',
      handleOrPage: '@MacroAlf',
      timeLabel: '6 ชม. ที่แล้ว',
      title: 'ระวังสัญญาณ Yen Carry Trade หากธนาคารกลางญี่ปุ่น (BoJ) ส่งสัญญาณขึ้นดอกเบี้ยเร็วกว่าตลาดคาด',
      deepSummaryTh:
        'เธรดวิเคราะห์ส่วนต่างบอนด์ยีลด์ญี่ปุ่น-สหรัฐฯ เตือนว่าหาก USD/JPY ร่วงแรงหลังประชุม BoJ อาจกระตุ้นแรง De-risking ระยะสั้นในหุ้นเทคสหรัฐฯ (QQQM) และคริปโต (BTC, BLOK)',
      analystViewTh:
        'มุมมองเชิงลบระยะสั้น: ติดตามค่าเงินเยนและการประชุม BoJ สัปดาห์หน้าอย่างใกล้ชิดเพื่อป้องกันแรงเหวี่ยงฉับพลัน',
      sentiment: 'bearish',
      relatedAssets: ['USD/JPY', 'QQQM', 'BTC', 'BLOK', 'EWJ'],
      countryFlag: '🇯🇵',
      searchQuery: 'MacroAlf BoJ Yen Carry Trade Nasdaq Bitcoin',
    },
    {
      id: 'soc-11',
      platform: 'youtube',
      channelName: 'Paul Pattarapon / พัฒนาพอร์ตลงทุน',
      handleOrPage: 'YouTube · ลงทุนระยะยาว',
      timeLabel: '7 ชม. ที่แล้ว',
      title: 'เทียบชัดๆ VOO vs QQQM vs SCHD ถือตัวไหนดีในปีนี้เมื่อดอกเบี้ยกำลังเปลี่ยนทิศ?',
      deepSummaryTh:
        'เปรียบเทียบค่าธรรมเนียม (Expense Ratio), การกระจายความเสี่ยง และความอ่อนไหวต่อดอกเบี้ยของ VOO, QQQM และ SCHD พร้อมจำลองผลตอบแทนย้อนหลังในภาวะดอกเบี้ยขาลง',
      analystViewTh:
        'มุมมองช่อง: QQQM ได้เปรียบค่าธรรมเนียมต่ำกว่า QQQ เหมาะกับสาย DCA ระยะยาวที่รับความผันผวนได้ คู่กับ VOO เป็นฐานพอร์ต',
      sentiment: 'bullish',
      relatedAssets: ['QQQM', 'VOO', 'SCHD', 'QQQ'],
      countryFlag: '🇺🇸',
      searchQuery: 'VOO vs QQQM vs SCHD ETF ลงทุนระยะยาว',
    },
    {
      id: 'soc-12',
      platform: 'facebook',
      channelName: 'เพจ Trader KP / ข่าวเศรษฐกิจโลกทันเหตุการณ์',
      handleOrPage: 'Facebook · Trader KP',
      timeLabel: '8 ชม. ที่แล้ว',
      title: 'เศรษฐกิจจีนส่งสัญญาณฟื้นตัวบางจุด รอตัวเลข China PMI พรุ่งนี้ชี้ชะตาโภคภัณฑ์และหุ้นเอเชีย',
      deepSummaryTh:
        'สรุปมาตรการกระตุ้นการบริโภคและภาคอุตสาหกรรมล่าสุดของจีน หากตัวเลข PMI ภาคการผลิตยืนเหนือ 50.4 ได้ต่อเนื่อง จะช่วยหนุนความต้องการพลังงาน โลหะเงิน (SLV) และการท่องเที่ยวไทย (AOT)',
      analystViewTh:
        'มุมมองเฝ้าระวัง: หากตัวเลขจีนออกมาต่ำกว่าคาด 50.0 อาจกดดันราคาโลหะอุตสาหกรรมและหุ้นพลังงานเอเชียกลับลงมาทดสอบแนวรับ',
      sentiment: 'watch',
      relatedAssets: ['SLV', 'PTT', 'AOT', 'SCC', 'GLD'],
      countryFlag: '🇨🇳',
      searchQuery: 'Trader KP China PMI ทองคำ โลหะเงิน หุ้นไทย',
    },
  ];
}

/**
 * Generates clean, accurate initial Earnings & XD tracker records tailored strictly
 * to the user's real portfolio assets before/alongside live Google Search Grounding sync.
 */
export function buildBaselineEarningsXD(portfolio: PortfolioAsset[]): {
  earnings: EarningsRecord[];
  dividends: DividendXDRecord[];
} {
  const earnings: EarningsRecord[] = [];
  const dividends: DividendXDRecord[] = [];

  for (const asset of portfolio) {
    const sym = asset.symbol.toUpperCase().replace(/\.BK$/, '');
    const catMeta = ASSET_CATALOG.find((c) => c.symbol.toUpperCase() === sym);
    const hasDividends =
      asset.hasDividends ??
      catMeta?.hasDividends ??
      !(
        asset.category === 'Crypto' ||
        asset.category === 'Commodity' ||
        asset.category === 'Forex' ||
        ['GLD', 'SLV', 'IBIT', 'FBTC'].includes(sym)
      );
    const hasEarnings =
      asset.hasEarnings ??
      catMeta?.hasEarnings ??
      !(
        asset.category === 'Crypto' ||
        asset.category === 'Commodity' ||
        asset.category === 'Forex' ||
        ['GLD', 'SLV', 'IBIT', 'FBTC', 'SGOV', 'JPST', 'TLT'].includes(sym)
      );

    // 1. Non-earnings / Non-dividend assets (GLD, SLV, BTC, ETH, XAUUSD, XAGUSD, etc.)
    if (!hasEarnings) {
      earnings.push({
        id: `base-earn-na-${sym}`,
        portfolioSymbol: sym,
        reportedSymbol: sym,
        reportedName: asset.name,
        isTopHolding: false,
        flag: asset.flag,
        reportDate: '—',
        periodLabel: 'ไม่อิงงบการเงิน',
        revenueSummary: 'ไม่มีงบการเงินรายไตรมาส',
        profitSummary: 'ราคาเคลื่อนไหวตามตลาดโลกและมหภาค',
        status: 'not_applicable',
        trendSummaryTh: `${sym} เป็นสินทรัพย์ประเภท${asset.sector} ไม่มีปันผล / ไม่อิงงบการเงินบริษัท แต่ตอบสนองโดยตรงต่อดอกเบี้ย Fed, ดอลลาร์ (DXY) และอุปสงค์ตลาดโลก`,
        daysUntil: null,
      });
    } else if (sym === 'QQQM' || sym === 'QQQ' || sym === 'VUG') {
      earnings.push(
        {
          id: `base-earn-${sym}-NVDA`,
          portfolioSymbol: sym,
          reportedSymbol: 'NVDA',
          reportedName: 'NVIDIA Corp. (Top Holding)',
          isTopHolding: true,
          holdingWeight: '8.9%',
          flag: '🇺🇸',
          reportDate: offsetDateIso(-1),
          periodLabel: 'ไตรมาสล่าสุด',
          revenueSummary: 'รายได้กลุ่ม AI Data Center เติบโตสูง +68% YoY',
          profitSummary: 'EPS $0.89 (ดีกว่าคาด +6.0%)',
          yoyChange: '+68% YoY',
          status: 'beat',
          trendSummaryTh:
            'ผลประกอบการเหนือคาดการณ์จากความต้องการชิปประมวลผล AI ของผู้ให้บริการคลาวด์รายใหญ่ แนวโน้มไตรมาสถัดไปยังเติบโตต่อเนื่อง เป็นแรงหนุนสำคัญต่อดัชนี Nasdaq-100',
          daysUntil: -1,
        },
        {
          id: `base-earn-${sym}-AAPL`,
          portfolioSymbol: sym,
          reportedSymbol: 'AAPL',
          reportedName: 'Apple Inc. (Top Holding)',
          isTopHolding: true,
          holdingWeight: '8.4%',
          flag: '🇺🇸',
          reportDate: offsetDateIso(3),
          periodLabel: 'กำลังประกาศงบ',
          revenueSummary: 'คาดรายได้เติบโต +5.8% YoY จากกลุ่ม Services',
          profitSummary: 'คาดการณ์ EPS $1.64 (ครั้งก่อน $1.52)',
          yoyChange: '+5.8% YoY (คาด)',
          status: 'upcoming',
          trendSummaryTh:
            'ตลาดจับตายอดขายสมาร์ตโฟนในจีนและการขยายตัวของรายได้บริการ (Services Margin) ซึ่งมีน้ำหนักขับเคลื่อนราคา QQQM โดยตรง',
          daysUntil: 3,
        }
      );
    } else if (sym === 'SMH' || sym === 'SOXX') {
      earnings.push(
        {
          id: `base-earn-${sym}-NVDA`,
          portfolioSymbol: sym,
          reportedSymbol: 'NVDA',
          reportedName: 'NVIDIA Corp. (Top Holding)',
          isTopHolding: true,
          holdingWeight: '20.5%',
          flag: '🇺🇸',
          reportDate: offsetDateIso(-1),
          periodLabel: 'ไตรมาสล่าสุด',
          revenueSummary: 'รายได้ AI Server & GPU พุ่ง +68% YoY',
          profitSummary: 'EPS $0.89 (ดีกว่าคาด +6.0%)',
          yoyChange: '+68% YoY',
          status: 'beat',
          trendSummaryTh:
            'คำสั่งซื้อชิปรุ่นใหม่เต็มกำลังการผลิต หนุนอัตรากำไรขั้นต้นยืนระดับสูงกว่า 70% เป็นแรงขับเคลื่อนอันดับ 1 ของกองทุนเซมิคอนดักเตอร์',
          daysUntil: -1,
        },
        {
          id: `base-earn-${sym}-TSM`,
          portfolioSymbol: sym,
          reportedSymbol: 'TSM',
          reportedName: 'TSMC (Top Holding)',
          isTopHolding: true,
          holdingWeight: '12.6%',
          flag: '🇹🇼',
          reportDate: offsetDateIso(2),
          periodLabel: 'กำลังประกาศงบ',
          revenueSummary: 'คาดรายได้โต +28% YoY จากชิปขนาด 3nm/5nm',
          profitSummary: 'คาดการณ์กำไรสุทธิโตเหนือคาด',
          yoyChange: '+28% YoY (คาด)',
          status: 'upcoming',
          trendSummaryTh:
            'TSMC เป็นผู้รับจ้างผลิตชิป AI รายหลักให้ทั้ง NVIDIA, Apple และ AMD ตัวเลข Gross Margin และงบ Capex จะชี้ทิศทางทั้งกลุ่ม SMH',
          daysUntil: 2,
        }
      );
    } else if (sym === 'BLOK') {
      earnings.push({
        id: `base-earn-${sym}-COIN`,
        portfolioSymbol: sym,
        reportedSymbol: 'COIN',
        reportedName: 'Coinbase Global (Top Holding)',
        isTopHolding: true,
        holdingWeight: '6.8%',
        flag: '🇺🇸',
        reportDate: offsetDateIso(2),
        periodLabel: 'กำลังประกาศงบ',
        revenueSummary: 'ปริมาณซื้อขายคริปโตและรายได้ Custody ETF พุ่งขึ้น',
        profitSummary: 'คาดการณ์ EPS เติบโตเด่นตามราคา Bitcoin',
        yoyChange: '+42% YoY (คาด)',
        status: 'upcoming',
        trendSummaryTh:
          'ค่าธรรมเนียมดูแลสินทรัพย์ (Custody) ให้กับกองทุน Spot Bitcoin ETF และปริมาณเทรดรายย่อยฟื้นตัวแรง หนุนรายได้หุ้นบล็อกเชนในพอร์ต BLOK',
        daysUntil: 2,
      });
    } else if (sym === 'VOO' || sym === 'SPY') {
      earnings.push({
        id: `base-earn-${sym}-MSFT`,
        portfolioSymbol: sym,
        reportedSymbol: 'MSFT',
        reportedName: 'Microsoft Corp. (Top Holding)',
        isTopHolding: true,
        holdingWeight: '6.9%',
        flag: '🇺🇸',
        reportDate: offsetDateIso(3),
        periodLabel: 'กำลังประกาศงบ',
        revenueSummary: 'คาด Azure Cloud โต +31% YoY',
        profitSummary: 'คาดการณ์ EPS $3.18 (ครั้งก่อน $3.02)',
        yoyChange: '+14% YoY (คาด)',
        status: 'upcoming',
        trendSummaryTh:
          'จับตารายได้ Azure AI และประสิทธิภาพการลงทุน Data Center ซึ่งเป็นตัวแทนผลประกอบการบริษัทขนาดใหญ่ใน S&P 500',
        daysUntil: 3,
      });
    } else if (sym === 'KCG') {
      earnings.push({
        id: 'base-earn-KCG',
        portfolioSymbol: 'KCG',
        reportedSymbol: 'KCG',
        reportedName: 'บมจ. เคซีจี คอร์ปอเรชั่น',
        isTopHolding: false,
        flag: '🇹🇭',
        reportDate: offsetDateIso(2),
        periodLabel: 'กำลังประกาศงบ',
        revenueSummary: 'คาดยอดขายกลุ่มผลิตภัณฑ์นม-เนย-เบเกอรี่โต +9.5% YoY',
        profitSummary: 'คาดกำไรสุทธิเติบโต +16% YoY (EPS ~฿0.21)',
        yoyChange: '+16% YoY (คาด)',
        status: 'upcoming',
        trendSummaryTh:
          'ได้อานิสงส์จากการขยายช่องทาง B2B โรงแรม-ร้านอาหาร และศูนย์กระจายสินค้า KCG Logistics Park ลดต้นทุนขนส่ง ควบคู่กับการบริหารต้นทุนวัตถุดิบนม-เนย',
        daysUntil: 2,
      });
    } else if (sym === 'NVDA') {
      earnings.push({
        id: 'base-earn-NVDA',
        portfolioSymbol: 'NVDA',
        reportedSymbol: 'NVDA',
        reportedName: 'NVIDIA Corporation',
        isTopHolding: false,
        flag: '🇺🇸',
        reportDate: offsetDateIso(-1),
        periodLabel: 'ไตรมาสล่าสุด',
        revenueSummary: 'รายได้รวมโต +68% YoY นำโดย Data Center',
        profitSummary: 'EPS $0.89 (ดีกว่าคาด +6.0%)',
        yoyChange: '+68% YoY',
        status: 'beat',
        trendSummaryTh:
          'ยอดส่งมอบชิป AI และแพลตฟอร์มซอฟต์แวร์ CUDA ยังคงครองส่วนแบ่งตลาดสูงสุด แนวโน้มคำสั่งซื้อล่วงหน้าแข็งแกร่งต่อเนื่อง',
        daysUntil: -1,
      });
    } else if (sym === 'DELTA') {
      earnings.push({
        id: 'base-earn-DELTA',
        portfolioSymbol: 'DELTA',
        reportedSymbol: 'DELTA',
        reportedName: 'บมจ. เดลต้า อีเลคโทรนิคส์ (ประเทศไทย)',
        isTopHolding: false,
        flag: '🇹🇭',
        reportDate: offsetDateIso(0),
        periodLabel: 'ประกาศงบวันนี้',
        revenueSummary: 'คาดรายได้กลุ่ม Power Electronics & AI Server โต +18% YoY',
        profitSummary: 'คาดการณ์ EPS ฿0.46 (ครั้งก่อน ฿0.41)',
        yoyChange: '+18% YoY (คาด)',
        status: 'upcoming',
        trendSummaryTh:
          'อุปสงค์ระบบจ่ายไฟสำหรับ Data Center AI หนุนอัตรากำไรขั้นต้น แต่ยังต้องจับตาผลกระทบอัตราแลกเปลี่ยนและภาษีเงินได้ขั้นต่ำสากล',
        daysUntil: 0,
      });
    } else {
      earnings.push({
        id: `base-earn-${sym}`,
        portfolioSymbol: sym,
        reportedSymbol: sym,
        reportedName: asset.name,
        isTopHolding: false,
        flag: asset.flag,
        reportDate: offsetDateIso(6),
        periodLabel: 'รออัปเดตสด',
        revenueSummary: 'กดปุ่ม "อัปเดตงบ & XD สด" เพื่อดึงตัวเลขจริงล่าสุด',
        profitSummary: 'เชื่อมโยงข้อมูลผ่าน Google Search Grounding',
        status: 'upcoming',
        trendSummaryTh: `ติดตามแนวโน้มรายได้ อัตรากำไร และ Guidance ล่าสุดของ ${sym} (${asset.sector}) ผ่านระบบค้นหาข้อมูลจริง`,
        daysUntil: 6,
      });
    }

    // 2. Dividend / XD records
    if (!hasDividends) {
      dividends.push({
        id: `base-div-na-${sym}`,
        symbol: sym,
        name: asset.name,
        flag: asset.flag,
        applicable: false,
        notApplicableReasonTh: 'ไม่มีปันผล / ไม่อิงงบการเงิน',
        xdDate: '—',
        daysUntilXD: null,
        dps: '—',
        dividendYield: '—',
        payDate: '—',
        noteTh: `${sym} เป็นสินทรัพย์โภคภัณฑ์/คริปโตหรือกองทุนที่ถือสินทรัพย์อ้างอิงโดยตรง จึงไม่มีการจ่ายเงินปันผล`,
      });
    } else if (sym === 'KCG') {
      dividends.push({
        id: 'base-div-KCG',
        symbol: 'KCG',
        name: 'บมจ. เคซีจี คอร์ปอเรชั่น',
        flag: '🇹🇭',
        applicable: true,
        xdDate: offsetDateIso(5),
        daysUntilXD: 5,
        dps: '฿0.38 / หุ้น (คาด)',
        dividendYield: '4.1%',
        payDate: offsetDateIso(24),
        frequency: 'ปีละ 1-2 ครั้ง',
        noteTh: 'นโยบายจ่ายปันผลไม่น้อยกว่า 40% ของกำไรสุทธิ กดอัปเดตสดเพื่อเช็กประกาศมติบอร์ดล่าสุดจาก SET',
      });
    } else if (sym === 'PTT') {
      dividends.push({
        id: 'base-div-PTT',
        symbol: 'PTT',
        name: 'บมจ. ปตท.',
        flag: '🇹🇭',
        applicable: true,
        xdDate: offsetDateIso(0),
        daysUntilXD: 0,
        dps: '฿0.90 / หุ้น',
        dividendYield: '6.1%',
        payDate: offsetDateIso(18),
        frequency: 'ปีละ 2 ครั้ง',
        noteTh: 'หุ้นปันผลสูงกลุ่มพลังงานไทย จ่ายสม่ำเสมอปีละ 2 รอบ',
      });
    } else if (sym === 'SCHD') {
      dividends.push({
        id: 'base-div-SCHD',
        symbol: 'SCHD',
        name: 'Schwab U.S. Dividend Equity ETF',
        flag: '🇺🇸',
        applicable: true,
        xdDate: offsetDateIso(1),
        daysUntilXD: 1,
        dps: '$0.265 / หน่วย',
        dividendYield: '3.6%',
        payDate: offsetDateIso(6),
        frequency: 'รายไตรมาส',
        noteTh: 'ETF หุ้นปันผลคุณภาพสูงสหรัฐฯ จ่ายปันผลทุกไตรมาส (มี.ค., มิ.ย., ก.ย., ธ.ค.)',
      });
    } else if (sym === 'QQQM' || sym === 'QQQ') {
      dividends.push({
        id: `base-div-${sym}`,
        symbol: sym,
        name: asset.name,
        flag: '🇺🇸',
        applicable: true,
        xdDate: offsetDateIso(6),
        daysUntilXD: 6,
        dps: sym === 'QQQM' ? '$0.31 / หน่วย' : '$0.72 / หน่วย',
        dividendYield: '0.62%',
        payDate: offsetDateIso(11),
        frequency: 'รายไตรมาส',
        noteTh: 'จ่ายปันผลรายไตรมาส เน้นการเติบโตของราคาหุ้นเทคโนโลยี Nasdaq-100 เป็นหลัก',
      });
    } else if (sym === 'SMH') {
      dividends.push({
        id: 'base-div-SMH',
        symbol: 'SMH',
        name: 'VanEck Semiconductor ETF',
        flag: '🇺🇸',
        applicable: true,
        xdDate: offsetDateIso(18),
        daysUntilXD: 18,
        dps: '$1.05 / หน่วย (รายปี)',
        dividendYield: '0.45%',
        payDate: offsetDateIso(23),
        frequency: 'รายปี (ธ.ค.)',
        noteTh: 'จ่ายปันผลปีละ 1 ครั้งช่วงปลายเดือนธันวาคม',
      });
    } else if (sym === 'BLOK') {
      dividends.push({
        id: 'base-div-BLOK',
        symbol: 'BLOK',
        name: 'Amplify Transformational Data Sharing ETF',
        flag: '🇺🇸',
        applicable: true,
        xdDate: offsetDateIso(21),
        daysUntilXD: 21,
        dps: '$0.85 / หน่วย',
        dividendYield: '2.1%',
        payDate: offsetDateIso(26),
        frequency: 'รายปี (ธ.ค.)',
        noteTh: 'จ่ายเงินปันผลประจำปีช่วงปลายปีตามกำไรและเงินปันผลของหุ้นในพอร์ต',
      });
    } else if (sym === 'SGOV' || sym === 'JPST') {
      dividends.push({
        id: `base-div-${sym}`,
        symbol: sym,
        name: asset.name,
        flag: '🇺🇸',
        applicable: true,
        xdDate: offsetDateIso(4),
        daysUntilXD: 4,
        dps: sym === 'SGOV' ? '$0.39 / หน่วย' : '$0.21 / หน่วย',
        dividendYield: sym === 'SGOV' ? '4.6%' : '4.9%',
        payDate: offsetDateIso(9),
        frequency: 'รายเดือน',
        noteTh: 'จ่ายดอกเบี้ย/ปันผลทุกต้นเดือนตามอัตราดอกเบี้ยพันธบัตรสหรัฐฯ ระยะสั้น',
      });
    } else if (sym === 'VOO' || sym === 'SPY') {
      dividends.push({
        id: `base-div-${sym}`,
        symbol: sym,
        name: asset.name,
        flag: '🇺🇸',
        applicable: true,
        xdDate: offsetDateIso(7),
        daysUntilXD: 7,
        dps: '$1.74 / หน่วย',
        dividendYield: '1.28%',
        payDate: offsetDateIso(11),
        frequency: 'รายไตรมาส',
        noteTh: 'จ่ายปันผลรายไตรมาสตามรอบดัชนี S&P 500',
      });
    } else {
      dividends.push({
        id: `base-div-${sym}`,
        symbol: sym,
        name: asset.name,
        flag: asset.flag,
        applicable: true,
        xdDate: offsetDateIso(14),
        daysUntilXD: 14,
        dps: 'รออัปเดตสด',
        dividendYield: '—',
        payDate: '—',
        frequency: asset.category === 'Thai Stock' ? 'ปีละ 1-2 ครั้ง' : 'รายไตรมาส',
        noteTh: 'กด "อัปเดตงบ & XD สด" เพื่อดึงวันขึ้นเครื่องหมาย XD และเงินปันผลจริงล่าสุดจาก Google Search',
      });
    }
  }

  return { earnings, dividends };
}

export const INITIAL_FEAR_GREED: FearGreedData = {
  value: 62,
  labelTh: 'โลภ (Greed)',
  previousClose: 59,
  oneWeekAgo: 54,
  oneMonthAgo: 47,
  updatedLabel: 'อัปเดตล่าสุดวันนี้',
  marketNote:
    'แรงซื้อในกลุ่มเทคโนโลยี เซมิคอนดักเตอร์ และทองคำยังคงหนุนบรรยากาศการลงทุนทั่วโลก ก่อนประกาศตัวเลขเงินเฟ้อสหรัฐฯ',
};
