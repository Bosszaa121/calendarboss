import {
  AssetCategory,
  ChartCandle,
  ChartTimeframe,
  TechnicalStructureResult,
  WavePoint,
} from '../types';

const KNOWN_AMEX_ETFS = new Set([
  'SPY',
  'VOO',
  'VTI',
  'SCHD',
  'GLD',
  'SLV',
  'IAU',
  'BLOK',
  'SGOV',
  'JPST',
  'XLK',
  'XLF',
  'XLE',
  'XLV',
  'XLI',
  'XLP',
  'XLY',
  'XLU',
  'ARKK',
  'JEPI',
  'JEPQ',
  'VYM',
  'VIG',
  'VNQ',
  'EEM',
  'VEA',
  'VXUS',
  'BND',
  'AGG',
  'BIL',
  'SHY',
  'IEF',
  'EWJ',
  'FXI',
  'KWEB',
  'MCHI',
  'THD',
  'DIA',
  'IWM',
  'IVV',
  'SOXL',
  'SPXL',
  'URA',
  'COPX',
  'GDX',
  'GDXJ',
  'XBI',
  'BOTZ',
  'CIBR',
  'HACK',
  'ITA',
]);

const KNOWN_NASDAQ_TICKERS = new Set([
  'QQQ',
  'QQQM',
  'SMH',
  'SOXX',
  'TLT',
  'IBIT',
  'FBTC',
  'ETHA',
  'TQQQ',
  'SQQQ',
  'AAPL',
  'MSFT',
  'NVDA',
  'AMZN',
  'GOOGL',
  'GOOG',
  'META',
  'TSLA',
  'AVGO',
  'PEP',
  'COST',
  'AMD',
  'NFLX',
  'INTC',
  'QCOM',
  'TXN',
  'ADBE',
  'ASML',
  'ARM',
  'PLTR',
  'COIN',
  'MSTR',
  'CRWD',
  'PANW',
  'AMAT',
  'LRCX',
  'KLAC',
  'MU',
  'MRVL',
  'SBUX',
  'MDLZ',
  'PYPL',
  'ISRG',
  'AMGN',
  'GILD',
  'BKNG',
  'ABNB',
  'DASH',
  'MELI',
  'PDD',
  'JD',
  'BIDU',
  'NTES',
  'HON',
  'LIN',
  'CSCO',
  'CMCSA',
  'TMUS',
  'SNPS',
  'CDNS',
  'FTNT',
  'ZS',
  'DDOG',
  'MDB',
  'APP',
  'HOOD',
  'SOFI',
  'RIVN',
  'LCID',
  'MARA',
  'RIOT',
  'CLSK',
]);

const STATIC_TV_SYMBOLS: Record<string, string> = {
  XAUUSD: 'OANDA:XAUUSD',
  'XAU/USD': 'OANDA:XAUUSD',
  XAGUSD: 'OANDA:XAGUSD',
  'XAG/USD': 'OANDA:XAGUSD',
  WTI: 'TVC:USOIL',
  BRENT: 'TVC:UKOIL',
  NATGAS: 'OANDA:NATGASUSD',
  COPPER: 'CAPITALCOM:COPPER',
  'USD/THB': 'FX_IDC:USDTHB',
  'EUR/USD': 'FX:EURUSD',
  'USD/JPY': 'FX:USDJPY',
  'GBP/USD': 'FX:GBPUSD',
  'AUD/USD': 'FX:AUDUSD',
  DXY: 'TVC:DXY',
  'BRK.B': 'NYSE:BRK.B',
  'BRK.A': 'NYSE:BRK.A',
};

/**
 * Automatically maps InvestCal symbols to accurate TradingView Exchange:Ticker codes
 * (e.g., KCG -> SET:KCG, QQQM -> NASDAQ:QQQM, PEP -> NASDAQ:PEP, GLD -> AMEX:GLD, BTC -> BINANCE:BTCUSDT).
 */
