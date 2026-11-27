import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BellRing,
  Calendar,
  Check,
  Download,
  LineChart,
  Loader2,
  Newspaper,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import {
  ASSET_CATALOG,
  CATEGORY_LABELS_TH,
  POPULAR_STARTER_TICKERS,
} from '../data/assetCatalog';
import {
  AssetCategory,
  CalendarEvent,
  CatalogAsset,
  ChartTargetAsset,
  LiveAssetQuote,
  NavTab,
  NewsItem,
  PortfolioAsset,
} from '../types';
import {
  formatThaiShortDate,
  getAlertsForAsset,
} from '../utils/portfolioMatcher';
import { classifyAssetLive } from '../services/geminiService';

function formatLivePrice(price: number, currency: string): string {
  const digits = Math.abs(price) >= 100 ? 2 : Math.abs(price) >= 1 ? 2 : 4;
  const num = price.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  if (currency === 'THB') return `฿${num}`;
  if (currency === 'USD') return `$${num}`;
  if (currency === 'EUR') return `€${num}`;
  if (currency === 'GBP') return `£${num}`;
  if (currency === 'JPY') return `¥${Math.round(price).toLocaleString('en-US')}`;
  return `${num} ${currency}`;
}

function formatSignedMoney(amount: number, currency: string): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}${formatLivePrice(Math.abs(amount), currency)}`;
}

function parsePositiveNumber(raw: string): number | undefined {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!cleaned) return undefined;
  const num = Number(cleaned);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

interface PortfolioViewProps {
  portfolio: PortfolioAsset[];
  calendarEvents: CalendarEvent[];
  newsItems: NewsItem[];
  liveQuotes: Record<string, LiveAssetQuote>;
  isSignedInLocal: boolean;
  accountLabel: string;
  onAddAsset: (asset: Omit<PortfolioAsset, 'id' | 'addedAt'>) => Promise<void> | void;
  onRemoveAsset: (id: string) => Promise<void> | void;
  onUpdateAssetCost: (id: string, averageCost?: number, quantity?: number) => void;
  onOpenChart: (asset: ChartTargetAsset) => void;
  onExportJson: () => void;
  onImportJsonFile: (file: File) => void;
  onOpenAuth: () => void;
  onNavigate: (tab: NavTab, options?: { onlyPortfolio?: boolean; searchQuery?: string }) => void;
}

const FILTER_CATEGORIES: Array<'ALL' | AssetCategory> = [
  'ALL',
  'US ETF',
  'Thai Stock',
  'US Stock',
  'Crypto',
  'Commodity',
  'Forex',
];

interface CurrencyPnlSummary {
  currency: string;
  totalCost: number;
  totalMarketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  fullPositionCount: number;
  costOnlyCount: number;
}

export function PortfolioView({
  portfolio,
  calendarEvents,
  newsItems,
  liveQuotes,
  isSignedInLocal,
  accountLabel,
  onAddAsset,
  onRemoveAsset,
  onUpdateAssetCost,
  onOpenChart,
  onExportJson,
  onImportJsonFile,
  onOpenAuth,
  onNavigate,
}: PortfolioViewProps) {
  const [query, setQuery] = useState('');
  const [addAvgCostInput, setAddAvgCostInput] = useState('');
  const [addQtyInput, setAddQtyInput] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [customCategory, setCustomCategory] = useState<AssetCategory>('US ETF');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'ALL' | AssetCategory>('ALL');
  const [classifyingTicker, setClassifyingTicker] = useState<string | null>(null);
  const [editingCostId, setEditingCostId] = useState<string | null>(null);
  const [editCostValue, setEditCostValue] = useState('');
  const [editQtyValue, setEditQtyValue] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const heldSymbolSet = useMemo(
    () => new Set(portfolio.map((p) => p.symbol.toUpperCase().replace(/\.BK$/, ''))),
    [portfolio]
  );

  const heldBySymbolMap = useMemo(() => {
    const map = new Map<string, PortfolioAsset>();
    for (const p of portfolio) {
      map.set(p.symbol.toUpperCase().replace(/\.BK$/, ''), p);
    }
    return map;
  }, [portfolio]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const suggestions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return ASSET_CATALOG.slice(0, 18);
    }

    const scored = ASSET_CATALOG.map((item) => {
      const sym = item.symbol.toLowerCase();
      const name = item.name.toLowerCase();
      const aliases = item.aliases?.map((a) => a.toLowerCase()) ?? [];
      const sector = item.sector.toLowerCase();
      const market = item.market.toLowerCase();
      const category = item.category.toLowerCase();

      let score = 0;
      if (sym === trimmed) score = 100;
      else if (aliases.some((a) => a === trimmed)) score = 95;
      else if (sym.startsWith(trimmed)) score = 85;
      else if (name.startsWith(trimmed) || aliases.some((a) => a.startsWith(trimmed))) score = 75;
      else if (sym.includes(trimmed)) score = 65;
      else if (name.includes(trimmed) || aliases.some((a) => a.includes(trimmed))) score = 55;
      else if (sector.includes(trimmed) || market.includes(trimmed) || category.includes(trimmed)) {
        score = 35;
      }

      return { item, score };
    })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.symbol.localeCompare(b.item.symbol));

    return scored.slice(0, 14).map((entry) => entry.item);
  }, [query]);

  const rawTrimmedQuery = query.trim();
  const upperTrimmedQuery = rawTrimmedQuery.toUpperCase();

  const exactCatalogMatch = useMemo(() => {
    if (!upperTrimmedQuery) return undefined;
    return ASSET_CATALOG.find(
      (a) =>
        a.symbol.toUpperCase() === upperTrimmedQuery ||
        a.aliases?.some((al) => al.toUpperCase() === upperTrimmedQuery)
    );
  }, [upperTrimmedQuery]);

  const isAlreadyHeld = (sym: string) =>
    heldSymbolSet.has(sym.toUpperCase().replace(/\.BK$/, ''));

  const showGlobalAiSearchRow =
    rawTrimmedQuery.length >= 1 &&
    (!exactCatalogMatch || suggestions.length === 0) &&
    !isAlreadyHeld(upperTrimmedQuery);

  const canQuickPreviewQueryChart =
    /^[A-Za-z0-9./-]{1,15}$/.test(rawTrimmedQuery) && rawTrimmedQuery.length >= 2;

  // Currency-grouped portfolio cost & unrealized P/L summary
  const portfolioPnlSummaries = useMemo<CurrencyPnlSummary[]>(() => {
    const byCurrency = new Map<
      string,
      {
        totalCost: number;
        totalMarketValue: number;
        fullPositionCount: number;
        costOnlyCount: number;
      }
    >();

    for (const asset of portfolio) {
      if (typeof asset.averageCost !== 'number' || asset.averageCost <= 0) continue;
      const quote = liveQuotes[asset.symbol.toUpperCase()];
      const currency = (quote?.currency || asset.currency || 'USD').toUpperCase();
      const entry = byCurrency.get(currency) ?? {
        totalCost: 0,
        totalMarketValue: 0,
        fullPositionCount: 0,
        costOnlyCount: 0,
      };

      const qty = typeof asset.quantity === 'number' && asset.quantity > 0 ? asset.quantity : 0;
      if (qty > 0 && quote && quote.price !== null) {
        entry.totalCost += asset.averageCost * qty;
        entry.totalMarketValue += quote.price * qty;
        entry.fullPositionCount += 1;
      } else {
        entry.costOnlyCount += 1;
      }

      byCurrency.set(currency, entry);
    }

    return Array.from(byCurrency.entries()).map(([currency, v]) => {
      const unrealizedPnl = v.totalMarketValue - v.totalCost;
      const unrealizedPnlPct = v.totalCost > 0 ? (unrealizedPnl / v.totalCost) * 100 : 0;
      return {
        currency,
        totalCost: v.totalCost,
        totalMarketValue: v.totalMarketValue,
        unrealizedPnl,
        unrealizedPnlPct,
        fullPositionCount: v.fullPositionCount,
        costOnlyCount: v.costOnlyCount,
      };
    });
  }, [portfolio, liveQuotes]);

  function triggerFeedback(type: 'success' | 'error', text: string) {
    setFeedbackMsg({ type, text });
    window.setTimeout(() => {
      setFeedbackMsg((prev) => (prev?.text === text ? null : prev));
    }, 5500);
  }

  function openChartForCatalogItem(item: CatalogAsset) {
    const held = heldBySymbolMap.get(item.symbol.toUpperCase().replace(/\.BK$/, ''));
    setDropdownOpen(false);
    onOpenChart({
      symbol: item.symbol,
      name: item.name,
      category: item.category,
      market: item.market,
      flag: item.flag,
      currency: item.currency,
      sector: item.sector,
      averageCost: held?.averageCost,
      quantity: held?.quantity,
      portfolioId: held?.id,
    });
  }

  function openChartForPortfolioAsset(asset: PortfolioAsset) {
    const quote = liveQuotes[asset.symbol.toUpperCase()];
    onOpenChart({
      symbol: asset.symbol,
      name: asset.name,
      category: asset.category,
      market: asset.market,
      flag: asset.flag,
      currency: quote?.currency || asset.currency,
      sector: asset.sector,
      averageCost: asset.averageCost,
      quantity: asset.quantity,
      portfolioId: asset.id,
    });
  }

  function openQuickChartForQuery() {
    if (!canQuickPreviewQueryChart) return;
    const cleanSym = upperTrimmedQuery;
    const held = heldBySymbolMap.get(cleanSym.replace(/\.BK$/, ''));
    setDropdownOpen(false);
    onOpenChart({
      symbol: cleanSym,
      name: held?.name || cleanSym,
      category: held?.category || (cleanSym.endsWith('.BK') ? 'Thai Stock' : customCategory),
      market:
        held?.market ||
        (customCategory === 'Thai Stock' || cleanSym.endsWith('.BK') ? 'SET' : 'Global'),
      flag: held?.flag || (customCategory === 'Thai Stock' ? '🇹🇭' : '🌐'),
      currency:
        held?.currency ||
        (customCategory === 'Thai Stock' || cleanSym.endsWith('.BK') ? 'THB' : 'USD'),
      sector: held?.sector,
      averageCost: held?.averageCost ?? parsePositiveNumber(addAvgCostInput),
      quantity: held?.quantity ?? parsePositiveNumber(addQtyInput),
      portfolioId: held?.id,
    });
  }

  async function handleSelectCatalogItem(item: CatalogAsset) {
    if (isAlreadyHeld(item.symbol)) {
      triggerFeedback('error', `${item.symbol} อยู่ในพอร์ตโฟลิโอของคุณแล้ว`);
      setDropdownOpen(false);
      return;
    }
    const averageCost = parsePositiveNumber(addAvgCostInput);
    const quantity = parsePositiveNumber(addQtyInput);
    try {
      await onAddAsset({
        symbol: item.symbol,
        name: item.name,
        category: item.category,
        market: item.market,
        flag: item.flag,
        currency: item.currency,
        sector: item.sector,
        themes: item.themes,
        topHoldings: item.topHoldings,
        hasDividends: item.hasDividends,
        hasEarnings: item.hasEarnings,
        averageCost,
        quantity,
      });
      setQuery('');
      setAddAvgCostInput('');
      setAddQtyInput('');
      setDropdownOpen(false);
      triggerFeedback(
        'success',
        `เพิ่ม ${item.symbol} (${item.name}) เข้าพอร์ตแล้ว${averageCost ? ` · บันทึกทุนเฉลี่ย ${formatLivePrice(averageCost, item.currency)}` : ''}`
      );
    } catch (err) {
      triggerFeedback(
        'error',
        err instanceof Error ? err.message : 'ไม่สามารถบันทึกสินทรัพย์ได้'
      );
    }
  }

  async function handleGlobalAiSearchAndAdd() {
    if (!rawTrimmedQuery) return;
    if (isAlreadyHeld(upperTrimmedQuery)) {
      triggerFeedback('error', `${upperTrimmedQuery} อยู่ในพอร์ตโฟลิโอของคุณแล้ว`);
      return;
    }

    const averageCost = parsePositiveNumber(addAvgCostInput);
    const quantity = parsePositiveNumber(addQtyInput);

    setClassifyingTicker(rawTrimmedQuery);
    setDropdownOpen(false);

    try {
      const classified = await classifyAssetLive(rawTrimmedQuery);
      const officialSymbol = classified.symbol.trim().toUpperCase();

      if (isAlreadyHeld(officialSymbol)) {
        triggerFeedback(
          'error',
          `${officialSymbol} (${classified.name}) อยู่ในพอร์ตโฟลิโอของคุณแล้ว`
        );
        return;
      }

      await onAddAsset({
        symbol: officialSymbol,
        name: classified.name || officialSymbol,
        category: classified.category || customCategory,
        market: classified.market || 'Global',
        flag: classified.flag || '🌐',
        currency: classified.currency || 'USD',
        sector: classified.sector || 'ทั่วไป (General)',
        themes: Array.isArray(classified.themes) ? classified.themes : [],
        topHoldings: Array.isArray(classified.topHoldings) ? classified.topHoldings : undefined,
        hasDividends:
          typeof classified.hasDividends === 'boolean' ? classified.hasDividends : undefined,
        hasEarnings:
          typeof classified.hasEarnings === 'boolean' ? classified.hasEarnings : undefined,
        averageCost,
        quantity,
      });
      setQuery('');
      setAddAvgCostInput('');
      setAddQtyInput('');
      triggerFeedback(
        'success',
        `พบและเพิ่ม ${officialSymbol} — ${classified.name} (${classified.market} · ${classified.sector}) เข้าพอร์ตเรียบร้อยแล้ว`
      );
    } catch (err) {
      triggerFeedback(
        'error',
        err instanceof Error
          ? err.message
          : `ไม่สามารถค้นหาข้อมูล "${rawTrimmedQuery}" จากตลาดทั่วโลกได้`
      );
    } finally {
      setClassifyingTicker(null);
    }
  }

  function startEditingCost(asset: PortfolioAsset) {
    setEditingCostId(asset.id);
    setEditCostValue(asset.averageCost !== undefined ? String(asset.averageCost) : '');
    setEditQtyValue(asset.quantity !== undefined ? String(asset.quantity) : '');
  }

  function handleSaveCostEdit(asset: PortfolioAsset) {
    const parsedCost = parsePositiveNumber(editCostValue);
    const parsedQty = parsePositiveNumber(editQtyValue);
    onUpdateAssetCost(asset.id, parsedCost, parsedQty);
    setEditingCostId(null);
    triggerFeedback(
      'success',
      parsedCost
        ? `อัปเดตทุนเฉลี่ย ${asset.symbol} เป็น ${formatLivePrice(parsedCost, asset.currency)}${parsedQty ? ` (${parsedQty.toLocaleString('en-US')} หน่วย)` : ''} แล้ว`
        : `ล้างข้อมูลราคาทุนเฉลี่ยของ ${asset.symbol} แล้ว`
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!dropdownOpen) {
      if (e.key === 'ArrowDown') setDropdownOpen(true);
      if (e.key === 'Enter' && rawTrimmedQuery) {
        e.preventDefault();
        if (exactCatalogMatch) {
          void handleSelectCatalogItem(exactCatalogMatch);
        } else {
          void handleGlobalAiSearchAndAdd();
        }
      }
      return;
    }
    const totalOptions = suggestions.length + (showGlobalAiSearchRow ? 1 : 0);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (totalOptions > 0 ? (prev + 1) % totalOptions : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) =>
        totalOptions > 0 ? (prev - 1 + totalOptions) % totalOptions : 0
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex < suggestions.length && suggestions[highlightIndex]) {
        void handleSelectCatalogItem(suggestions[highlightIndex]);
      } else if (showGlobalAiSearchRow) {
        void handleGlobalAiSearchAndAdd();
      }
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
  }

  function focusSearchInput() {
    inputRef.current?.focus();
    setDropdownOpen(true);
  }

  const filteredPortfolio = useMemo(() => {
    if (activeCategoryFilter === 'ALL') return portfolio;
    return portfolio.filter((p) => p.category === activeCategoryFilter);
  }, [portfolio, activeCategoryFilter]);

  return (
    <div className="space-y-6">
      {/* Add Asset Search Section */}
      <section className="bg-[#10151E] border border-[#1E2634] rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-100">
                เพิ่มสินทรัพย์เข้าพอร์ตโฟลิโอ &amp; ดูกราฟเทคนิค
              </h2>
              <span className="text-xs text-slate-400">
                · บัญชี: <span className="text-slate-200 font-medium">{accountLabel}</span>
              </span>
              {isSignedInLocal && (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                  <UserCheck className="w-3.5 h-3.5" />
                  บัญชีส่วนตัวในเครื่อง
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              คลังสินทรัพย์ยอดนิยม {ASSET_CATALOG.length}+ ตัว (PEP, KO, AAPL, MSFT, NVDA, QQQM, SMH, BLOK, GLD, SLV, KCG, PTT, CPALL, DELTA ฯลฯ) ค้นหาได้ทั้งชื่อบริษัท/ตัวย่อ กรอกราคาทุนเฉลี่ยเพื่อแสดงเส้นจุดคุ้มทุนและ P/L ในกราฟได้ทันที
            </p>
          </div>

          {/* Export / Import JSON Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onExportJson}
              disabled={portfolio.length === 0}
              className="px-3 py-1.5 rounded-lg bg-[#161E2B] border border-[#253042] hover:border-amber-500/50 disabled:opacity-45 disabled:cursor-not-allowed text-xs font-medium text-slate-200 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export JSON</span>
            </button>
            <label className="px-3 py-1.5 rounded-lg bg-[#161E2B] border border-[#253042] hover:border-sky-500/50 text-xs font-medium text-slate-200 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span>Import JSON</span>
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onImportJsonFile(file);
                    e.target.value = '';
                  }
                }}
              />
            </label>
          </div>
        </div>

        <div ref={searchContainerRef} className="relative">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                disabled={Boolean(classifyingTicker)}
                onFocus={() => {
                  setDropdownOpen(true);
                  setHighlightIndex(0);
                }}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setDropdownOpen(true);
                  setHighlightIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="พิมพ์ตัวย่อหรือชื่อบริษัท เช่น PEP, PepsiCo, QQQM, SMH, GLD, KCG, PTT, Nintendo, ASML..."
                className="w-full bg-[#090C11] border border-[#253042] rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/20 transition-all"
                aria-label="ค้นหาและเพิ่มสินทรัพย์"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value as AssetCategory)}
                aria-label="ประเภทสำรองกรณีไม่ระบุหมวดอัตโนมัติ"
                className="bg-[#090C11] border border-[#253042] rounded-lg px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/70 cursor-pointer"
              >
                <option value="US ETF">US ETF</option>
                <option value="Thai Stock">หุ้นไทย (SET/mai)</option>
                <option value="US Stock">หุ้นสหรัฐฯ/โลก</option>
                <option value="Crypto">คริปโต</option>
                <option value="Commodity">โภคภัณฑ์</option>
                <option value="Forex">ค่าเงิน (FX)</option>
              </select>

              <button
                type="button"
                disabled={Boolean(classifyingTicker)}
                onClick={() => {
                  if (exactCatalogMatch) {
                    void handleSelectCatalogItem(exactCatalogMatch);
                  } else if (rawTrimmedQuery) {
                    void handleGlobalAiSearchAndAdd();
                  } else {
                    focusSearchInput();
                  }
                }}
                className="px-4 py-2.5 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-70 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {classifyingTicker ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังค้นหาทั่วโลก...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>เพิ่มสินทรัพย์</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Optional Average Cost & Quantity inputs before adding */}
          <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            <div className="flex items-center gap-2 bg-[#090C11] border border-[#1E2634] rounded-lg px-3 py-1.5">
              <label
                htmlFor="add-avg-cost"
                className="text-[11px] text-slate-400 whitespace-nowrap shrink-0"
              >
                ทุนเฉลี่ย (ไม่บังคับ)
              </label>
              <input
                id="add-avg-cost"
                type="number"
                min="0"
                step="any"
                value={addAvgCostInput}
                onChange={(e) => setAddAvgCostInput(e.target.value)}
                placeholder="เช่น 152.50 หรือ 8.60"
                className="w-full bg-transparent text-xs font-mono tabular-nums text-slate-100 placeholder:text-slate-600 focus:outline-none text-right"
              />
            </div>

            <div className="flex items-center gap-2 bg-[#090C11] border border-[#1E2634] rounded-lg px-3 py-1.5">
              <label
                htmlFor="add-qty"
                className="text-[11px] text-slate-400 whitespace-nowrap shrink-0"
              >
                จำนวนหน่วย (ไม่บังคับ)
              </label>
              <input
                id="add-qty"
                type="number"
                min="0"
                step="any"
                value={addQtyInput}
                onChange={(e) => setAddQtyInput(e.target.value)}
                placeholder="เช่น 10 หรือ 500"
                className="w-full bg-transparent text-xs font-mono tabular-nums text-slate-100 placeholder:text-slate-600 focus:outline-none text-right"
              />
            </div>

            <div className="hidden lg:flex items-center text-[11px] text-slate-500 px-1">
              กรอกไว้เพื่อคำนวณกำไร/ขาดทุนรวม และวาดเส้นจุดคุ้มทุนบนกราฟเทคนิคอัตโนมัติ
            </div>
          </div>

          {/* Autocomplete Dropdown */}
          {dropdownOpen && (
            <div className="absolute z-40 left-0 right-0 mt-2 bg-[#121823] border border-[#2A364B] rounded-xl shadow-2xl overflow-hidden max-h-96 overflow-y-auto">
              <div className="px-3.5 py-2 bg-[#0D121A] border-b border-[#1E2634] flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  {rawTrimmedQuery
                    ? `ผลการค้นหา "${rawTrimmedQuery}" (${suggestions.length} รายการในคลัง)`
                    : `สินทรัพย์ยอดนิยม (${ASSET_CATALOG.length}+ รายการทั่วโลก)`}
                </span>
                <span>กด ดูกราฟ หรือ Enter เพื่อเพิ่ม</span>
              </div>

              {suggestions.map((item, idx) => {
                const alreadyHeld = isAlreadyHeld(item.symbol);
                const isHighlighted = idx === highlightIndex;
                return (
                  <div
                    key={item.symbol}
                    role="option"
                    aria-selected={isHighlighted}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors border-b border-[#1A2230]/60 last:border-b-0 ${
                      isHighlighted ? 'bg-[#1A2434]' : 'hover:bg-[#161E2C]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void handleSelectCatalogItem(item)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <span className="text-base shrink-0">{item.flag}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-slate-100">
                            {item.symbol}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {item.market}
                          </span>
                          <span className="text-[11px] text-amber-300/90">
                            {CATEGORY_LABELS_TH[item.category]}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {item.name} · {item.sector}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openChartForCatalogItem(item);
                        }}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#101621] border border-[#273449] text-sky-300 hover:border-sky-500/60 hover:bg-sky-500/10 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors"
                      >
                        <LineChart className="w-3 h-3" />
                        <span>ดูกราฟ</span>
                      </button>

                      {alreadyHeld ? (
                        <span className="text-[11px] text-emerald-400 font-medium px-1.5">
                          มีในพอร์ตแล้ว
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleSelectCatalogItem(item)}
                          className="text-xs text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-0.5 px-1.5 py-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>เพิ่ม</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {showGlobalAiSearchRow && (
                <div
                  onMouseEnter={() => setHighlightIndex(suggestions.length)}
                  className={`w-full px-3.5 py-3 flex items-center justify-between gap-3 bg-amber-500/12 border-t border-amber-500/25 transition-colors ${
                    highlightIndex === suggestions.length ? 'bg-amber-500/20' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void handleGlobalAiSearchAndAdd()}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-semibold text-amber-200">
                        ค้นหาและเพิ่ม &quot;{rawTrimmedQuery}&quot; จากตลาดทั่วโลก (Yahoo + AI)
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        ค้นหาผ่าน Yahoo Finance Autocomplete ฟรี แล้วเสริมข้อมูลกลุ่มอุตสาหกรรมและเพิ่มเข้าพอร์ตอัตโนมัติ
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    {canQuickPreviewQueryChart && (
                      <button
                        type="button"
                        onClick={openQuickChartForQuery}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#101621] border border-[#273449] text-sky-300 hover:border-sky-500/60 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <LineChart className="w-3 h-3" />
                        <span>ดูกราฟ</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleGlobalAiSearchAndAdd()}
                      className="text-xs font-semibold text-amber-300 hover:text-amber-200 whitespace-nowrap cursor-pointer"
                    >
                      ค้นหา &amp; เพิ่ม
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Direct Inline AI Search CTA when query has no catalog matches and dropdown is closed */}
          {!dropdownOpen && showGlobalAiSearchRow && suggestions.length === 0 && !classifyingTicker && (
            <div className="mt-2.5 px-3.5 py-2.5 rounded-lg bg-amber-500/12 border border-amber-500/35 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => void handleGlobalAiSearchAndAdd()}
                className="text-xs sm:text-sm font-medium text-amber-200 hover:text-amber-100 text-left flex-1 min-w-0 cursor-pointer"
              >
                ค้นหาและเพิ่ม &quot;{rawTrimmedQuery}&quot; จากตลาดทั่วโลก (Yahoo Finance + AI)
              </button>
              <div className="flex items-center gap-2 shrink-0">
                {canQuickPreviewQueryChart && (
                  <button
                    type="button"
                    onClick={openQuickChartForQuery}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#101621] border border-[#273449] text-sky-300 hover:border-sky-500/60 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                  >
                    <LineChart className="w-3.5 h-3.5" />
                    <span>ดูกราฟ</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleGlobalAiSearchAndAdd()}
                  className="text-xs font-semibold text-amber-300 hover:text-amber-200 whitespace-nowrap cursor-pointer"
                >
                  ค้นหา &amp; เพิ่ม
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick-add popular tickers */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">เพิ่มด่วนยอดนิยม:</span>
          {POPULAR_STARTER_TICKERS.map((sym) => {
            const catItem = ASSET_CATALOG.find((c) => c.symbol === sym);
            if (!catItem) return null;
            const held = isAlreadyHeld(sym);
            return (
              <button
                key={sym}
                type="button"
                disabled={held}
                onClick={() => void handleSelectCatalogItem(catItem)}
                className={`font-mono text-[11px] px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                  held
                    ? 'bg-[#0D121A] border-[#1A2230] text-slate-600 cursor-not-allowed'
                    : 'bg-[#141C28] border-[#253042] text-slate-300 hover:border-amber-500/60 hover:text-amber-200 cursor-pointer'
                }`}
              >
                {held ? `✓ ${sym}` : `+ ${sym}`}
              </button>
            );
          })}
        </div>

        {feedbackMsg && (
          <div
            className={`mt-3 text-xs rounded-lg px-3.5 py-2 border ${
              feedbackMsg.type === 'success'
                ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                : 'text-rose-300 bg-rose-500/10 border-rose-500/30'
            }`}
          >
            {feedbackMsg.text}
          </div>
        )}
      </section>

      {/* Currency-Grouped Portfolio Cost & Unrealized P/L Summary Strip */}
      {portfolioPnlSummaries.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {portfolioPnlSummaries.map((summary) => {
            const hasFullPositions = summary.fullPositionCount > 0 && summary.totalCost > 0;
            const isProfit = summary.unrealizedPnl > 0;
            const isLoss = summary.unrealizedPnl < 0;

            return (
              <div
                key={summary.currency}
                className="bg-[#10151E] border border-[#1E2634] rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-300">
                      สรุปต้นทุน &amp; กำไร/ขาดทุนพอร์ต ({summary.currency})
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-500">
                      {summary.fullPositionCount + summary.costOnlyCount} สินทรัพย์ที่บันทึกทุน
                    </span>
                  </div>

                  {hasFullPositions ? (
                    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-xs">
                      <div>
                        <span className="text-slate-500 mr-1.5">ต้นทุนรวม</span>
                        <span className="font-mono tabular-nums text-slate-200 font-semibold">
                          {formatLivePrice(summary.totalCost, summary.currency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 mr-1.5">มูลค่าตลาด</span>
                        <span className="font-mono tabular-nums text-slate-100 font-semibold">
                          {formatLivePrice(summary.totalMarketValue, summary.currency)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      บันทึกทุนเฉลี่ยแล้ว — ระบุจำนวนหน่วยและอัปเดตราคาสดเพื่อคำนวณมูลค่ารวม
                    </p>
                  )}
                </div>

                {hasFullPositions && (
                  <div className="sm:text-right shrink-0">
                    <div className="text-[11px] text-slate-500">กำไร/ขาดทุนยังไม่รับรู้</div>
                    <div
                      className={`font-mono tabular-nums text-base font-bold inline-flex items-center gap-1.5 ${
                        isProfit
                          ? 'text-emerald-400'
                          : isLoss
                          ? 'text-rose-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {isProfit ? (
                        <TrendingUp className="w-4 h-4 shrink-0" />
                      ) : isLoss ? (
                        <TrendingDown className="w-4 h-4 shrink-0" />
                      ) : null}
                      <span>{formatSignedMoney(summary.unrealizedPnl, summary.currency)}</span>
                      <span className="text-xs font-semibold">
                        ({summary.unrealizedPnlPct > 0 ? '+' : ''}
                        {summary.unrealizedPnlPct.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Portfolio List & Live Alerts */}
      <section className="bg-[#10151E] border border-[#1E2634] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1E2634] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              สินทรัพย์ที่ถือครองจริง ({portfolio.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              ระบบวิเคราะห์ความเชื่อมโยงทางตรง/ทางอ้อมกับปฏิทินเศรษฐกิจ ข่าวโลก ราคาทุนเฉลี่ย และกราฟเทคนิค Elliott Wave ตามพอร์ตจริงนี้
            </p>
          </div>

          {portfolio.length > 0 && (
            <div className="flex items-center gap-1 p-1 bg-[#090C11] border border-[#1E2634] rounded-lg overflow-x-auto">
              {FILTER_CATEGORIES.map((cat) => {
                const active = activeCategoryFilter === cat;
                const label = cat === 'ALL' ? 'ทั้งหมด' : CATEGORY_LABELS_TH[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategoryFilter(cat)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#1C2536] text-amber-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {portfolio.length === 0 ? (
          /* Clean 100% Empty State */
          <div className="py-14 px-6 text-center max-w-xl mx-auto space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/12 border border-amber-500/30 flex items-center justify-center mx-auto">
              <Plus className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                พอร์ตโฟลิโอของคุณยังว่างอยู่
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
                เริ่มต้นเพิ่มสินทรัพย์จริงที่คุณถือครอง เช่น QQQM, SMH, GLD, SLV, BLOK, PEP หรือหุ้นไทยอย่าง KCG, PTT เพื่อเปิดระบบ Smart Portfolio Alert การคำนวณจุดคุ้มทุน และกราฟเทคนิค Elliott Wave
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={focusSearchInput}
                className="px-4 py-2.5 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ เพิ่มสินทรัพย์ในพอร์ต</span>
              </button>
              {!isSignedInLocal && (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="px-4 py-2.5 text-xs font-medium rounded-lg bg-[#161E2B] border border-[#253042] text-slate-200 hover:border-amber-500/50 transition-colors cursor-pointer"
                >
                  เข้าสู่ระบบ / สมัครสมาชิก (แยกพอร์ตตามบัญชี)
                </button>
              )}
            </div>
          </div>
        ) : filteredPortfolio.length === 0 ? (
          <div className="py-10 px-6 text-center text-sm text-slate-400">
            ไม่พบสินทรัพย์ในหมวดหมู่ที่เลือก
          </div>
        ) : (
          <div className="divide-y divide-[#1A2230]">
            {filteredPortfolio.map((asset) => {
              const alert = getAlertsForAsset(asset, calendarEvents, newsItems);
              const quote = liveQuotes[asset.symbol.toUpperCase()];
              const currency = quote?.currency || asset.currency;
              const totalCalCount =
                alert.earningsCount +
                alert.dividendCount +
                alert.economicDirectCount +
                alert.economicIndirectCount;

              const hasCost = typeof asset.averageCost === 'number' && asset.averageCost > 0;
              const hasQty = typeof asset.quantity === 'number' && asset.quantity > 0;
              const livePrice = quote?.price ?? null;
              const pnlPct =
                hasCost && livePrice !== null
                  ? ((livePrice - asset.averageCost!) / asset.averageCost!) * 100
                  : null;
              const marketValue =
                hasQty && livePrice !== null ? livePrice * asset.quantity! : null;
              const totalCost = hasCost && hasQty ? asset.averageCost! * asset.quantity! : null;
              const unrealizedDelta =
                marketValue !== null && totalCost !== null ? marketValue - totalCost : null;
              const isEditingThis = editingCostId === asset.id;

              return (
                <div
                  key={asset.id}
                  className="px-5 py-4 hover:bg-[#141B27] transition-colors space-y-3"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    {/* Asset Identity */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-[#161E2B] border border-[#243043] flex items-center justify-center text-lg shrink-0">
                        {asset.flag}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-base font-semibold text-slate-100">
                            {asset.symbol}
                          </span>
                          {quote && quote.price !== null && (
                            <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-xs font-semibold text-slate-100 bg-[#161E2B] border border-[#273347] px-2 py-0.5 rounded whitespace-nowrap">
                              <span>{formatLivePrice(quote.price, currency)}</span>
                              {quote.changePercent !== null && (
                                <span
                                  className={
                                    quote.changePercent > 0
                                      ? 'text-emerald-400'
                                      : quote.changePercent < 0
                                      ? 'text-rose-400'
                                      : 'text-slate-400'
                                  }
                                >
                                  {quote.changePercent > 0 ? '+' : ''}
                                  {quote.changePercent.toFixed(2)}%
                                </span>
                              )}
                            </span>
                          )}
                          {quote?.dividendYield && (
                            <span className="inline-flex items-center font-mono tabular-nums text-[11px] font-medium text-amber-300 bg-amber-500/12 border border-amber-500/30 px-2 py-0.5 rounded whitespace-nowrap">
                              Yield {quote.dividendYield}
                            </span>
                          )}
                          <span className="text-xs text-slate-400">
                            {CATEGORY_LABELS_TH[asset.category]}
                            <span className="mx-1.5 text-slate-600" aria-hidden="true">·</span>
                            {asset.market}
                          </span>
                          {alert.earningsCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300 bg-sky-500/15 border border-sky-500/35 px-2 py-0.5 rounded whitespace-nowrap">
                              <BellRing className="w-3 h-3" />
                              ใกล้ประกาศงบ
                            </span>
                          )}
                          {alert.dividendCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/35 px-2 py-0.5 rounded whitespace-nowrap">
                              <BellRing className="w-3 h-3" />
                              ใกล้ขึ้น XD ปันผล
                            </span>
                          )}
                          {alert.economicDirectCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300 bg-amber-500/15 border border-amber-500/35 px-2 py-0.5 rounded whitespace-nowrap">
                              กระทบทางตรง {alert.economicDirectCount}
                            </span>
                          )}
                          {alert.economicIndirectCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-300 bg-sky-500/12 border border-sky-500/30 px-2 py-0.5 rounded whitespace-nowrap">
                              ทางอ้อม {alert.economicIndirectCount}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-300 mt-0.5 truncate">
                          {asset.name}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          กลุ่มอุตสาหกรรม: {asset.sector}
                        </div>

                        {/* Breakeven Cost & Unrealized P/L Strip on Card */}
                        {hasCost && (
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs bg-[#0C1119] border border-[#1E2634] rounded-lg px-3 py-1.5">
                            <span className="text-slate-400">
                              ทุนเฉลี่ย:{' '}
                              <span className="font-mono tabular-nums font-semibold text-amber-300">
                                {formatLivePrice(asset.averageCost!, currency)}
                              </span>
                            </span>

                            {hasQty && (
                              <span className="text-slate-400">
                                จำนวน:{' '}
                                <span className="font-mono tabular-nums text-slate-200 font-medium">
                                  {asset.quantity!.toLocaleString('en-US')} หน่วย
                                </span>
                              </span>
                            )}

                            {marketValue !== null && (
                              <span className="text-slate-400">
                                มูลค่าตลาด:{' '}
                                <span className="font-mono tabular-nums text-slate-100 font-medium">
                                  {formatLivePrice(marketValue, currency)}
                                </span>
                              </span>
                            )}

                            {pnlPct !== null ? (
                              <span
                                className={`font-mono tabular-nums font-semibold inline-flex items-center gap-1 ${
                                  pnlPct > 0
                                    ? 'text-emerald-400'
                                    : pnlPct < 0
                                    ? 'text-rose-400'
                                    : 'text-slate-300'
                                }`}
                              >
                                <span>
                                  P/L: {pnlPct > 0 ? '+' : ''}
                                  {pnlPct.toFixed(2)}%
                                </span>
                                {unrealizedDelta !== null && (
                                  <span>({formatSignedMoney(unrealizedDelta, currency)})</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-500">
                                รอราคาสดเพื่อคำนวณ P/L
                              </span>
                            )}
                          </div>
                        )}

                        {alert.nextEventTitle && (
                          <div className="text-xs text-amber-200/90 mt-1.5 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate">
                              ใกล้สุด ({alert.nextEventDate ? formatThaiShortDate(alert.nextEventDate) : ''}): {alert.nextEventTitle}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end shrink-0">
                      <button
                        type="button"
                        onClick={() => openChartForPortfolioAsset(asset)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-200 bg-sky-500/12 border border-sky-500/35 hover:bg-sky-500/20 hover:border-sky-400/60 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <LineChart className="w-3.5 h-3.5 text-sky-400" />
                        <span>ดูกราฟ &amp; วิเคราะห์เทคนิค</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          isEditingThis ? setEditingCostId(null) : startEditingCost(asset)
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-colors whitespace-nowrap cursor-pointer ${
                          isEditingThis
                            ? 'text-amber-200 bg-amber-500/15 border-amber-500/40'
                            : 'text-slate-300 bg-[#161E2B] border-[#243043] hover:border-amber-500/50 hover:text-amber-200'
                        }`}
                      >
                        <Pencil className="w-3 h-3 text-amber-400" />
                        <span>{hasCost ? 'แก้ไขทุน' : 'ใส่ทุนเฉลี่ย'}</span>
                      </button>

                      {totalCalCount > 0 && (
                        <button
                          type="button"
                          onClick={() => onNavigate('calendar', { onlyPortfolio: true })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-300 bg-[#161E2B] border border-[#243043] hover:border-amber-500/50 hover:text-amber-200 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5 text-amber-400" />
                          <span>ปฏิทิน ({totalCalCount})</span>
                        </button>
                      )}
                      {alert.newsCount > 0 && (
                        <button
                          type="button"
                          onClick={() => onNavigate('news', { onlyPortfolio: true })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-300 bg-[#161E2B] border border-[#243043] hover:border-sky-500/50 hover:text-sky-200 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Newspaper className="w-3.5 h-3.5 text-sky-400" />
                          <span>ข่าว ({alert.newsCount})</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void onRemoveAsset(asset.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        aria-label={`ลบ ${asset.symbol} ออกจากพอร์ต`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ลบ</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Average Cost & Quantity Editor */}
                  {isEditingThis && (
                    <div className="bg-[#0B1018] border border-[#253042] rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-2.5">
                      <div className="flex items-center gap-2 flex-1">
                        <label className="text-[11px] text-slate-400 whitespace-nowrap">
                          ราคาทุนเฉลี่ย ({currency})
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={editCostValue}
                          onChange={(e) => setEditCostValue(e.target.value)}
                          placeholder="เช่น 152.50"
                          className="w-full sm:w-36 bg-[#090C11] border border-[#253042] rounded-md px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-100 focus:outline-none focus:border-amber-500/70"
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <label className="text-[11px] text-slate-400 whitespace-nowrap">
                          จำนวนหน่วย
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={editQtyValue}
                          onChange={(e) => setEditQtyValue(e.target.value)}
                          placeholder="เช่น 10"
                          className="w-full sm:w-32 bg-[#090C11] border border-[#253042] rounded-md px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-100 focus:outline-none focus:border-amber-500/70"
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSaveCostEdit(asset)}
                          className="px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>บันทึกทุน</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCostId(null)}
                          className="px-2.5 py-1.5 rounded-md text-xs text-slate-400 hover:text-slate-200 bg-[#141C28] border border-[#253042] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>ยกเลิก</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

