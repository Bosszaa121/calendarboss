import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BellRing,
  Calendar,
  Download,
  Loader2,
  Newspaper,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
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
  NavTab,
  NewsItem,
  PortfolioAsset,
} from '../types';
import {
  formatThaiShortDate,
  getAlertsForAsset,
} from '../utils/portfolioMatcher';

interface PortfolioViewProps {
  portfolio: PortfolioAsset[];
  calendarEvents: CalendarEvent[];
  newsItems: NewsItem[];
  isSignedInLocal: boolean;
  accountLabel: string;
  onAddAsset: (asset: Omit<PortfolioAsset, 'id' | 'addedAt'>) => Promise<void> | void;
  onRemoveAsset: (id: string) => Promise<void> | void;
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

export function PortfolioView({
  portfolio,
  calendarEvents,
  newsItems,
  isSignedInLocal,
  accountLabel,
  onAddAsset,
  onRemoveAsset,
  onExportJson,
  onImportJsonFile,
  onOpenAuth,
  onNavigate,
}: PortfolioViewProps) {
  const [query, setQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [customCategory, setCustomCategory] = useState<AssetCategory>('US ETF');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'ALL' | AssetCategory>('ALL');
  const [classifyingTicker, setClassifyingTicker] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const heldSymbolSet = useMemo(
    () => new Set(portfolio.map((p) => p.symbol.toUpperCase().replace(/\.BK$/, ''))),
    [portfolio]
  );

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
    return ASSET_CATALOG.filter((item) => {
      const inSymbol = item.symbol.toLowerCase().includes(trimmed);
      const inName = item.name.toLowerCase().includes(trimmed);
      const inCategory = item.category.toLowerCase().includes(trimmed);
      const inSector = item.sector.toLowerCase().includes(trimmed);
      const inMarket = item.market.toLowerCase().includes(trimmed);
      const inAliases = item.aliases?.some((a) => a.toLowerCase().includes(trimmed));
      return inSymbol || inName || inCategory || inSector || inMarket || Boolean(inAliases);
    }).slice(0, 14);
  }, [query]);

