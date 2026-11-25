import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BellRing,
  Calendar,
  Newspaper,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import {
  ASSET_CATALOG,
  CATEGORY_LABELS_TH,
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
  onAddAsset: (asset: Omit<PortfolioAsset, 'id' | 'addedAt'>) => void;
  onRemoveAsset: (id: string) => void;
  onResetDefault: () => void;
  onNavigate: (tab: NavTab, options?: { onlyPortfolio?: boolean; searchQuery?: string }) => void;
}

const QUICK_POPULAR_SYMBOLS = ['VOO', 'SPY', 'QQQ', 'SCHD', 'VTI', 'NVDA', 'AAPL', 'PTT.BK', 'BTC', 'USD/THB'];

export function PortfolioView({
  portfolio,
  calendarEvents,
  newsItems,
  onAddAsset,
  onRemoveAsset,
  onResetDefault,
  onNavigate,
}: PortfolioViewProps) {
  const [query, setQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [customCategory, setCustomCategory] = useState<AssetCategory>('Stock');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'ALL' | AssetCategory>('ALL');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  const heldSymbolSet = useMemo(
    () => new Set(portfolio.map((p) => p.symbol.toUpperCase())),
    [portfolio]
  );

  // Close autocomplete dropdown on outside click
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
      // Show curated popular assets immediately when user clicks input
      return ASSET_CATALOG.slice(0, 14);
    }
    return ASSET_CATALOG.filter((item) => {
      const inSymbol = item.symbol.toLowerCase().includes(trimmed);
      const inName = item.name.toLowerCase().includes(trimmed);
      const inCategory = item.category.toLowerCase().includes(trimmed);
      const inMarket = item.market.toLowerCase().includes(trimmed);
      const inAliases = item.aliases?.some((a) => a.toLowerCase().includes(trimmed));
      return inSymbol || inName || inCategory || inMarket || Boolean(inAliases);
    }).slice(0, 12);
  }, [query]);

  const normalizedQueryTicker = query.trim().toUpperCase();
  const exactCatalogMatch = useMemo(
    () => ASSET_CATALOG.find((a) => a.symbol.toUpperCase() === normalizedQueryTicker),
    [normalizedQueryTicker]
  );

  const showCustomAddRow =
    normalizedQueryTicker.length >= 1 &&
    !exactCatalogMatch &&
    !heldSymbolSet.has(normalizedQueryTicker);

  function triggerFeedback(msg: string) {
    setFeedbackMsg(msg);
    window.setTimeout(() => {
      setFeedbackMsg((prev) => (prev === msg ? null : prev));
    }, 3000);
  }

  function handleSelectCatalogItem(item: CatalogAsset) {
    if (heldSymbolSet.has(item.symbol.toUpperCase())) {
      triggerFeedback(`${item.symbol} อยู่ในพอร์ตโฟลิโอของคุณแล้ว`);
      setDropdownOpen(false);
      return;
    }
    onAddAsset({
      symbol: item.symbol,
      name: item.name,
      category: item.category,
      market: item.market,
      flag: item.flag,
      currency: item.currency,
    });
    setQuery('');
    setDropdownOpen(false);
    triggerFeedback(`เพิ่ม ${item.symbol} เข้าพอร์ตเรียบร้อย ระบบจับคู่ข่าวและปฏิทินอัปเดตทันที`);
  }

  function handleAddCustomTicker() {
    if (!normalizedQueryTicker) return;
    if (heldSymbolSet.has(normalizedQueryTicker)) {
      triggerFeedback(`${normalizedQueryTicker} อยู่ในพอร์ตโฟลิโอของคุณแล้ว`);
      return;
    }

    const isThai = normalizedQueryTicker.endsWith('.BK');
    const flag =
      customCategory === 'Crypto'
        ? '🌐'
        : isThai || normalizedQueryTicker.includes('THB')
        ? '🇹🇭'
        : customCategory === 'Forex'
        ? '💱'
        : '🇺🇸';
    const market =
      customCategory === 'Crypto'
        ? 'Crypto'
        : customCategory === 'Forex'
        ? 'FX'
        : isThai
        ? 'SET'
        : 'Global';

    onAddAsset({
      symbol: normalizedQueryTicker,
      name: `${normalizedQueryTicker} (${CATEGORY_LABELS_TH[customCategory]})`,
      category: customCategory,
      market,
      flag,
      currency: isThai ? 'THB' : 'USD',
    });
    setQuery('');
    setDropdownOpen(false);
    triggerFeedback(`เพิ่ม ${normalizedQueryTicker} เข้าพอร์ตเรียบร้อยแล้ว`);
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
        handleSelectCatalogItem(suggestions[highlightIndex]);
      } else if (showCustomAddRow) {
        handleAddCustomTicker();
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
    <div className="space-y-6">
      {/* Add Asset Search Section */}
      <section className="bg-[#10151E] border border-[#1E2634] rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              เพิ่มสินทรัพย์เข้าพอร์ตโฟลิโอ
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              รองรับหุ้นไทย (.BK), หุ้นสหรัฐฯ, กองทุน ETF (VOO, SPY, QQQ, SCHD, VTI), คริปโต และค่าเงิน · บันทึกอัตโนมัติในเบราว์เซอร์
            </p>
          </div>
          <button
            type="button"
            onClick={onResetDefault}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors self-start sm:self-auto whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>รีเซ็ตพอร์ตตัวอย่าง</span>
          </button>
        </div>

        <div ref={searchContainerRef} className="relative">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
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
                placeholder="คลิกหรือพิมพ์ชื่อย่อสินทรัพย์ เช่น VOO, NVDA, PTT.BK, SCHD, BTC, USD/THB..."
                className="w-full bg-[#090C11] border border-[#253042] rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/20 transition-all"
                aria-label="ค้นหาและเพิ่มสินทรัพย์"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value as AssetCategory)}
                aria-label="ประเภทสินทรัพย์กรณีพิมพ์เอง"
                className="bg-[#090C11] border border-[#253042] rounded-lg px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/70 cursor-pointer"
              >
                <option value="Stock">ประเภท: หุ้น (Stock)</option>
                <option value="ETF">ประเภท: กองทุน ETF</option>
                <option value="Crypto">ประเภท: คริปโต</option>
                <option value="Forex">ประเภท: ค่าเงิน (Forex)</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  if (exactCatalogMatch) {
                    handleSelectCatalogItem(exactCatalogMatch);
                  } else if (normalizedQueryTicker) {
                    handleAddCustomTicker();
                  } else {
                    setDropdownOpen(true);
                  }
                }}
                className="px-4 py-2.5 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มสินทรัพย์</span>
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
                    : 'สินทรัพย์ยอดนิยมทั่วโลก — คลิกเพื่อเพิ่มทันที'}
                </span>
                <span>กด Enter เพื่อเลือก</span>
              </div>

              {suggestions.map((item, idx) => {
                const alreadyHeld = heldSymbolSet.has(item.symbol.toUpperCase());
                const isHighlighted = idx === highlightIndex;
                return (
                  <button
                    key={item.symbol}
                    type="button"
                    onMouseEnter={() => setHighlightIndex(idx)}
                    onClick={() => handleSelectCatalogItem(item)}
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
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {item.name}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-[11px] text-slate-400 font-medium">
                        {CATEGORY_LABELS_TH[item.category]}
                      </span>
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
                  onClick={handleAddCustomTicker}
                  className={`w-full px-3.5 py-3 flex items-center justify-between gap-3 text-left bg-amber-500/10 hover:bg-amber-500/15 transition-colors cursor-pointer ${
                    highlightIndex === suggestions.length ? 'bg-amber-500/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Plus className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-xs sm:text-sm font-medium text-amber-200">
                        เพิ่ม Ticker อิสระ:{' '}
                        <span className="font-mono font-bold">
                          {normalizedQueryTicker}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        ประเภทที่เลือก: {CATEGORY_LABELS_TH[customCategory]} (เปลี่ยนประเภทได้ที่ช่องด้านขวา)
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-amber-300 whitespace-nowrap shrink-0">
                    เพิ่มทันที
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Quick-add popular tickers */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">เพิ่มด่วน:</span>
          {QUICK_POPULAR_SYMBOLS.map((sym) => {
            const catItem = ASSET_CATALOG.find((c) => c.symbol === sym);
            if (!catItem) return null;
            const held = heldSymbolSet.has(sym.toUpperCase());
            return (
              <button
                key={sym}
                type="button"
                disabled={held}
                onClick={() => handleSelectCatalogItem(catItem)}
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
          <div className="mt-3 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3.5 py-2">
            {feedbackMsg}
          </div>
        )}
      </section>

      {/* Portfolio List & Live Alerts */}
      <section className="bg-[#10151E] border border-[#1E2634] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1E2634] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              สินทรัพย์ที่ถือครอง ({portfolio.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              ระบบตรวจสอบปฏิทินงบการเงิน วันขึ้นเครื่องหมาย XD และข่าวด่วนของแต่ละตัวโดยอัตโนมัติ
            </p>
          </div>

          {/* Category segmented filter */}
          <div className="flex items-center gap-1 p-1 bg-[#090C11] border border-[#1E2634] rounded-lg overflow-x-auto">
            {(['ALL', 'Stock', 'ETF', 'Crypto', 'Forex'] as const).map((cat) => {
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
        </div>

        {filteredPortfolio.length === 0 ? (
          <div className="py-12 px-6 text-center">
            <p className="text-sm text-slate-400">
              {portfolio.length === 0
                ? 'พอร์ตโฟลิโอของคุณยังว่างอยู่ ค้นหาและเพิ่มสินทรัพย์จากช่องด้านบนได้เลย'
                : 'ไม่พบสินทรัพย์ในหมวดหมู่ที่เลือก'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#1A2230]">
            {filteredPortfolio.map((asset) => {
              const alert = getAlertsForAsset(asset.symbol, calendarEvents, newsItems);
              const hasUpcoming =
                alert.earningsCount > 0 ||
                alert.dividendCount > 0 ||
                alert.economicCount > 0 ||
                alert.newsCount > 0;

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
                        {alert.newsCount > 0 &&
                          alert.earningsCount === 0 &&
                          alert.dividendCount === 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/35 px-2 py-0.5 rounded whitespace-nowrap">
                              มีข่าวสำคัญ ({alert.newsCount})
                            </span>
                          )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        {asset.name}
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

                  {/* Quick Actions & Alert Counts */}
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end shrink-0">
                    {hasUpcoming && (
                      <>
                        <button
                          type="button"
                          onClick={() => onNavigate('calendar', { onlyPortfolio: true })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-300 bg-[#161E2B] border border-[#243043] hover:border-amber-500/50 hover:text-amber-200 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5 text-amber-400" />
                          <span>
                            ปฏิทิน ({alert.earningsCount + alert.dividendCount + alert.economicCount})
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate('news', { searchQuery: asset.symbol })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-300 bg-[#161E2B] border border-[#243043] hover:border-sky-500/50 hover:text-sky-200 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Newspaper className="w-3.5 h-3.5 text-sky-400" />
                          <span>ข่าว ({alert.newsCount})</span>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveAsset(asset.id)}
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
