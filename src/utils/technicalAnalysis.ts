import {
  ChartCandle,
  ChartTimeframe,
  ChartTrendDirection,
  TrendFibonacciResult,
} from '../types';

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

/**
 * Exponential Moving Average (EMA) series over candle closes (0% AI Quota).
 */
export function computeEmaSeries(candles: ChartCandle[], period: number): Array<number | null> {
  if (candles.length === 0 || period <= 1) return candles.map((c) => c.close);
  const result: Array<number | null> = new Array(candles.length).fill(null);
  if (candles.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }
  let ema = sum / period;
  result[period - 1] = ema;

  const multiplier = 2 / (period + 1);
  for (let i = period; i < candles.length; i++) {
    ema = (candles[i].close - ema) * multiplier + ema;
    result[i] = ema;
  }
  return result;
}

function roundPrice(val: number): number {
  const abs = Math.abs(val);
  if (abs >= 1) return Number(val.toFixed(2));
  return Number(val.toFixed(4));
}

function getLatestEma(series: Array<number | null>): number | null {
  for (let i = series.length - 1; i >= 0; i--) {
    const val = series[i];
    if (typeof val === 'number' && Number.isFinite(val)) {
      return roundPrice(val);
    }
  }
  return null;
}

/**
 * Pure Mathematical Trend, Support/Resistance & Fibonacci Engine (0% AI Quota):
 * 1. EMA 20 / EMA 50 Trend Classification (Uptrend / Downtrend / Sideway)
 * 2. Key Support 1/2 & Resistance 1/2 (Swing High/Low + Classic Pivot confluence)
 * 3. Fibonacci Retracement (38.2%, 50.0%, 61.8%) & Extension Targets (127.2%, 161.8%)
 * 4. Breakeven Cost P/L and % distance to next upside Fibonacci target
 */