export function toTradingViewSymbol(asset: {
  symbol: string;
  category: AssetCategory;
  market?: string;
}): string {
  const raw = asset.symbol.trim().toUpperCase();
  if (raw.includes(':')) return raw;
  if (STATIC_TV_SYMBOLS[raw]) return STATIC_TV_SYMBOLS[raw];

  const marketUpper = (asset.market || '').toUpperCase();

  if (asset.category === 'Thai Stock' || raw.endsWith('.BK') || marketUpper === 'SET' || marketUpper === 'MAI') {
    return `SET:${raw.replace(/\.BK$/, '')}`;
  }

  if (asset.category === 'Crypto') {
    const base = raw.replace(/-USD$/, '').replace(/USDT$/, '');
    return `BINANCE:${base}USDT`;
  }

  if (raw.endsWith('.T')) return `TSE:${raw.replace(/\.T$/, '')}`;
  if (raw.endsWith('.HK')) return `HKEX:${raw.replace(/\.HK$/, '').replace(/^0+/, '')}`;
  if (raw.endsWith('.L')) return `LSE:${raw.replace(/\.L$/, '')}`;
  if (raw.endsWith('.DE')) return `XETR:${raw.replace(/\.DE$/, '')}`;
  if (raw.endsWith('.PA')) return `EURONEXT:${raw.replace(/\.PA$/, '')}`;
  if (raw.endsWith('.AS')) return `EURONEXT:${raw.replace(/\.AS$/, '')}`;

  if (KNOWN_NASDAQ_TICKERS.has(raw) || marketUpper.includes('NASDAQ')) {
    return `NASDAQ:${raw}`;
  }
  if (KNOWN_AMEX_ETFS.has(raw) || marketUpper.includes('ARCA') || marketUpper.includes('AMEX')) {
    return `AMEX:${raw}`;
  }
  if (marketUpper.includes('NYSE')) {
    return `NYSE:${raw}`;
  }

  if (asset.category === 'US ETF') {
    return `AMEX:${raw}`;
  }

  return `NYSE:${raw}`;
}

export function formatCurrencyPrice(price: number, currency: string): string {
  const abs = Math.abs(price);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 2 : 4;
  const formatted = price.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const cur = currency.toUpperCase();
  if (cur === 'THB') return `฿${formatted}`;
  if (cur === 'USD') return `$${formatted}`;
  if (cur === 'EUR') return `€${formatted}`;
  if (cur === 'GBP') return `£${formatted}`;
  if (cur === 'JPY') return `¥${Math.round(price).toLocaleString('en-US')}`;
  if (cur === 'HKD') return `HK$${formatted}`;
  return `${formatted} ${cur}`;
}

function roundPrice(val: number): number {
  const abs = Math.abs(val);
  if (abs >= 100) return Number(val.toFixed(2));
  if (abs >= 1) return Number(val.toFixed(2));
  return Number(val.toFixed(4));
}

/**
 * ZigZag Swing Detection to extract alternating structural pivot highs and lows.
 */
