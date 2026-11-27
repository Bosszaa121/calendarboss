import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Newspaper,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
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
import { formatThaiShortDate, getAlertsForAsset } from '../utils/portfolioMatcher';
import { formatCurrencyPrice } from '../utils/technicalAnalysis';
import { classifyAssetLive } from '../services/geminiService';

function formatSignedMoney(amount: number, currency: string): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}${formatCurrencyPrice(Math.abs(amount), currency)}`;
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
  onOpenTrendSheet: (asset: ChartTargetAsset) => void;
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
  onOpenTrendSheet,
  onOpenAuth,
  onNavigate,
}: PortfolioViewProps) {
  const [query, setQuery] = useState('');
  const [showCostInputs, setShowCostInputs] = useState(false);
  const [addAvgCostInput, setAddAvgCostInput] = useState('');
  const [addQtyInput, setAddQtyInput] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [customCategory, setCustomCategory] = useState<AssetCategory>('US ETF');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'ALL' | AssetCategory>('ALL');
  const [classifyingTicker, setClassifyingTicker] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
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
    if (!trimmed) return ASSET_CATALOG.slice(0, 14);

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

    return scored.slice(0, 12).map((entry) => entry.item);
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

  const canQuickPreviewQuery =
    /^[A-Za-z0-9.:/-]{1,15}$/.test(rawTrimmedQuery) && rawTrimmedQuery.length >= 2;

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
    }, 5000);
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function openTrendForCatalogItem(item: CatalogAsset) {
    const held = heldBySymbolMap.get(item.symbol.toUpperCase().replace(/\.BK$/, ''));
    setDropdownOpen(false);
    onOpenTrendSheet({
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

  function openTrendForPortfolioAsset(asset: PortfolioAsset) {
    const quote = liveQuotes[asset.symbol.toUpperCase()];
    onOpenTrendSheet({
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

  function openQuickTrendForQuery() {
    if (!canQuickPreviewQuery) return;
    const cleanSym = upperTrimmedQuery;
    const held = heldBySymbolMap.get(cleanSym.replace(/\.BK$/, ''));
    setDropdownOpen(false);
    onOpenTrendSheet({
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
      triggerFeedback('error', `${item.symbol} อยู่ในพอร์ตของคุณแล้ว`);
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
      triggerFeedback('success', `เพิ่ม ${item.symbol} เข้าพอร์ตแล้ว`);
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
      triggerFeedback('error', `${upperTrimmedQuery} อยู่ในพอร์ตของคุณแล้ว`);
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
        triggerFeedback('error', `${officialSymbol} อยู่ในพอร์ตของคุณแล้ว`);
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
      triggerFeedback('success', `พบและเพิ่ม ${officialSymbol} (${classified.name}) แล้ว`);
    } catch (err) {
      triggerFeedback(
        'error',
        err instanceof Error
          ? err.message
          : `ไม่สามารถค้นหาข้อมูล "${rawTrimmedQuery}" ได้`
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
        ? `อัปเดตทุนเฉลี่ย ${asset.symbol} เรียบร้อยแล้ว`
        : `ล้างทุนเฉลี่ยของ ${asset.symbol} แล้ว`
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

  const filteredPortfolio = useMemo(() => {
    if (activeCategoryFilter === 'ALL') return portfolio;
    return portfolio.filter((p) => p.category === activeCategoryFilter);
  }, [portfolio, activeCategoryFilter]);

  return (
    <div className="space-y-3">
      {/* Add Asset Search Box (Clean Mobile-First, Export/Import moved to Account modal) */}
      <section className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-100">
            เพิ่มสินทรัพย์ &amp; วิเคราะห์เทรน
          </h2>
          <span className="text-[11px] text-slate-400 truncate">
            {accountLabel}
          </span>
        </div>

        <div ref={searchContainerRef} className="relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                placeholder="ค้นหาหุ้น/ETF เช่น QQQM, PEP, KCG, PTT..."
                className="w-full min-h-[44px] bg-[#090C11] border border-[#253042] rounded-xl pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70"
                aria-label="ค้นหาและเพิ่มสินทรัพย์"
              />
            </div>

            <button
              type="button"
              disabled={Boolean(classifyingTicker)}
              onClick={() => {
                if (exactCatalogMatch) {
                  void handleSelectCatalogItem(exactCatalogMatch);
                } else if (rawTrimmedQuery) {
                  void handleGlobalAiSearchAndAdd();
                } else {
                  inputRef.current?.focus();
                  setDropdownOpen(true);
                }
              }}
              className="min-h-[44px] px-3.5 text-xs font-bold rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-70 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {classifyingTicker ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>เพิ่ม</span>
            </button>
          </div>

          {/* Toggle Optional Avg Cost / Qty inputs */}
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => setShowCostInputs((v) => !v)}
              className="text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              <span>{showCostInputs ? 'ซ่อนช่องกรอกต้นทุน' : '+ ใส่ราคาทุนเฉลี่ย (ไม่บังคับ)'}</span>
              {showCostInputs ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            <select
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value as AssetCategory)}
              aria-label="หมวดหมู่สำรอง"
              className="bg-[#090C11] border border-[#222C3D] rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="US ETF">US ETF</option>
              <option value="Thai Stock">หุ้นไทย</option>
              <option value="US Stock">หุ้นสหรัฐฯ</option>
              <option value="Crypto">คริปโต</option>
              <option value="Commodity">โภคภัณฑ์</option>
              <option value="Forex">ค่าเงิน</option>
            </select>
          </div>

          {showCostInputs && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                type="number"
                min="0"
                step="any"
                value={addAvgCostInput}
                onChange={(e) => setAddAvgCostInput(e.target.value)}
                placeholder="ทุนเฉลี่ย เช่น 152.5"
                className="min-h-[40px] bg-[#090C11] border border-[#222C3D] rounded-xl px-3 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
              />
              <input
                type="number"
                min="0"
                step="any"
                value={addQtyInput}
                onChange={(e) => setAddQtyInput(e.target.value)}
                placeholder="จำนวนหน่วย เช่น 10"
                className="min-h-[40px] bg-[#090C11] border border-[#222C3D] rounded-xl px-3 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {/* Autocomplete Dropdown */}
          {dropdownOpen && (
            <div className="absolute z-40 left-0 right-0 mt-2 bg-[#121823] border border-[#2A364B] rounded-2xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto">
              {suggestions.map((item, idx) => {
                const alreadyHeld = isAlreadyHeld(item.symbol);
                return (
                  <div
                    key={item.symbol}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    className={`px-3.5 py-2.5 flex items-center justify-between gap-2 border-b border-[#1A2230]/70 last:border-b-0 ${
                      idx === highlightIndex ? 'bg-[#1A2434]' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void handleSelectCatalogItem(item)}
                      className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <span className="text-base shrink-0">{item.flag}</span>
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-bold text-slate-100">
                          {item.symbol}{' '}
                          <span className="font-sans font-normal text-[11px] text-slate-400">
                            · {item.market}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{item.name}</div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openTrendForCatalogItem(item);
                        }}
                        className="px-2 py-1.5 rounded-lg text-[11px] font-medium bg-[#0D121A] border border-amber-500/35 text-amber-300 whitespace-nowrap cursor-pointer"
                      >
                        🎯 เทรน &amp; Fib
                      </button>
                      {alreadyHeld ? (
                        <span className="text-[11px] text-emerald-400 font-medium px-1">
                          มีแล้ว
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleSelectCatalogItem(item)}
                          className="px-2 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-[11px] font-bold cursor-pointer"
                        >
                          + เพิ่ม
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {showGlobalAiSearchRow && (
                <div className="px-3.5 py-3 bg-amber-500/12 border-t border-amber-500/25 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => void handleGlobalAiSearchAndAdd()}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs font-semibold text-amber-200 truncate">
                      ค้นหา &quot;{rawTrimmedQuery}&quot; ทั่วโลก
                    </span>
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {canQuickPreviewQuery && (
                      <button
                        type="button"
                        onClick={openQuickTrendForQuery}
                        className="px-2 py-1 rounded-lg bg-[#0D121A] border border-amber-500/35 text-[11px] text-amber-300 cursor-pointer"
                      >
                        🎯 เทรน &amp; Fib
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleGlobalAiSearchAndAdd()}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 text-[11px] font-bold cursor-pointer"
                    >
                      เพิ่ม
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Single-Row Horizontal Quick-Add Tickers */}
        <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap no-scrollbar pt-0.5">
          <span className="text-[11px] text-slate-500 shrink-0">เพิ่มด่วน:</span>
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
                className={`font-mono text-[11px] px-2.5 py-1.5 rounded-lg border shrink-0 transition-colors ${
                  held
                    ? 'bg-[#090C11] border-[#1A2230] text-slate-600 cursor-not-allowed'
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
            className={`text-xs rounded-xl px-3 py-2 border ${
              feedbackMsg.type === 'success'
                ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                : 'text-rose-300 bg-rose-500/10 border-rose-500/30'
            }`}
          >
            {feedbackMsg.text}
          </div>
        )}
      </section>

      {/* Currency-Grouped Portfolio P/L Summary */}
      {portfolioPnlSummaries.length > 0 && (
        <section className="grid grid-cols-1 gap-2.5">
          {portfolioPnlSummaries.map((summary) => {
            const hasFull = summary.fullPositionCount > 0 && summary.totalCost > 0;
            const isProfit = summary.unrealizedPnl > 0;
            const isLoss = summary.unrealizedPnl < 0;
            return (
              <div
                key={summary.currency}
                className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-4 flex items-center justify-between gap-3"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs font-semibold text-slate-300">
                    พอร์ตสกุล {summary.currency}
                  </div>
                  {hasFull ? (
                    <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                      ทุน {formatCurrencyPrice(summary.totalCost, summary.currency)} → ตลาด{' '}
                      <span className="text-slate-100 font-semibold">
                        {formatCurrencyPrice(summary.totalMarketValue, summary.currency)}
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500">
                      บันทึกทุนแล้ว {summary.costOnlyCount} รายการ
                    </div>
                  )}
                </div>

                {hasFull && (
                  <div
                    className={`text-right font-mono tabular-nums shrink-0 ${
                      isProfit ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-slate-300'
                    }`}
                  >
                    <div className="text-sm font-bold inline-flex items-center gap-1">
                      {isProfit ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : isLoss ? (
                        <TrendingDown className="w-3.5 h-3.5" />
                      ) : null}
                      <span>{formatSignedMoney(summary.unrealizedPnl, summary.currency)}</span>
                    </div>
                    <div className="text-[11px] font-semibold">
                      ({summary.unrealizedPnlPct > 0 ? '+' : ''}
                      {summary.unrealizedPnlPct.toFixed(2)}%)
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Single-Row Horizontal Scrollable Category Filter Tabs */}
      {portfolio.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap no-scrollbar py-0.5">
          {FILTER_CATEGORIES.map((cat) => {
            const active = activeCategoryFilter === cat;
            const label = cat === 'ALL' ? `ทั้งหมด (${portfolio.length})` : CATEGORY_LABELS_TH[cat];
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategoryFilter(cat)}
                className={`px-3.5 min-h-[38px] text-xs font-medium rounded-xl border transition-colors shrink-0 cursor-pointer ${
                  active
                    ? 'bg-amber-500 text-slate-950 border-amber-500 font-semibold'
                    : 'bg-[#10151E] border-[#1E2634] text-slate-400 hover:text-slate-100'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Single-Column Portfolio Asset Cards */}
      {portfolio.length === 0 ? (
        <section className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-6 text-center space-y-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/12 border border-amber-500/30 flex items-center justify-center mx-auto">
            <Plus className="w-5 h-5 text-amber-400" />
          </div>
          <h3 className="text-sm font-bold text-slate-100">พอร์ตโฟลิโอของคุณยังว่างอยู่</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            เพิ่มหุ้นไทยหรือต่างประเทศที่ถือครอง เพื่อวิเคราะห์เทรน EMA เป้า Fibonacci และรับแจ้งเตือนงบ/XD
          </p>
          {!isSignedInLocal && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="min-h-[40px] px-4 rounded-xl bg-[#161E2B] border border-[#253042] text-xs text-slate-200 hover:border-amber-500/40 cursor-pointer"
            >
              สมัครสมาชิกแยกพอร์ตส่วนตัว
            </button>
          )}
        </section>
      ) : filteredPortfolio.length === 0 ? (
        <div className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-5 text-center text-xs text-slate-400">
          ไม่มีสินทรัพย์ในหมวดหมู่นี้
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredPortfolio.map((asset) => {
            const quote = liveQuotes[asset.symbol.toUpperCase()];
            const currency = quote?.currency || asset.currency || 'USD';
            const alert = getAlertsForAsset(asset, calendarEvents, newsItems);
            const expanded = Boolean(expandedIds[asset.id]);
            const isEditingCost = editingCostId === asset.id;

            const hasCost = typeof asset.averageCost === 'number' && asset.averageCost > 0;
            const hasLive = Boolean(quote && quote.price !== null);
            const pnlPct =
              hasCost && hasLive && quote?.price !== null
                ? ((quote.price - asset.averageCost!) / asset.averageCost!) * 100
                : null;
            const pnlMoney =
              hasCost && hasLive && quote?.price !== null && asset.quantity
                ? (quote.price - asset.averageCost!) * asset.quantity
                : null;

            return (
              <article
                key={asset.id}
                className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-4 space-y-3"
              >
                {/* Element 1: Flag + Ticker/Name + Live Price & % */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base shrink-0">{asset.flag}</span>
                      <span className="font-mono text-sm font-bold text-slate-100">
                        {asset.symbol}
                      </span>
                      <span className="text-[11px] text-slate-500">{asset.market}</span>
                    </div>
                    <div className="text-xs text-slate-400 truncate mt-0.5">{asset.name}</div>
                  </div>

                  <div className="text-right shrink-0">
                    {hasLive && quote?.price !== null ? (
                      <>
                        <div className="font-mono tabular-nums text-sm font-bold text-slate-100">
                          {formatCurrencyPrice(quote.price, currency)}
                        </div>
                        {quote.changePercent !== null && (
                          <div
                            className={`font-mono tabular-nums text-[11px] font-semibold ${
                              quote.changePercent > 0
                                ? 'text-emerald-400'
                                : quote.changePercent < 0
                                ? 'text-rose-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {quote.changePercent > 0 ? '+' : ''}
                            {quote.changePercent.toFixed(2)}%
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-[11px] text-slate-500">รอดึงราคา</span>
                    )}
                  </div>
                </div>

                {/* Element 2: Concise Status / Breakeven P/L (<= 2 lines) */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  {hasCost ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-slate-400 font-mono text-[11px]">
                        ทุน {formatCurrencyPrice(asset.averageCost!, currency)}
                      </span>
                      {pnlPct !== null && (
                        <span
                          className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-md ${
                            pnlPct >= 0
                              ? 'bg-emerald-500/12 text-emerald-300'
                              : 'bg-rose-500/12 text-rose-300'
                          }`}
                        >
                          {pnlPct >= 0 ? '+' : ''}
                          {pnlPct.toFixed(2)}%
                          {pnlMoney !== null ? ` (${formatSignedMoney(pnlMoney, currency)})` : ''}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 line-clamp-1">
                      {alert.earningsCount > 0
                        ? `ใกล้ประกาศงบ ${alert.nextEventDate ? formatThaiShortDate(alert.nextEventDate) : ''}`
                        : alert.dividendCount > 0
                        ? 'มีกำหนดปันผล XD ในปฏิทิน'
                        : alert.economicDirectCount > 0
                        ? `เชื่อมโยงปฏิทิน ${alert.economicDirectCount} รายการ`
                        : `${CATEGORY_LABELS_TH[asset.category]} · ${asset.sector}`}
                    </span>
                  )}
                </div>

                {/* Element 3: Primary CTA Button + ดูเพิ่มเติม Toggle */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openTrendForPortfolioAsset(asset)}
                    className="flex-1 min-h-[44px] px-3 rounded-xl bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 text-amber-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Target className="w-3.5 h-3.5 shrink-0" />
                    <span>🎯 วิเคราะห์เทรน &amp; เป้า Fibonacci</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleExpand(asset.id)}
                    className="min-h-[44px] px-3 rounded-xl bg-[#090C11] border border-[#222C3D] text-xs text-slate-300 hover:text-slate-100 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span>{expanded ? 'ย่อ' : 'ดูเพิ่มเติม'}</span>
                    {expanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Progressive Disclosure Details */}
                {expanded && (
                  <div className="pt-3 border-t border-[#1B2331] space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-[#090C11] border border-[#1B2331] rounded-xl p-2.5">
                        <div className="text-slate-500">หมวดหมู่</div>
                        <div className="text-slate-200 font-medium mt-0.5">
                          {CATEGORY_LABELS_TH[asset.category]}
                        </div>
                      </div>
                      <div className="bg-[#090C11] border border-[#1B2331] rounded-xl p-2.5">
                        <div className="text-slate-500">กลุ่มอุตสาหกรรม</div>
                        <div className="text-slate-200 font-medium mt-0.5 truncate">
                          {asset.sector}
                        </div>
                      </div>
                    </div>

                    {/* Inline Cost Editor */}
                    {isEditingCost ? (
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
                              value={editCostValue}
                              onChange={(e) => setEditCostValue(e.target.value)}
                              className="w-full min-h-[38px] bg-[#10151E] border border-[#253042] rounded-lg px-2.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500"
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
                              value={editQtyValue}
                              onChange={(e) => setEditQtyValue(e.target.value)}
                              className="w-full min-h-[38px] bg-[#10151E] border border-[#253042] rounded-lg px-2.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingCostId(null)}
                            className="px-3 min-h-[36px] text-xs text-slate-400 cursor-pointer"
                          >
                            ยกเลิก
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveCostEdit(asset)}
                            className="px-3.5 min-h-[36px] rounded-lg bg-amber-500 text-slate-950 font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>บันทึก</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEditingCost(asset)}
                            className="min-h-[36px] px-2.5 rounded-lg bg-[#090C11] border border-[#222C3D] text-slate-200 hover:border-amber-500/40 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Pencil className="w-3 h-3 text-amber-400" />
                            <span>{hasCost ? 'แก้ทุนเฉลี่ย' : 'ใส่ทุนเฉลี่ย'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onNavigate('calendar', { onlyPortfolio: true })}
                            className="min-h-[36px] px-2.5 rounded-lg bg-[#090C11] border border-[#222C3D] text-slate-300 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Calendar className="w-3 h-3 text-sky-400" />
                            <span>ปฏิทิน</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onNavigate('news', { searchQuery: asset.symbol })}
                            className="min-h-[36px] px-2.5 rounded-lg bg-[#090C11] border border-[#222C3D] text-slate-300 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Newspaper className="w-3 h-3 text-emerald-400" />
                            <span>ข่าว</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => void onRemoveAsset(asset.id)}
                          className="min-h-[36px] px-2.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 hover:bg-rose-500/20 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>ลบออก</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