  const normalizedQueryTicker = query
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9./-]/g, '');

  const exactCatalogMatch = useMemo(
    () =>
      ASSET_CATALOG.find(
        (a) =>
          a.symbol.toUpperCase() === normalizedQueryTicker ||
          a.aliases?.some((al) => al.toUpperCase() === normalizedQueryTicker)
      ),
    [normalizedQueryTicker]
  );

  const isAlreadyHeld = (sym: string) =>
    heldSymbolSet.has(sym.toUpperCase().replace(/\.BK$/, ''));

  const showCustomAddRow =
    normalizedQueryTicker.length >= 1 &&
    !exactCatalogMatch &&
    !isAlreadyHeld(normalizedQueryTicker);

  function triggerFeedback(type: 'success' | 'error', text: string) {
    setFeedbackMsg({ type, text });
    window.setTimeout(() => {
      setFeedbackMsg((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  }

  async function handleSelectCatalogItem(item: CatalogAsset) {
    if (isAlreadyHeld(item.symbol)) {
      triggerFeedback('error', `${item.symbol} อยู่ในพอร์ตโฟลิโอของคุณแล้ว`);
      setDropdownOpen(false);
      return;
    }
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
      });
      setQuery('');
      setDropdownOpen(false);
      triggerFeedback(
        'success',
        `เพิ่ม ${item.symbol} (${item.category}) เข้าพอร์ตแล้ว — ระบบคำนวณผลกระทบ งบ และวัน XD ทันที`
      );
    } catch (err) {
      triggerFeedback(
        'error',
        err instanceof Error ? err.message : 'ไม่สามารถบันทึกสินทรัพย์ได้'
      );
    }
  }

  async function handleAddCustomTickerWithAI() {
    if (!normalizedQueryTicker) return;
    if (isAlreadyHeld(normalizedQueryTicker)) {
      triggerFeedback('error', `${normalizedQueryTicker} อยู่ในพอร์ตโฟลิโอของคุณแล้ว`);
      return;
    }

    setClassifyingTicker(normalizedQueryTicker);
    setDropdownOpen(false);

    try {
      const res = await fetch('/api/classify-asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: normalizedQueryTicker }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const classified = await res.json();
        await onAddAsset({
          symbol: classified.symbol || normalizedQueryTicker,
          name: classified.name || normalizedQueryTicker,
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
        });
        setQuery('');
        triggerFeedback(
          'success',
          `AI ระบุข้อมูล ${classified.symbol}: ${classified.name} (${classified.category} · ${classified.sector}) และเพิ่มเข้าพอร์ตเรียบร้อย`
        );
        return;
      }

      // Graceful fallback if static deployment without backend API
      const isThai =
        customCategory === 'Thai Stock' || normalizedQueryTicker.endsWith('.BK');
      const cleanSymbol = isThai
        ? normalizedQueryTicker.replace(/\.BK$/, '')
        : normalizedQueryTicker;
      await onAddAsset({
        symbol: cleanSymbol,
        name: `${cleanSymbol} (${CATEGORY_LABELS_TH[customCategory]})`,
        category: customCategory,
        market: isThai ? 'SET' : customCategory === 'Crypto' ? 'Crypto' : 'Global',
        flag: isThai
          ? '🇹🇭'
          : customCategory === 'US ETF' || customCategory === 'US Stock'
          ? '🇺🇸'
          : '🌐',
        currency: isThai ? 'THB' : 'USD',
        sector: CATEGORY_LABELS_TH[customCategory],
        themes: isThai ? ['thai_equity'] : ['us_equity', 'us_rates_sensitive'],
      });
      setQuery('');
      triggerFeedback('success', `เพิ่ม ${cleanSymbol} เข้าพอร์ตเรียบร้อยแล้ว`);
    } catch (err) {
      triggerFeedback(
        'error',
        err instanceof Error ? err.message : 'ไม่สามารถเพิ่มสินทรัพย์ได้ในขณะนี้'
      );
    } finally {
      setClassifyingTicker(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!dropdownOpen) {
      if (e.key === 'ArrowDown') setDropdownOpen(true);
      return;
    }
    const totalOptions = suggestions.length + (showCustomAddRow ? 1 : 0);
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
      } else if (showCustomAddRow) {
        void handleAddCustomTickerWithAI();
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
                เพิ่มสินทรัพย์เข้าพอร์ตโฟลิโอ
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
              ค้นหา US ETF (QQQM, SMH, BLOK, GLD, SLV, VOO, SCHD, SGOV, JPST, IBIT), หุ้นไทย (KCG, PTT, CPALL, DELTA), หุ้นสหรัฐฯ, คริปโต หรือพิมพ์ Ticker อิสระเพื่อให้ AI ระบุข้อมูลอัตโนมัติ
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
                placeholder="พิมพ์ชื่อย่อหรือชื่อบริษัท เช่น QQQM, SMH, BLOK, GLD, SLV, KCG, PTT, NVDA, BTC..."
                className="w-full bg-[#090C11] border border-[#253042] rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/20 transition-all"
                aria-label="ค้นหาและเพิ่มสินทรัพย์"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value as AssetCategory)}
                aria-label="ประเภทสำรองกรณีไม่เชื่อมต่อ AI"
                className="bg-[#090C11] border border-[#253042] rounded-lg px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/70 cursor-pointer"
              >
                <option value="US ETF">US ETF</option>
                <option value="Thai Stock">หุ้นไทย (SET/mai)</option>
                <option value="US Stock">หุ้นสหรัฐฯ</option>
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
                  } else if (normalizedQueryTicker) {
                    void handleAddCustomTickerWithAI();
                  } else {
                    focusSearchInput();
                  }
                }}
                className="px-4 py-2.5 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-70 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {classifyingTicker ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI กำลังระบุข้อมูล...</span>
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

          {/* Autocomplete Dropdown */}
          {dropdownOpen && (
            <div className="absolute z-40 left-0 right-0 mt-2 bg-[#121823] border border-[#2A364B] rounded-xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto">
              <div className="px-3.5 py-2 bg-[#0D121A] border-b border-[#1E2634] flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  {query.trim()
                    ? `ผลการค้นหา "${query.trim()}"`
                    : 'US ETF ยอดนิยม, หุ้นไทย SET/mai, หุ้นสหรัฐฯ และโภคภัณฑ์'}
                </span>
                <span>กด Enter เพื่อเพิ่ม</span>
              </div>

              {suggestions.map((item, idx) => {
                const alreadyHeld = isAlreadyHeld(item.symbol);
                const isHighlighted = idx === highlightIndex;
                return (
                  <button
                    key={item.symbol}
                    type="button"
                    onMouseEnter={() => setHighlightIndex(idx)}
                    onClick={() => void handleSelectCatalogItem(item)}
                    className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer border-b border-[#1A2230]/60 last:border-b-0 ${
                      isHighlighted ? 'bg-[#1A2434]' : 'hover:bg-[#161E2C]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
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
                    </div>

                    <div className="shrink-0">
                      {alreadyHeld ? (
                        <span className="text-[11px] text-emerald-400 font-medium">
                          มีในพอร์ตแล้ว
                        </span>
                      ) : (
                        <span className="text-xs text-amber-400 font-medium inline-flex items-center gap-0.5">
                          <Plus className="w-3.5 h-3.5" />
                          เพิ่ม
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {showCustomAddRow && (
                <button
                  type="button"
                  onClick={() => void handleAddCustomTickerWithAI()}
                  className={`w-full px-3.5 py-3 flex items-center justify-between gap-3 text-left bg-amber-500/10 hover:bg-amber-500/15 transition-colors cursor-pointer ${
                    highlightIndex === suggestions.length ? 'bg-amber-500/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-medium text-amber-200">
                        เพิ่ม Ticker อิสระ{' '}
                        <span className="font-mono font-bold">
                          {normalizedQueryTicker}
                        </span>{' '}
                        พร้อมให้ AI ระบุชื่อเต็ม ประเภท และกลุ่มอุตสาหกรรมอัตโนมัติ
                      </div>
                      <div className="text-[11px] text-slate-400">
                        รองรับหุ้นไทย SET/mai, US ETF, หุ้นต่างประเทศ, คริปโต และโภคภัณฑ์ทุกตัว
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-amber-300 whitespace-nowrap shrink-0">
                    เพิ่มด้วย AI
                  </span>
                </button>
              )}
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

      {/* Portfolio List & Live Alerts */}
      <section className="bg-[#10151E] border border-[#1E2634] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1E2634] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              สินทรัพย์ที่ถือครองจริง ({portfolio.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              ระบบวิเคราะห์ความเชื่อมโยงทางตรง/ทางอ้อมกับปฏิทินเศรษฐกิจและข่าวทั่วโลกตามสินทรัพย์จริงในตารางนี้
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
                เริ่มต้นเพิ่มสินทรัพย์จริงที่คุณถือครอง เช่น QQQM, SMH, GLD, SLV, BLOK หรือหุ้นไทยอย่าง KCG, PTT เพื่อเปิดระบบ Smart Portfolio Alert และการวิเคราะห์ผลกระทบทางตรง/ทางอ้อมแบบเรียลไทม์
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
              const totalCalCount =
                alert.earningsCount +
                alert.dividendCount +
                alert.economicDirectCount +
                alert.economicIndirectCount;

              return (
                <div
                  key={asset.id}
                  className="px-5 py-4 hover:bg-[#141B27] transition-colors flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
                >
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
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