export function computeTrendAndFibonacci(
  candles: ChartCandle[],
  timeframe: ChartTimeframe,
  averageCost?: number
): TrendFibonacciResult | null {
  if (candles.length < 6) return null;

  const latestPrice = candles[candles.length - 1].close;
  const ema20Series = computeEmaSeries(candles, 20);
  const ema50Series = computeEmaSeries(candles, 50);
  const ema20 = getLatestEma(ema20Series);
  const ema50 = getLatestEma(ema50Series);

  let trend: ChartTrendDirection = 'Sideway';
  let trendTh = 'ไซด์เวย์ (Sideway)';

  if (ema20 !== null && ema50 !== null) {
    if (latestPrice > ema20 && ema20 >= ema50) {
      trend = 'Uptrend';
      trendTh = 'เทรนขาขึ้น (Uptrend)';
    } else if (latestPrice < ema20 && ema20 <= ema50) {
      trend = 'Downtrend';
      trendTh = 'เทรนขาลง (Downtrend)';
    } else {
      trend = 'Sideway';
      trendTh = 'ไซด์เวย์ (Sideway)';
    }
  } else if (ema20 !== null) {
    if (latestPrice > ema20 * 1.005) {
      trend = 'Uptrend';
      trendTh = 'เทรนขาขึ้น (Uptrend)';
    } else if (latestPrice < ema20 * 0.995) {
      trend = 'Downtrend';
      trendTh = 'เทรนขาลง (Downtrend)';
    }
  }

  // Recent structural window for Swing High / Swing Low & Pivot confluence
  const windowSize = timeframe === '1D' ? 60 : 80;
  const lookback = candles.slice(-Math.min(candles.length, windowSize));

  let swingHigh = -Infinity;
  let swingLow = Infinity;
  for (const c of lookback) {
    if (c.high > swingHigh) swingHigh = c.high;
    if (c.low < swingLow) swingLow = c.low;
  }

  const range = Math.max(swingHigh - swingLow, latestPrice * 0.01);

  // Classic Pivot Points over recent 40 candles
  const pivotWindow = candles.slice(-Math.min(candles.length, 40));
  let pHigh = -Infinity;
  let pLow = Infinity;
  for (const c of pivotWindow) {
    if (c.high > pHigh) pHigh = c.high;
    if (c.low < pLow) pLow = c.low;
  }
  const pivot = (pHigh + pLow + latestPrice) / 3;
  const pivotR1 = 2 * pivot - pLow;
  const pivotS1 = 2 * pivot - pHigh;
  const pivotR2 = pivot + (pHigh - pLow);
  const pivotS2 = pivot - (pHigh - pLow);

  // Local swing highs & lows (radius 2 bars)
  const localHighs: number[] = [];
  const localLows: number[] = [];
  for (let i = 2; i < candles.length - 2; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    if (
      h >= candles[i - 1].high &&
      h >= candles[i - 2].high &&
      h >= candles[i + 1].high &&
      h >= candles[i + 2].high
    ) {
      localHighs.push(h);
    }
    if (
      l <= candles[i - 1].low &&
      l <= candles[i - 2].low &&
      l <= candles[i + 1].low &&
      l <= candles[i + 2].low
    ) {
      localLows.push(l);
    }
  }

  const aboveSwings = localHighs
    .filter((p) => p > latestPrice * 1.003)
    .sort((a, b) => a - b);
  const belowSwings = localLows
    .filter((p) => p < latestPrice * 0.997)
    .sort((a, b) => b - a);

  const resistance1 = roundPrice(
    aboveSwings[0] ?? Math.max(pivotR1, latestPrice * 1.02)
  );
  const resistance2 = roundPrice(
    aboveSwings.find((p) => p > resistance1 * 1.012) ??
      Math.max(pivotR2, swingHigh, resistance1 * 1.035)
  );
  const support1 = roundPrice(
    belowSwings[0] ?? Math.min(pivotS1, latestPrice * 0.98)
  );
  const support2 = roundPrice(
    belowSwings.find((p) => p < support1 * 0.988) ??
      Math.min(pivotS2, swingLow, support1 * 0.965)
  );

  // Fibonacci Retracement (Pullback Support Zones from Swing High)
  const fib382 = roundPrice(swingHigh - range * 0.382);
  const fib500 = roundPrice(swingHigh - range * 0.5);
  const fib618 = roundPrice(swingHigh - range * 0.618);

  // Fibonacci Extension Targets (Upside Breakout Targets)
  const fib1272 = roundPrice(swingLow + range * 1.272);
  const fib1618 = roundPrice(swingLow + range * 1.618);

  // Pick next meaningful upside Fibonacci target strictly above current price
  const orderedFibTargets: Array<{ label: string; price: number }> = [
    { label: 'Fib 61.8%', price: fib618 },
    { label: 'Fib 50.0%', price: fib500 },
    { label: 'Fib 38.2%', price: fib382 },
    { label: 'Fib 127.2%', price: fib1272 },
    { label: 'Fib 161.8%', price: fib1618 },
  ];

  // Prefer extension targets (127.2% / 161.8%) if price is already near/above Fib 38.2%
  const upsideTarget =
    latestPrice >= fib382 * 0.99
      ? orderedFibTargets.find(
          (t) =>
            (t.label === 'Fib 127.2%' || t.label === 'Fib 161.8%') &&
            t.price > latestPrice * 1.003
        ) ?? { label: 'Fib 161.8%', price: fib1618 }
      : orderedFibTargets.find((t) => t.price > latestPrice * 1.005) ?? {
          label: 'Fib 127.2%',
          price: fib1272,
        };

  const distanceToNextFibPct = Number(
    (((upsideTarget.price - latestPrice) / Math.max(latestPrice, 1e-6)) * 100).toFixed(2)
  );

  let breakevenDeltaAbs: number | null = null;
  let breakevenDeltaPct: number | null = null;
  if (typeof averageCost === 'number' && Number.isFinite(averageCost) && averageCost > 0) {
    breakevenDeltaAbs = roundPrice(latestPrice - averageCost);
    breakevenDeltaPct = Number((((latestPrice - averageCost) / averageCost) * 100).toFixed(2));
  }

  return {
    latestPrice: roundPrice(latestPrice),
    ema20,
    ema50,
    trend,
    trendTh,
    support1,
    support2,
    resistance1,
    resistance2,
    swingHigh: roundPrice(swingHigh),
    swingLow: roundPrice(swingLow),
    fibRetracement: {
      fib382,
      fib500,
      fib618,
    },
    fibExtension: {
      fib1272,
      fib1618,
    },
    breakevenDeltaAbs,
    breakevenDeltaPct,
    nextFibTargetLabel: upsideTarget.label,
    nextFibTargetPrice: upsideTarget.price,
    distanceToNextFibPct,
  };
}
