import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart2,
  Clock,
  Crosshair,
  Loader2,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Waves,
  X,
  Zap,
} from 'lucide-react';
import {
  ChartAiAnalysisResponse,
  ChartHistoryResponse,
  ChartTargetAsset,
  ChartTimeframe,
  QuotaSnapshot,
} from '../types';
import {
  computeTechnicalStructure,
  formatCurrencyPrice,
  toTradingViewSymbol,
} from '../utils/technicalAnalysis';
import {
  analyzeChartTechnicalLive,
  fetchChartHistoryLive,
} from '../services/geminiService';
import { loadCachedChartAnalysis } from '../utils/liveDataCache';

interface TechnicalChartModalProps {
  asset: ChartTargetAsset | null;
  quota: QuotaSnapshot;
  onClose: () => void;
  onUpdateCost?: (portfolioId: string, averageCost?: number, quantity?: number) => void;
}

/**
 * TradingView Advanced Real-Time Chart Widget (Dark Theme)
 * Full left drawing toolbar (Trendline, Horizontal Line, Fibonacci, Elliott Wave)
 * + default indicators (RSI, Bollinger Bands, Stochastic, EMA). Uses 0% AI quota.
 */
function TradingViewWidgetPanel({ tvSymbol }: { tvSymbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    const widgetInner = document.createElement('div');
    widgetInner.className = 'tradingview-widget-container__widget';
    widgetInner.style.height = '100%';
    widgetInner.style.width = '100%';
    container.appendChild(widgetInner);

    const script = document.createElement('script');
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: 'D',
      timezone: 'Asia/Bangkok',
      theme: 'dark',
      style: '1',
      locale: 'th_TH',
      backgroundColor: 'rgba(9, 12, 17, 1)',
      gridColor: 'rgba(30, 38, 52, 0.45)',
      allow_symbol_change: true,
      hide_side_toolbar: false,
      hide_top_toolbar: false,
      save_image: true,
      calendar: false,
      studies: [
        'STD;RSI',
        'STD;Bollinger_Bands',
        'STD;Stochastic',
        'STD;EMA',
      ],
      support_host: 'https://www.tradingview.com',
    });

    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [tvSymbol]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>
          รหัสตลาด TradingView:{' '}
          <strong className="font-mono text-amber-300">{tvSymbol}</strong> · เปิดแถบเครื่องมือวาดเส้นด้านซ้ายครบชุด (Trendline, Horizontal Line, Fibonacci, Elliott Wave)
        </span>
        <span className="text-[11px] text-emerald-400 font-medium">
          อินดิเคเตอร์: RSI · BB · Stochastic · EMA (โควตา AI 0%)
        </span>
      </div>
      <div
        ref={containerRef}
        className="tradingview-widget-container w-full h-[500px] sm:h-[540px] rounded-lg overflow-hidden border border-[#1E2634] bg-[#090C11]"
      />
    </div>
  );
}

/**
 * Interactive Mathematical Price Structure & Preliminary Elliott Wave SVG Chart (0% AI Quota).
 */