function detectZigZagPivots(
  candles: ChartCandle[],
  reversalPct: number
): Array<{ candleIndex: number; timestamp: number; price: number; type: 'high' | 'low' }> {
  if (candles.length < 5) return [];

  const pivots: Array<{
    candleIndex: number;
    timestamp: number;
    price: number;
    type: 'high' | 'low';
  }> = [];

  let trend: 'up' | 'down' | null = null;
  let extremeIdx = 0;
  let extremeHigh = candles[0].high;
  let extremeLow = candles[0].low;

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];

    if (trend === null) {
      if (c.high > extremeHigh) {
        extremeHigh = c.high;
        if ((extremeHigh - extremeLow) / Math.max(extremeLow, 1e-6) >= reversalPct) {
          pivots.push({
            candleIndex: extremeIdx,
            timestamp: candles[extremeIdx].timestamp,
            price: extremeLow,
            type: 'low',
          });
          trend = 'up';
          extremeIdx = i;
        }
      }
      if (c.low < extremeLow) {
        extremeLow = c.low;
        if ((extremeHigh - extremeLow) / Math.max(extremeHigh, 1e-6) >= reversalPct) {
          pivots.push({
            candleIndex: extremeIdx,
            timestamp: candles[extremeIdx].timestamp,
            price: extremeHigh,
            type: 'high',
          });
          trend = 'down';
          extremeIdx = i;
        }
      }
    } else if (trend === 'up') {
      if (c.high >= extremeHigh) {
        extremeHigh = c.high;
        extremeIdx = i;
      } else if ((extremeHigh - c.low) / Math.max(extremeHigh, 1e-6) >= reversalPct) {
        pivots.push({
          candleIndex: extremeIdx,
          timestamp: candles[extremeIdx].timestamp,
          price: extremeHigh,
          type: 'high',
        });
        trend = 'down';
        extremeLow = c.low;
        extremeIdx = i;
      }
    } else {
      if (c.low <= extremeLow) {
        extremeLow = c.low;
        extremeIdx = i;
      } else if ((c.high - extremeLow) / Math.max(extremeLow, 1e-6) >= reversalPct) {
        pivots.push({
          candleIndex: extremeIdx,
          timestamp: candles[extremeIdx].timestamp,
          price: extremeLow,
          type: 'low',
        });
        trend = 'up';
        extremeHigh = c.high;
        extremeIdx = i;
      }
    }
  }

  // Append active leg endpoint
  if (trend === 'up') {
    pivots.push({
      candleIndex: extremeIdx,
      timestamp: candles[extremeIdx].timestamp,
      price: extremeHigh,
      type: 'high',
    });
  } else if (trend === 'down') {
    pivots.push({
      candleIndex: extremeIdx,
      timestamp: candles[extremeIdx].timestamp,
      price: extremeLow,
      type: 'low',
    });
  }

  return pivots;
}

/**
 * Mathematical Technical Engine (0% AI Quota):
 * Computes Support 1/2, Resistance 1/2 (Swing High/Low + Pivot Points),
 * Breakeven P/L, and preliminary Elliott Wave ZigZag structure (1-2-3-4-5 or A-B-C).
 */
