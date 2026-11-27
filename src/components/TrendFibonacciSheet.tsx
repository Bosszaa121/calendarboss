import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
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
  analyzeChartTechnicalLive,
  fetchChartHistoryLive,
} from '../services/geminiService';
import {
  computeTrendAndFibonacci,
  formatCurrencyPrice,
} from '../utils/technicalAnalysis';
import { loadCachedChartAnalysis } from '../utils/liveDataCache';

interface TrendFibonacciSheetProps {
  asset: ChartTargetAsset | null;
  quota: QuotaSnapshot;
  onClose: () => void;
  onUpdateAssetCost?: (portfolioId: string, averageCost?: number, quantity?: number) => void;
}

const TIMEFRAMES: Array<{ id: ChartTimeframe; label: string }> = [
  { id: '1D', label: '1D (รายวัน)' },
  { id: '4H', label: '4H' },
  { id: '1H', label: '1H' },
];

function parsePositiveNumber(raw: string): number | undefined {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!cleaned) return undefined;
  const num = Number(cleaned);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

export function TrendFibonacciSheet({
  asset,
  quota,
  onClose,
  onUpdateAssetCost,
}: TrendFibonacciSheetProps) {
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('1D');
  const [history, setHistory] = useState<ChartHistoryResponse | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [aiAnalysis, setAiAnalysis] = useState<ChartAiAnalysisResponse | null>(null);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Inline breakeven cost editor
  const [editingCost, setEditingCost] = useState(false);
  const [costInput, setCostInput] = useState('');
  const [qtyInput, setQtyInput] = useState('');

  // Reset timeframe to 1D whenever asset changes
  useEffect(() => {
    if (!asset) return;
    setTimeframe('1D');
    setEditingCost(false);
    setCostInput(asset.averageCost !== undefined ? String(asset.averageCost) : '');
    setQtyInput(asset.quantity !== undefined ? String(asset.quantity) : '');
    setAiError(null);
  }, [asset?.symbol, asset?.portfolioId]);

  // Close on Escape key & lock background scroll while open
  useEffect(() => {
    if (!asset) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [asset, onClose]);

  // Fetch free Yahoo Finance High/Low/Close data (0% AI quota)
  useEffect(() => {
    if (!asset) return;
    let cancelled = false;
    setIsLoadingHistory(true);
    setHistoryError(null);

    fetchChartHistoryLive(asset.symbol, asset.category, timeframe)
      .then((res) => {
        if (cancelled) return;
        setHistory(res);
      })
      .catch((err) => {
        if (cancelled) return;
        setHistory(null);
        setHistoryError(
          err instanceof Error
            ? err.message
            : 'ไม่สามารถดึงข้อมูลราคาย้อนหลังจาก Yahoo Finance ได้'
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [asset?.symbol, asset?.category, timeframe]);

  // Load 4-hour cached concise AI plan (0% AI quota) if present
  useEffect(() => {
    if (!asset) return;
    const cached = loadCachedChartAnalysis(asset.symbol, timeframe, asset.averageCost);
    setAiAnalysis(cached);
    setAiError(null);
  }, [asset?.symbol, timeframe, asset?.averageCost]);

  const analysis = useMemo(() => {
    if (!history || history.candles.length < 6) return null;
    return computeTrendAndFibonacci(history.candles, timeframe, asset?.averageCost);
  }, [history, timeframe, asset?.averageCost]);

  if (!asset) return null;

  const currency = history?.currency || asset.currency || 'USD';
  const changePct = history?.changePercent ?? null;

  async function handleRunAiPlan(force = false) {
    if (!asset || !analysis) return;
    setIsAnalyzingAi(true);
    setAiError(null);
    try {
      const res = await analyzeChartTechnicalLive(
        {
          symbol: asset.symbol,
          name: asset.name,
          category: asset.category,
          currency,
          timeframe,
          latestPrice: analysis.latestPrice,
          ema20: analysis.ema20,
          ema50: analysis.ema50,
          trend: analysis.trend,
          support1: analysis.support1,
          support2: analysis.support2,
          resistance1: analysis.resistance1,
          resistance2: analysis.resistance2,
          fib382: analysis.fibRetracement.fib382,
          fib500: analysis.fibRetracement.fib500,
          fib618: analysis.fibRetracement.fib618,
          fib1272: analysis.fibExtension.fib1272,
          fib1618: analysis.fibExtension.fib1618,
          averageCost: asset.averageCost,
          quantity: asset.quantity,
        },
        { force }
      );
      setAiAnalysis(res);
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'ไม่สามารถสรุปแผนเข้าซื้อ-ขายด้วย AI ได้ในขณะนี้'
      );
    } finally {
      setIsAnalyzingAi(false);
    }
  }

  function handleSaveCost() {
    if (!asset || !asset.portfolioId || !onUpdateAssetCost) return;
    const nextCost = parsePositiveNumber(costInput);
    const nextQty = parsePositiveNumber(qtyInput);
    onUpdateAssetCost(asset.portfolioId, nextCost, nextQty);
    setEditingCost(false);
  }

  const trendStyle =
    analysis?.trend === 'Uptrend'
      ? {
          bg: 'bg-emerald-500/12 border-emerald-500/35',
          dot: 'bg-emerald-400',
          text: 'text-emerald-300',
          badgeText: 'เทรนขาขึ้น (Uptrend)',
        }
      : analysis?.trend === 'Downtrend'
      ? {
          bg: 'bg-rose-500/12 border-rose-500/35',
          dot: 'bg-rose-400',
          text: 'text-rose-300',
          badgeText: 'เทรนขาลง (Downtrend)',
        }
      : {
          bg: 'bg-amber-500/12 border-amber-500/35',
          dot: 'bg-amber-400',
          text: 'text-amber-300',
          badgeText: 'ไซด์เวย์ (Sideway)',
        };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trend-fib-sheet-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#0D121A] border-t border-x border-[#253042] rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-700" aria-hidden="true" />
        </div>

        {/* Sticky Sheet Header */}
        <div className="px-4 pb-3 pt-1 border-b border-[#1E2634] flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg shrink-0">{asset.flag}</span>
              <h2
                id="trend-fib-sheet-title"
                className="font-mono text-base font-bold text-slate-100 truncate"
              >
                {asset.symbol}
              </h2>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#161E2B] text-slate-400 shrink-0">
                {asset.market}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate mt-0.5">{asset.name}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {analysis && (
              <div className="text-right">
                <div className="font-mono tabular-nums text-base font-bold text-slate-100">
                  {formatCurrencyPrice(analysis.latestPrice, currency)}
                </div>
                {changePct !== null && (
                  <div
                    className={`font-mono tabular-nums text-[11px] font-semibold ${
                      changePct > 0
                        ? 'text-emerald-400'
                        : changePct < 0
                        ? 'text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {changePct > 0 ? '+' : ''}
                    {changePct.toFixed(2)}%
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 rounded-xl bg-[#141C28] border border-[#253042] text-slate-300 hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
              aria-label="ปิดหน้าต่างวิเคราะห์"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Timeframe Switcher (1D / 4H / 1H — single row) */}
        <div className="px-4 py-2.5 bg-[#090C11] border-b border-[#1E2634] flex items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
            กรอบเวลาคำนวณ
          </span>
          <div className="flex items-center gap-1 p-0.5 bg-[#10151E] border border-[#1E2634] rounded-lg">
            {TIMEFRAMES.map((tf) => {
              const active = timeframe === tf.id;
              return (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => setTimeframe(tf.id)}
                  className={`px-3 min-h-[36px] text-xs font-mono font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Sheet Body */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {isLoadingHistory ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-center">
              <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
              <p className="text-xs text-slate-300">
                กำลังดึงข้อมูลราคาจริง ({timeframe}) จาก Yahoo Finance...
              </p>
              <p className="text-[11px] text-slate-500">คำนวณฟรี 100% ไม่ใช้โควตา AI</p>
            </div>
          ) : historyError || !analysis ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-center space-y-3">
              <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto" />
              <p className="text-xs text-rose-200 leading-relaxed">
                {historyError || 'ข้อมูลราคาย้อนหลังไม่เพียงพอสำหรับคำนวณเทรนและ Fibonacci'}
              </p>
              <button
                type="button"
                onClick={() => setTimeframe((prev) => (prev === '1D' ? '4H' : '1D'))}
                className="px-4 min-h-[40px] rounded-lg bg-[#161E2B] border border-[#253042] text-xs text-slate-200 hover:border-amber-500/50 cursor-pointer"
              >
                ลองสลับกรอบเวลา
              </button>
            </div>
          ) : (
            <>
              {/* BOX 1: สถานะเทรนปัจจุบัน (EMA 20 / EMA 50) */}
              <section className="bg-[#10151E] border border-[#1E2634] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    {analysis.trend === 'Downtrend' ? (
                      <TrendingDown className="w-4 h-4 text-rose-400" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-amber-400" />
                    )}
                    <span>สถานะเทรนปัจจุบัน</span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">EMA 20 / 50</span>
                </div>

                <div
                  className={`px-3.5 py-3 rounded-xl border flex items-center justify-between gap-2 ${trendStyle.bg}`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full shrink-0 ${trendStyle.dot}`} />
                    <span className={`text-sm font-bold ${trendStyle.text}`}>
                      {trendStyle.badgeText}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">{timeframe}</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="bg-[#090C11] border border-[#1B2331] rounded-lg px-3 py-2 flex items-center justify-between">
                    <span className="text-slate-400">EMA 20</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-100">
                      {analysis.ema20 !== null
                        ? formatCurrencyPrice(analysis.ema20, currency)
                        : '—'}
                    </span>
                  </div>
                  <div className="bg-[#090C11] border border-[#1B2331] rounded-lg px-3 py-2 flex items-center justify-between">
                    <span className="text-slate-400">EMA 50</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-100">
                      {analysis.ema50 !== null
                        ? formatCurrencyPrice(analysis.ema50, currency)
                        : '—'}
                    </span>
                  </div>
                </div>
              </section>

              {/* BOX 2: แนวรับ - แนวต้านสำคัญ (2-Column S1/S2 & R1/R2) */}
              <section className="bg-[#10151E] border border-[#1E2634] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-slate-300">
                    🛡️ แนวรับ - แนวต้านสำคัญ
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Swing &amp; Pivot
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-[#090C11] border border-emerald-500/20 rounded-xl p-3 space-y-2">
                    <div className="text-[11px] font-semibold text-emerald-400">
                      แนวรับ (Support)
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-400">แนวรับ 1 (S1)</span>
                      <span className="font-mono tabular-nums font-bold text-emerald-300">
                        {formatCurrencyPrice(analysis.support1, currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-[#18202D]">
                      <span className="text-slate-400">แนวรับ 2 (S2)</span>
                      <span className="font-mono tabular-nums font-semibold text-emerald-400/90">
                        {formatCurrencyPrice(analysis.support2, currency)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#090C11] border border-rose-500/20 rounded-xl p-3 space-y-2">
                    <div className="text-[11px] font-semibold text-rose-400">
                      แนวต้าน (Resistance)
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-400">แนวต้าน 1 (R1)</span>
                      <span className="font-mono tabular-nums font-bold text-rose-300">
                        {formatCurrencyPrice(analysis.resistance1, currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-[#18202D]">
                      <span className="text-slate-400">แนวต้าน 2 (R2)</span>
                      <span className="font-mono tabular-nums font-semibold text-rose-400/90">
                        {formatCurrencyPrice(analysis.resistance2, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* BOX 3: เป้าหมายราคาตาม Fibonacci */}
              <section className="bg-[#10151E] border border-[#1E2634] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-slate-300">
                    📐 เป้าหมายราคาตาม Fibonacci
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                    L {formatCurrencyPrice(analysis.swingLow, currency)} – H{' '}
                    {formatCurrencyPrice(analysis.swingHigh, currency)}
                  </span>
                </div>

                {/* Retracement */}
                <div className="bg-[#090C11] border border-[#1B2331] rounded-xl p-3 space-y-2">
                  <div className="text-[11px] font-medium text-sky-300">
                    โซนแนวรับ / จุดย่อตัว (Retracement)
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-[#10151E] rounded-lg py-2 px-1.5 border border-[#1E2634]">
                      <div className="text-[10px] font-mono text-slate-400">Fib 38.2%</div>
                      <div className="font-mono tabular-nums text-xs font-bold text-slate-100 mt-0.5">
                        {formatCurrencyPrice(analysis.fibRetracement.fib382, currency)}
                      </div>
                    </div>
                    <div className="bg-[#10151E] rounded-lg py-2 px-1.5 border border-[#1E2634]">
                      <div className="text-[10px] font-mono text-slate-400">Fib 50.0%</div>
                      <div className="font-mono tabular-nums text-xs font-bold text-slate-100 mt-0.5">
                        {formatCurrencyPrice(analysis.fibRetracement.fib500, currency)}
                      </div>
                    </div>
                    <div className="bg-[#10151E] rounded-lg py-2 px-1.5 border border-amber-500/30">
                      <div className="text-[10px] font-mono text-amber-300">Fib 61.8%</div>
                      <div className="font-mono tabular-nums text-xs font-bold text-amber-200 mt-0.5">
                        {formatCurrencyPrice(analysis.fibRetracement.fib618, currency)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Extension Targets */}
                <div className="bg-[#090C11] border border-amber-500/20 rounded-xl p-3 space-y-2">
                  <div className="text-[11px] font-medium text-amber-300">
                    เป้าราคาที่ไปได้ถัดไป (Extension Targets)
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-[#10151E] rounded-lg px-3 py-2 border border-[#1E2634] flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-slate-400">Fib 127.2%</span>
                      <span className="font-mono tabular-nums text-xs font-bold text-amber-300">
                        {formatCurrencyPrice(analysis.fibExtension.fib1272, currency)}
                      </span>
                    </div>
                    <div className="bg-[#10151E] rounded-lg px-3 py-2 border border-[#1E2634] flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-slate-400">Fib 161.8%</span>
                      <span className="font-mono tabular-nums text-xs font-bold text-emerald-300">
                        {formatCurrencyPrice(analysis.fibExtension.fib1618, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* BOX 4: เทียบจุดคุ้มทุนของคุณ + % ห่างจากเป้า Fib ถัดไป */}
              <section className="bg-[#10151E] border border-[#1E2634] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-amber-400" />
                    <span>เทียบจุดคุ้มทุนของคุณ</span>
                  </h3>
                  {asset.portfolioId && onUpdateAssetCost && !editingCost && (
                    <button
                      type="button"
                      onClick={() => setEditingCost(true)}
                      className="text-[11px] text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>{asset.averageCost ? 'แก้ทุน' : 'ใส่ทุนเฉลี่ย'}</span>
                    </button>
                  )}
                </div>

                {editingCost && asset.portfolioId && onUpdateAssetCost ? (
                  <div className="bg-[#090C11] border border-[#253042] rounded-xl p-3 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          ทุนเฉลี่ย ({currency})
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={costInput}
                          onChange={(e) => setCostInput(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-[#10151E] border border-[#253042] rounded-lg px-2.5 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          จำนวนหน่วย
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={qtyInput}
                          onChange={(e) => setQtyInput(e.target.value)}
                          placeholder="0"
                          className="w-full bg-[#10151E] border border-[#253042] rounded-lg px-2.5 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingCost(false)}
                        className="px-3 min-h-[36px] text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveCost}
                        className="px-3.5 min-h-[36px] rounded-lg bg-amber-500 text-slate-950 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>บันทึกทุน</span>
                      </button>
                    </div>
                  </div>
                ) : asset.averageCost && analysis.breakevenDeltaPct !== null ? (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-[#090C11] border border-[#1B2331] rounded-lg p-2.5">
                      <div className="text-[10px] text-slate-400">ทุนเฉลี่ย</div>
                      <div className="font-mono tabular-nums text-xs font-bold text-slate-100 mt-0.5">
                        {formatCurrencyPrice(asset.averageCost, currency)}
                      </div>
                    </div>
                    <div className="bg-[#090C11] border border-[#1B2331] rounded-lg p-2.5">
                      <div className="text-[10px] text-slate-400">กำไร/ขาดทุน</div>
                      <div
                        className={`font-mono tabular-nums text-xs font-bold mt-0.5 ${
                          analysis.breakevenDeltaPct > 0
                            ? 'text-emerald-400'
                            : analysis.breakevenDeltaPct < 0
                            ? 'text-rose-400'
                            : 'text-slate-200'
                        }`}
                      >
                        {analysis.breakevenDeltaPct > 0 ? '+' : ''}
                        {analysis.breakevenDeltaPct.toFixed(2)}%
                      </div>
                    </div>
                    <div className="bg-[#090C11] border border-amber-500/25 rounded-lg p-2.5">
                      <div className="text-[10px] text-amber-300 truncate">
                        ห่างเป้า {analysis.nextFibTargetLabel}
                      </div>
                      <div className="font-mono tabular-nums text-xs font-bold text-amber-200 mt-0.5">
                        {analysis.distanceToNextFibPct > 0 ? '+' : ''}
                        {analysis.distanceToNextFibPct.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#090C11] border border-[#1B2331] rounded-lg px-3 py-2.5 flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-400">
                      ระยะห่างถึงเป้า {analysis.nextFibTargetLabel} (
                      {formatCurrencyPrice(analysis.nextFibTargetPrice, currency)})
                    </span>
                    <span className="font-mono tabular-nums font-bold text-amber-300 shrink-0">
                      {analysis.distanceToNextFibPct > 0 ? '+' : ''}
                      {analysis.distanceToNextFibPct.toFixed(1)}%
                    </span>
                  </div>
                )}
              </section>

              {/* On-Demand Concise AI Buy/Sell Plan (<= 3 lines, 4-hour cache) */}
              <section className="bg-[#10151E] border border-[#1E2634] rounded-xl p-4 space-y-3">
                <button
                  type="button"
                  onClick={() => void handleRunAiPlan(Boolean(aiAnalysis))}
                  disabled={isAnalyzingAi || quota.isCoolingDown || quota.dailyExhausted}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {isAnalyzingAi ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังสรุปแผนด้วย AI...</span>
                    </>
                  ) : quota.isCoolingDown ? (
                    <>
                      <Clock className="w-4 h-4" />
                      <span>พักโควตา AI ({quota.cooldownSecondsLeft}s)</span>
                    </>
                  ) : aiAnalysis ? (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>ขอสรุปแผนเข้าซื้อ-ขายใหม่ด้วย AI</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>✨ ขอสรุปแผนเข้าซื้อ-ขายสั้นๆ ด้วย AI</span>
                    </>
                  )}
                </button>

                {aiError && (
                  <div className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 leading-relaxed">
                    {aiError}
                  </div>
                )}

                {aiAnalysis && (
                  <div className="bg-[#090C11] border border-amber-500/25 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-semibold text-amber-300 inline-flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>แผนเข้าซื้อ-ขายสั้นๆ ({timeframe})</span>
                      </span>
                      {aiAnalysis.fromCache && (
                        <span className="inline-flex items-center gap-1 text-sky-300">
                          <Zap className="w-3 h-3" />
                          <span>แคช 4 ชม.</span>
                        </span>
                      )}
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-200 leading-relaxed">
                      {aiAnalysis.shortPlanLinesTh.slice(0, 3).map((line, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-amber-400 font-mono font-bold shrink-0">
                            {i + 1}.
                          </span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!aiAnalysis && !aiError && (
                  <p className="text-[11px] text-slate-500 text-center">
                    กดเมื่อต้องการเท่านั้น · แคชผลลัพธ์ 4 ชม. ประหยัดโควตา AI
                  </p>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