function InteractiveStructureSvgChart({
  history,
  averageCost,
  showElliottWave,
}: {
  history: ChartHistoryResponse;
  averageCost?: number;
  showElliottWave: boolean;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const candles = history.candles;
  const currency = history.currency;

  const structure = useMemo(
    () => computeTechnicalStructure(candles, history.timeframe, averageCost),
    [candles, history.timeframe, averageCost]
  );

  const width = 920;
  const height = 400;
  const padTop = 26;
  const padBottom = 34;
  const padLeft = 14;
  const padRight = 92;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const { minPrice, maxPrice } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const c of candles) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    }
    if (structure) {
      min = Math.min(min, structure.support2);
      max = Math.max(max, structure.resistance2);
    }
    if (typeof averageCost === 'number' && averageCost > 0) {
      // Keep Breakeven visible if within +/- 35% of range
      if (averageCost >= min * 0.65 && averageCost <= max * 1.35) {
        min = Math.min(min, averageCost);
        max = Math.max(max, averageCost);
      }
    }
    const span = Math.max(max - min, 0.0001);
    return {
      minPrice: min - span * 0.08,
      maxPrice: max + span * 0.08,
    };
  }, [candles, structure, averageCost]);

  const priceSpan = Math.max(maxPrice - minPrice, 0.0001);
  const yOf = (price: number) => padTop + ((maxPrice - price) / priceSpan) * plotH;
  const stepX = plotW / Math.max(candles.length, 1);
  const xOf = (idx: number) => padLeft + idx * stepX + stepX / 2;
  const candleBodyW = Math.max(2, Math.min(9, stepX * 0.62));

  const gridTicks = useMemo(() => {
    const count = 5;
    const ticks: number[] = [];
    for (let i = 0; i <= count; i++) {
      ticks.push(minPrice + (priceSpan * i) / count);
    }
    return ticks;
  }, [minPrice, priceSpan]);

  const hoveredCandle = hoverIndex !== null ? candles[hoverIndex] ?? null : null;

  const horizontalLevels = useMemo(() => {
    if (!structure) return [];
    const list: Array<{
      key: string;
      price: number;
      label: string;
      stroke: string;
      textFill: string;
      badgeBg: string;
      dash: string;
      width: number;
    }> = [
      {
        key: 'r2',
        price: structure.resistance2,
        label: 'R2',
        stroke: '#FB7185',
        textFill: '#FECDD3',
        badgeBg: '#4C0519',
        dash: '4 4',
        width: 1.2,
      },
      {
        key: 'r1',
        price: structure.resistance1,
        label: 'R1',
        stroke: '#F43F5E',
        textFill: '#FFE4E6',
        badgeBg: '#881337',
        dash: '5 3',
        width: 1.5,
      },
      {
        key: 's1',
        price: structure.support1,
        label: 'S1',
        stroke: '#10B981',
        textFill: '#D1FAE5',
        badgeBg: '#064E3B',
        dash: '5 3',
        width: 1.5,
      },
      {
        key: 's2',
        price: structure.support2,
        label: 'S2',
        stroke: '#34D399',
        textFill: '#A7F3D0',
        badgeBg: '#022C22',
        dash: '4 4',
        width: 1.2,
      },
    ];

    if (typeof averageCost === 'number' && averageCost > 0) {
      list.push({
        key: 'breakeven',
        price: averageCost,
        label: 'ทุน',
        stroke: '#F59E0B',
        textFill: '#FEF3C7',
        badgeBg: '#78350F',
        dash: '6 3',
        width: 2,
      });
    }

    return list.filter((lv) => lv.price >= minPrice && lv.price <= maxPrice);
  }, [structure, averageCost, minPrice, maxPrice]);

  const wavePolylinePoints = useMemo(() => {
    if (!showElliottWave || !structure || structure.wavePoints.length < 2) return '';
    return structure.wavePoints
      .map((wp) => `${xOf(wp.candleIndex).toFixed(1)},${yOf(wp.price).toFixed(1)}`)
      .join(' ');
  }, [showElliottWave, structure, candles.length, minPrice, maxPrice]);

  return (
    <div className="space-y-3">
      {/* Hover Readout Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg bg-[#090C11] border border-[#1E2634]">
        {hoveredCandle ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono tabular-nums text-[11px]">
            <span className="text-slate-300 font-sans font-medium">{hoveredCandle.label}</span>
            <span className="text-slate-400">
              O: <strong className="text-slate-100">{formatCurrencyPrice(hoveredCandle.open, currency)}</strong>
            </span>
            <span className="text-slate-400">
              H: <strong className="text-emerald-300">{formatCurrencyPrice(hoveredCandle.high, currency)}</strong>
            </span>
            <span className="text-slate-400">
              L: <strong className="text-rose-300">{formatCurrencyPrice(hoveredCandle.low, currency)}</strong>
            </span>
            <span className="text-slate-400">
              C: <strong className="text-amber-300">{formatCurrencyPrice(hoveredCandle.close, currency)}</strong>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Crosshair className="w-3.5 h-3.5 text-slate-500" />
            <span>เลื่อนเมาส์บนกราฟเพื่อดูราคา OHLC แต่ละแท่งเทียน ({candles.length} แท่ง · {history.timeframe})</span>
          </div>
        )}
        <span className="text-[11px] text-sky-300">
          โครงสร้างคลื่นเบื้องต้น (ZigZag + Pivot S/R · โควตา AI 0%)
        </span>
      </div>

      {/* Interactive SVG Canvas */}
      <div className="relative rounded-lg border border-[#1E2634] bg-[#090C11] overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-[320px] sm:h-[390px] select-none block"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / rect.width) * width;
            const idx = Math.floor((relX - padLeft) / stepX);
            if (idx >= 0 && idx < candles.length) {
              setHoverIndex(idx);
            } else {
              setHoverIndex(null);
            }
          }}
        >
          {/* Gridlines & Y-Axis Labels */}
          {gridTicks.map((tick, idx) => {
            const y = yOf(tick);
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#18202E"
                  strokeWidth="1"
                />
                <text
                  x={width - padRight + 8}
                  y={y + 4}
                  fill="#64748B"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {formatCurrencyPrice(tick, currency)}
                </text>
              </g>
            );
          })}

          {/* Horizontal Support / Resistance / Breakeven Lines */}
          {horizontalLevels.map((lv) => {
            const y = yOf(lv.price);
            return (
              <g key={lv.key}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke={lv.stroke}
                  strokeWidth={lv.width}
                  strokeDasharray={lv.dash}
                  opacity="0.9"
                />
                <rect
                  x={width - padRight + 2}
                  y={y - 9}
                  width={86}
                  height={18}
                  rx={4}
                  fill={lv.badgeBg}
                  stroke={lv.stroke}
                  strokeWidth="0.75"
                />
                <text
                  x={width - padRight + 7}
                  y={y + 3.5}
                  fill={lv.textFill}
                  fontSize="9.5"
                  fontWeight="600"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {lv.label} {lv.price >= 100 ? lv.price.toFixed(1) : lv.price.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* OHLC Candlesticks */}
          {candles.map((c, idx) => {
            const x = xOf(idx);
            const isUp = c.close >= c.open;
            const color = isUp ? '#10B981' : '#F43F5E';
            const yHigh = yOf(c.high);
            const yLow = yOf(c.low);
            const yTop = yOf(Math.max(c.open, c.close));
            const yBot = yOf(Math.min(c.open, c.close));
            const bodyH = Math.max(1.5, yBot - yTop);

            return (
              <g key={c.timestamp}>
                <line
                  x1={x}
                  y1={yHigh}
                  x2={x}
                  y2={yLow}
                  stroke={color}
                  strokeWidth="1.2"
                  opacity="0.85"
                />
                <rect
                  x={x - candleBodyW / 2}
                  y={yTop}
                  width={candleBodyW}
                  height={bodyH}
                  fill={color}
                  rx="0.75"
                />
              </g>
            );
          })}

          {/* Preliminary Elliott Wave ZigZag Polyline & Labels */}
          {showElliottWave && structure && structure.wavePoints.length >= 2 && (
            <g>
              <polyline
                fill="none"
                stroke="#38BDF8"
                strokeWidth="2.2"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={wavePolylinePoints}
                opacity="0.95"
              />
              {structure.wavePoints.map((wp) => {
                const cx = xOf(wp.candleIndex);
                const cy = yOf(wp.price);
                const labelOffsetY = wp.type === 'high' ? -15 : 16;
                return (
                  <g key={`${wp.candleIndex}-${wp.label}`}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r="4.2"
                      fill="#090C11"
                      stroke="#38BDF8"
                      strokeWidth="2"
                    />
                    <rect
                      x={cx - 10}
                      y={cy + labelOffsetY - 9}
                      width="20"
                      height="16"
                      rx="4"
                      fill="#0C4A6E"
                      stroke="#38BDF8"
                      strokeWidth="1"
                    />
                    <text
                      x={cx}
                      y={cy + labelOffsetY + 2.5}
                      textAnchor="middle"
                      fill="#E0F2FE"
                      fontSize="10"
                      fontWeight="700"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {wp.label}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* Hover Crosshair */}
          {hoveredCandle && hoverIndex !== null && (
            <g pointerEvents="none">
              <line
                x1={xOf(hoverIndex)}
                y1={padTop}
                x2={xOf(hoverIndex)}
                y2={height - padBottom}
                stroke="#94A3B8"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <line
                x1={padLeft}
                y1={yOf(hoveredCandle.close)}
                x2={width - padRight}
                y2={yOf(hoveredCandle.close)}
                stroke="#94A3B8"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            </g>
          )}

          {/* X-Axis Sparse Time Labels */}
          {[0, Math.floor(candles.length * 0.25), Math.floor(candles.length * 0.5), Math.floor(candles.length * 0.75), candles.length - 1]
            .filter((i, pos, arr) => i >= 0 && i < candles.length && arr.indexOf(i) === pos)
            .map((idx) => (
              <text
                key={idx}
                x={xOf(idx)}
                y={height - 10}
                textAnchor={idx === 0 ? 'start' : idx === candles.length - 1 ? 'end' : 'middle'}
                fill="#64748B"
                fontSize="10"
              >
                {candles[idx].label}
              </text>
            ))}
        </svg>
      </div>

      {/* Mathematical Key Levels Summary Strip */}
      {structure && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          <div className="p-3 rounded-lg bg-[#0D121A] border border-[#1E2634]">
            <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" />
              <span>แนวรับสำคัญ (Support)</span>
            </div>
            <div className="font-mono tabular-nums text-slate-100 font-semibold mt-1">
              S1: {formatCurrencyPrice(structure.support1, currency)}
            </div>
            <div className="font-mono tabular-nums text-[11px] text-slate-400 mt-0.5">
              S2: {formatCurrencyPrice(structure.support2, currency)}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#0D121A] border border-[#1E2634]">
            <div className="text-[11px] text-rose-400 font-medium flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" />
              <span>แนวต้านสำคัญ (Resistance)</span>
            </div>
            <div className="font-mono tabular-nums text-slate-100 font-semibold mt-1">
              R1: {formatCurrencyPrice(structure.resistance1, currency)}
            </div>
            <div className="font-mono tabular-nums text-[11px] text-slate-400 mt-0.5">
              R2: {formatCurrencyPrice(structure.resistance2, currency)}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#0D121A] border border-[#1E2634]">
            <div className="text-[11px] text-amber-300 font-medium flex items-center gap-1">
              <Target className="w-3.5 h-3.5" />
              <span>จุดคุ้มทุนของคุณ</span>
            </div>
            {typeof averageCost === 'number' && averageCost > 0 ? (
              <>
                <div className="font-mono tabular-nums text-slate-100 font-semibold mt-1">
                  {formatCurrencyPrice(averageCost, currency)}
                </div>
                {structure.breakevenDeltaPct !== null && (
                  <div
                    className={`font-mono tabular-nums text-[11px] font-semibold mt-0.5 ${
                      structure.breakevenDeltaPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {structure.breakevenDeltaPct >= 0 ? '+' : ''}
                    {structure.breakevenDeltaPct.toFixed(2)}% เทียบราคาปัจจุบัน
                  </div>
                )}
              </>
            ) : (
              <div className="text-[11px] text-slate-400 mt-1">
                ยังไม่ได้กรอกราคาทุนเฉลี่ย
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg bg-[#0D121A] border border-[#1E2634]">
            <div className="text-[11px] text-sky-300 font-medium flex items-center gap-1">
              <Waves className="w-3.5 h-3.5" />
              <span>โครงสร้างคลื่นเบื้องต้น</span>
            </div>
            <div className="text-slate-100 font-semibold mt-1">
              {structure.wavePattern === 'impulse'
                ? `คลื่น 1-2-3-4-5 (${structure.waveDirection === 'up' ? 'ขาขึ้น' : 'ขาลง'})`
                : structure.wavePattern === 'correction'
                ? 'คลื่นพักฐาน A-B-C'
                : 'กำลังสะสมข้อมูลคลื่น'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              ตรวจจับอัตโนมัติ {structure.wavePoints.length} จุดกลับตัว
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TechnicalChartModal({
  asset,
  quota,
  onClose,
  onUpdateCost,
}: TechnicalChartModalProps) {
  const [chartMode, setChartMode] = useState<'tradingview' | 'structure'>('tradingview');
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('1D');
  const [showElliottWave, setShowElliottWave] = useState(true);

  const [history, setHistory] = useState<ChartHistoryResponse | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Local editable cost state so user can tweak Breakeven live inside chart modal
  const [costInput, setCostInput] = useState('');
  const [qtyInput, setQtyInput] = useState('');
  const [activeAverageCost, setActiveAverageCost] = useState<number | undefined>(undefined);
  const [activeQuantity, setActiveQuantity] = useState<number | undefined>(undefined);

  // On-Demand AI Technical Analysis (NEVER runs automatically!)
  const [aiAnalysis, setAiAnalysis] = useState<ChartAiAnalysisResponse | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (!asset) return;
    setChartMode('tradingview');
    setTimeframe('1D');
    setActiveAverageCost(asset.averageCost);
    setActiveQuantity(asset.quantity);
    setCostInput(asset.averageCost ? String(asset.averageCost) : '');
    setQtyInput(asset.quantity ? String(asset.quantity) : '');
    setAiError(null);
  }, [asset?.symbol, asset?.averageCost, asset?.quantity]);

  // Close modal on Escape
  useEffect(() => {
    if (!asset) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [asset, onClose]);

  // Load 0%-AI historical candles whenever asset or timeframe changes
  useEffect(() => {
    if (!asset) return;
    let cancelled = false;
    setLoadingHistory(true);
    setHistoryError(null);

    fetchChartHistoryLive(asset.symbol, asset.category, timeframe)
      .then((res) => {
        if (!cancelled) setHistory(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setHistory(null);
          setHistoryError(
            err instanceof Error ? err.message : 'ไม่สามารถโหลดแท่งเทียนย้อนหลังได้'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [asset?.symbol, asset?.category, timeframe]);

  // Hydrate ONLY from existing 4-hour LocalStorage cache (never auto-calls Gemini!)
  useEffect(() => {
    if (!asset) return;
    const cached = loadCachedChartAnalysis(asset.symbol, timeframe, activeAverageCost);
    setAiAnalysis(cached);
    setAiError(null);
  }, [asset?.symbol, timeframe, activeAverageCost]);

  const structure = useMemo(() => {
    if (!history) return null;
    return computeTechnicalStructure(history.candles, history.timeframe, activeAverageCost);
  }, [history, activeAverageCost]);

  if (!asset) return null;

  const tvSymbol = toTradingViewSymbol(asset);
  const currency = history?.currency || asset.currency || 'USD';
  const latestPrice = history?.latestPrice ?? null;
  const changePercent = history?.changePercent ?? null;

  function handleSaveCostInline(e: React.FormEvent) {
    e.preventDefault();
    const parsedCost = parseFloat(costInput);
    const parsedQty = parseFloat(qtyInput);
    const nextCost = Number.isFinite(parsedCost) && parsedCost > 0 ? parsedCost : undefined;
    const nextQty = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : undefined;
    setActiveAverageCost(nextCost);
    setActiveQuantity(nextQty);
    if (asset?.portfolioId && onUpdateCost) {
      onUpdateCost(asset.portfolioId, nextCost, nextQty);
    }
  }

  async function handleRunOnDemandAi(force = false) {
    if (!asset || !history || !structure) return;
    setLoadingAi(true);
    setAiError(null);
    try {
      const result = await analyzeChartTechnicalLive(
        {
          symbol: asset.symbol,
          name: asset.name,
          category: asset.category,
          currency,
          timeframe,
          latestPrice: structure.latestPrice,
          support1: structure.support1,
          support2: structure.support2,
          resistance1: structure.resistance1,
          resistance2: structure.resistance2,
          wavePattern: structure.wavePattern,
          waveDirection: structure.waveDirection,
          wavePoints: structure.wavePoints,
          averageCost: activeAverageCost,
          quantity: activeQuantity,
        },
        { force }
      );
      setAiAnalysis(result);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'ไม่สามารถวิเคราะห์กราฟด้วย AI ได้ในขณะนี้'
      );
    } finally {
      setLoadingAi(false);
    }
  }

  const aiBlocked = quota.isCoolingDown || quota.dailyExhausted;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`กราฟเทคนิคและวิเคราะห์ ${asset.symbol}`}
    >
      <div
        className="w-full max-w-6xl my-2 sm:my-4 rounded-xl bg-[#10151E] border border-[#243043] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-[#1E2634] flex flex-wrap items-center justify-between gap-3 bg-[#0C1017]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#161E2B] border border-[#253042] flex items-center justify-center text-xl shrink-0">
              {asset.flag}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-mono text-lg font-bold text-slate-100">
                  {asset.symbol}
                </h2>
                <span className="text-xs text-slate-400">
                  {asset.market} · {currency}
                </span>
                {latestPrice !== null && (
                  <span className="font-mono tabular-nums text-sm font-semibold text-slate-100">
                    {formatCurrencyPrice(latestPrice, currency)}
                  </span>
                )}
                {changePercent !== null && (
                  <span
                    className={`font-mono tabular-nums text-xs font-semibold ${
                      changePercent > 0
                        ? 'text-emerald-400'
                        : changePercent < 0
                        ? 'text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {changePercent > 0 ? '+' : ''}
                    {changePercent.toFixed(2)}%
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">{asset.name}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#1A2230] transition-colors cursor-pointer"
            aria-label="ปิดหน้าต่างกราฟ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls Bar: Segmented Chart Mode Switcher + Inline Breakeven Input */}
        <div className="px-4 sm:px-6 py-3 border-b border-[#1E2634] bg-[#0D121A] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Confirmed Q2: Segmented Tabs between TradingView & Interactive Structure/Wave */}
          <div className="flex items-center gap-1 p-1 bg-[#090C11] border border-[#1E2634] rounded-lg overflow-x-auto">
            <button
              type="button"
              onClick={() => setChartMode('tradingview')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                chartMode === 'tradingview'
                  ? 'bg-[#1C2536] text-amber-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>กราฟ TradingView (เครื่องมือวาดเส้นครบ)</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMode('structure')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                chartMode === 'structure'
                  ? 'bg-[#1C2536] text-amber-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Waves className="w-3.5 h-3.5" />
              <span>โครงสร้างราคา จุดคุ้มทุน &amp; Elliott Wave</span>
            </button>
          </div>

          {/* Live Breakeven Cost Editor (0% AI Quota) */}
          <form
            onSubmit={handleSaveCostInline}
            className="flex flex-wrap items-center gap-2 text-xs"
          >
            <label className="text-slate-400 whitespace-nowrap">
              🎯 ทุนเฉลี่ย ({currency}):
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={costInput}
              onChange={(e) => setCostInput(e.target.value)}
              placeholder="เช่น 150.50"
              className="w-28 bg-[#090C11] border border-[#253042] rounded-md px-2.5 py-1.5 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/70"
            />
            {asset.portfolioId && (
              <input
                type="number"
                step="any"
                min="0"
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
                placeholder="จำนวนหน่วย"
                className="w-24 bg-[#090C11] border border-[#253042] rounded-md px-2.5 py-1.5 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/70"
              />
            )}
            <button
              type="submit"
              className="px-3 py-1.5 rounded-md bg-[#192334] border border-[#2B3950] hover:border-amber-500/50 text-amber-300 font-medium whitespace-nowrap cursor-pointer transition-colors"
            >
              อัปเดตเส้นทุน
            </button>
          </form>
        </div>

        {/* Chart Viewport */}
        <div className="p-4 sm:p-6 space-y-5">
          {chartMode === 'tradingview' ? (
            <TradingViewWidgetPanel tvSymbol={tvSymbol} />
          ) : (
            <div className="space-y-3">
              {/* Timeframe Switcher (1D / 4H / 1H) + Elliott Wave Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-1 p-1 bg-[#090C11] border border-[#1E2634] rounded-lg">
                  {(['1D', '4H', '1H'] as const).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setTimeframe(tf)}
                      className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        timeframe === tf
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setShowElliottWave((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    showElliottWave
                      ? 'bg-sky-500/15 border-sky-500/45 text-sky-200'
                      : 'bg-[#0D121A] border-[#253042] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Waves className="w-3.5 h-3.5" />
                  <span>
                    เส้นคลื่น Elliott Wave เบื้องต้น: {showElliottWave ? 'เปิด' : 'ปิด'}
                  </span>
                </button>
              </div>

              {loadingHistory ? (
                <div className="h-[390px] rounded-lg border border-[#1E2634] bg-[#090C11] flex flex-col items-center justify-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                  <span>กำลังดึงแท่งเทียนย้อนหลัง {timeframe} จาก Yahoo Finance (ใช้โควตา AI 0%)...</span>
                </div>
              ) : historyError ? (
                <div className="p-8 rounded-lg border border-rose-500/30 bg-rose-500/[0.06] text-center space-y-2">
                  <AlertCircle className="w-5 h-5 text-rose-400 mx-auto" />
                  <p className="text-xs text-rose-200">{historyError}</p>
                  <p className="text-[11px] text-slate-400">
                    คุณยังสามารถสลับไปดูกราฟสดในแท็บ TradingView ได้ทันที
                  </p>
                </div>
              ) : history ? (
                <InteractiveStructureSvgChart
                  history={history}
                  averageCost={activeAverageCost}
                  showElliottWave={showElliottWave}
                />
              ) : null}
            </div>
          )}

          {/* Section 4: On-Demand AI Technical & Elliott Wave Analysis (Manual Trigger + 4h Cache) */}
          <section className="pt-4 border-t border-[#1E2634] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>วิเคราะห์กราฟ คลื่น Elliott Wave &amp; จุดซื้อขายด้วย AI</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  ทำงานเฉพาะเมื่อกดปุ่ม (ไม่ยิง AI อัตโนมัติตอนเปิดกราฟ) · ส่งราคาล่าสุด แนวรับ-ต้าน พิกัดคลื่น {timeframe} และราคาทุนของคุณ วิเคราะห์ใน 1 คำขอพร้อมแคช 4 ชั่วโมง
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {aiAnalysis?.fromCache && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-300 whitespace-nowrap">
                    <Zap className="w-3.5 h-3.5" />
                    <span>ใช้ Cache 4 ชม.</span>
                  </span>
                )}

                <button
                  type="button"
                  disabled={loadingAi || !structure || aiBlocked}
                  onClick={() => void handleRunOnDemandAi(Boolean(aiAnalysis))}
                  className="px-4 py-2.5 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-55 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  {loadingAi ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>AI กำลังวิเคราะห์คลื่น &amp; แผนเทรด...</span>
                    </>
                  ) : quota.isCoolingDown ? (
                    <>
                      <Clock className="w-4 h-4" />
                      <span>ติดคูลดาวน์ รอ {quota.cooldownSecondsLeft} วินาที</span>
                    </>
                  ) : quota.dailyExhausted ? (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      <span>โควตา AI รายวันเต็มชั่วคราว</span>
                    </>
                  ) : aiAnalysis ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>วิเคราะห์กราฟใหม่ด้วย AI</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>✨ วิเคราะห์กราฟ คลื่น Elliott Wave &amp; จุดซื้อขายด้วย AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {aiError && (
              <div className="px-4 py-3 rounded-lg bg-rose-500/10 border border-rose-500/35 text-xs text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{aiError}</span>
              </div>
            )}

            {aiAnalysis && (
              <div className="rounded-xl bg-[#0B0F16] border border-[#222D40] p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#1A2230]">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded border ${
                        aiAnalysis.trend === 'Uptrend'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                          : aiAnalysis.trend === 'Downtrend'
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      {aiAnalysis.trend === 'Uptrend' ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : aiAnalysis.trend === 'Downtrend' ? (
                        <TrendingDown className="w-3.5 h-3.5" />
                      ) : (
                        <Activity className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {aiAnalysis.trend} · {aiAnalysis.trendTh}
                      </span>
                    </span>
                    <span className="text-xs text-slate-400">
                      Timeframe <strong className="font-mono text-slate-200">{aiAnalysis.timeframe}</strong>
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    วิเคราะห์เมื่อ{' '}
                    {new Date(aiAnalysis.analyzedAt).toLocaleTimeString('th-TH', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    น.
                  </span>
                </div>

                {/* Elliott Wave Block */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-[#10151E] border border-[#1E2634] lg:col-span-1">
                    <div className="text-[11px] text-sky-300 font-semibold">
                      🌊 สถานะคลื่น Elliott Wave ปัจจุบัน
                    </div>
                    <p className="text-slate-200 mt-1 leading-relaxed">
                      {aiAnalysis.waveStatusTh}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#10151E] border border-[#1E2634]">
                    <div className="text-[11px] text-rose-400 font-semibold">
                      จุดยกเลิกการนับคลื่น (Invalidation Level)
                    </div>
                    <p className="font-mono text-slate-100 font-medium mt-1 leading-relaxed">
                      {aiAnalysis.invalidationLevel}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#10151E] border border-[#1E2634]">
                    <div className="text-[11px] text-emerald-400 font-semibold">
                      เป้าหมายคลื่นถัดไป (Next Wave Target)
                    </div>
                    <p className="font-mono text-slate-100 font-medium mt-1 leading-relaxed">
                      {aiAnalysis.nextWaveTarget}
                    </p>
                  </div>
                </div>

                {/* Actionable Trading Zones */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-emerald-500/[0.07] border border-emerald-500/30">
                    <div className="text-[11px] text-emerald-300 font-semibold">
                      โซนเข้าซื้อสะสม (Buy / DCA Zone)
                    </div>
                    <div className="font-mono text-slate-100 font-semibold mt-1">
                      {aiAnalysis.buyDcaZone}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/[0.07] border border-amber-500/30">
                    <div className="text-[11px] text-amber-300 font-semibold">
                      จุดทำกำไร (Take Profit Zone)
                    </div>
                    <div className="font-mono text-slate-100 font-semibold mt-1">
                      {aiAnalysis.takeProfitZone}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-rose-500/[0.07] border border-rose-500/30">
                    <div className="text-[11px] text-rose-300 font-semibold">
                      จุดตัดขาดทุน (Stop Loss)
                    </div>
                    <div className="font-mono text-slate-100 font-semibold mt-1">
                      {aiAnalysis.stopLossLevel}
                    </div>
                  </div>
                </div>

                {/* Breakeven Strategy & Summary */}
                <div className="space-y-2 pt-2 border-t border-[#1A2230] text-xs leading-relaxed">
                  <p className="text-amber-200">
                    <strong className="text-amber-300">🎯 คำแนะนำเทียบจุดคุ้มทุน:</strong>{' '}
                    {aiAnalysis.breakevenAdviceTh}
                  </p>
                  <p className="text-slate-300">{aiAnalysis.summaryTh}</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