export function computeTechnicalStructure(
  candles: ChartCandle[],
  timeframe: ChartTimeframe,
  averageCost?: number
): TechnicalStructureResult | null {
  if (candles.length < 6) return null;

  const latestPrice = candles[candles.length - 1].close;
  const lookback = candles.slice(-Math.min(candles.length, 40));

  let periodHigh = -Infinity;
  let periodLow = Infinity;
  for (const c of lookback) {
    if (c.high > periodHigh) periodHigh = c.high;
    if (c.low < periodLow) periodLow = c.low;
  }

  // Classic Pivot Points over recent window
  const pivot = (periodHigh + periodLow + latestPrice) / 3;
  const pivotR1 = 2 * pivot - periodLow;
  const pivotS1 = 2 * pivot - periodHigh;
  const pivotR2 = pivot + (periodHigh - periodLow);
  const pivotS2 = pivot - (periodHigh - periodLow);

  // Detect local swing highs and lows (radius 2 bars) for real S/R confluence
  const swingHighs: number[] = [];
  const swingLows: number[] = [];
  for (let i = 2; i < candles.length - 2; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    if (
      h >= candles[i - 1].high &&
      h >= candles[i - 2].high &&
      h >= candles[i + 1].high &&
      h >= candles[i + 2].high
    ) {
      swingHighs.push(h);
    }
    if (
      l <= candles[i - 1].low &&
      l <= candles[i - 2].low &&
      l <= candles[i + 1].low &&
      l <= candles[i + 2].low
    ) {
      swingLows.push(l);
    }
  }

  const aboveSwings = swingHighs
    .filter((p) => p > latestPrice * 1.003)
    .sort((a, b) => a - b);
  const belowSwings = swingLows
    .filter((p) => p < latestPrice * 0.997)
    .sort((a, b) => b - a);

  const resistance1 = roundPrice(
    aboveSwings[0] ?? Math.max(pivotR1, latestPrice * 1.02)
  );
  const resistance2 = roundPrice(
    aboveSwings.find((p) => p > resistance1 * 1.012) ??
      Math.max(pivotR2, periodHigh, resistance1 * 1.035)
  );
  const support1 = roundPrice(
    belowSwings[0] ?? Math.min(pivotS1, latestPrice * 0.98)
  );
  const support2 = roundPrice(
    belowSwings.find((p) => p < support1 * 0.988) ??
      Math.min(pivotS2, periodLow, support1 * 0.965)
  );

  // Adaptive ZigZag threshold so we capture 4-6 clear structural wave legs
  const basePct = timeframe === '1D' ? 0.035 : timeframe === '4H' ? 0.018 : 0.01;
  let pivots = detectZigZagPivots(candles, basePct);
  if (pivots.length < 4) {
    pivots = detectZigZagPivots(candles, basePct * 0.55);
  }
  if (pivots.length < 4) {
    pivots = detectZigZagPivots(candles, basePct * 0.3);
  }

  let wavePattern: TechnicalStructureResult['wavePattern'] = 'insufficient';
  let waveDirection: TechnicalStructureResult['waveDirection'] = 'sideway';
  let wavePoints: WavePoint[] = [];

  if (pivots.length >= 6) {
    const recent6 = pivots.slice(-6);
    const startP = recent6[0].price;
    const endP = recent6[5].price;
    const netPct = (endP - startP) / Math.max(startP, 1e-6);

    // Check if recent 6 pivots form a clean directional 5-wave impulsive progression
    const isBullishImpulse =
      recent6[0].type === 'low' &&
      recent6[2].price > recent6[0].price &&
      recent6[3].price > recent6[1].price &&
      netPct > 0.01;

    const isBearishImpulse =
      recent6[0].type === 'high' &&
      recent6[2].price < recent6[0].price &&
      recent6[3].price < recent6[1].price &&
      netPct < -0.01;

    if (isBullishImpulse || isBearishImpulse) {
      wavePattern = 'impulse';
      waveDirection = isBullishImpulse ? 'up' : 'down';
      const labels = ['0', '1', '2', '3', '4', '5'];
      wavePoints = recent6.map((p, idx) => ({
        ...p,
        price: roundPrice(p.price),
        label: labels[idx],
      }));
    } else {
      // Otherwise label the most recent 4 pivots as A-B-C correction
      const recent4 = pivots.slice(-4);
      wavePattern = 'correction';
      const corrNet = recent4[3].price - recent4[0].price;
      waveDirection =
        Math.abs(corrNet / Math.max(recent4[0].price, 1e-6)) < 0.01
          ? 'sideway'
          : corrNet > 0
          ? 'up'
          : 'down';
      const labels = ['0', 'A', 'B', 'C'];
      wavePoints = recent4.map((p, idx) => ({
        ...p,
        price: roundPrice(p.price),
        label: labels[idx],
      }));
    }
  } else if (pivots.length >= 4) {
    const recent4 = pivots.slice(-4);
    wavePattern = 'correction';
    const corrNet = recent4[3].price - recent4[0].price;
    waveDirection =
      Math.abs(corrNet / Math.max(recent4[0].price, 1e-6)) < 0.01
        ? 'sideway'
        : corrNet > 0
        ? 'up'
        : 'down';
    const labels = ['0', 'A', 'B', 'C'];
    wavePoints = recent4.map((p, idx) => ({
      ...p,
      price: roundPrice(p.price),
      label: labels[idx],
    }));
  }

  let breakevenDeltaAbs: number | null = null;
  let breakevenDeltaPct: number | null = null;
  if (typeof averageCost === 'number' && Number.isFinite(averageCost) && averageCost > 0) {
    breakevenDeltaAbs = roundPrice(latestPrice - averageCost);
    breakevenDeltaPct = Number((((latestPrice - averageCost) / averageCost) * 100).toFixed(2));
  }

  return {
    latestPrice: roundPrice(latestPrice),
    support1,
    support2,
    resistance1,
    resistance2,
    pivot: roundPrice(pivot),
    wavePattern,
    waveDirection,
    wavePoints,
    breakevenDeltaAbs,
    breakevenDeltaPct,
  };
}
