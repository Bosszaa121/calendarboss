import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Filter, RotateCcw } from 'lucide-react';
import {
  CalendarEvent,
  DateTabKey,
  EventCategory,
  ImpactLevel,
} from '../types';
import {
  formatThaiShortDate,
  getMatchedPortfolioSymbols,
  isAssetTagMatched,
  matchesDateTab,
} from '../utils/portfolioMatcher';
import {
  AssetTickerTag,
  ImpactRating,
  PortfolioMatchBadge,
} from './ImpactRating';

interface CalendarViewProps {
  events: CalendarEvent[];
  portfolioMap: Map<string, string>;
  onlyPortfolio: boolean;
  onToggleOnlyPortfolio: (val: boolean) => void;
  onAssetTagClick: (symbol: string) => void;
}

const DATE_TABS: Array<{ key: DateTabKey; label: string }> = [
  { key: 'yesterday', label: 'เมื่อวาน' },
  { key: 'today', label: 'วันนี้' },
  { key: 'tomorrow', label: 'พรุ่งนี้' },
  { key: 'this_week', label: 'สัปดาห์นี้' },
  { key: 'next_week', label: 'สัปดาห์หน้า' },
];

const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  economic: 'ตัวเลขเศรษฐกิจ',
  earnings: 'ประกาศงบ',
  dividend: 'ปันผล XD',
};

export function CalendarView({
  events,
  portfolioMap,
  onlyPortfolio,
  onToggleOnlyPortfolio,
  onAssetTagClick,
}: CalendarViewProps) {
  const [dateTab, setDateTab] = useState<DateTabKey>('today');
  const [impactFilter, setImpactFilter] = useState<'ALL' | ImpactLevel>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | EventCategory>('ALL');
  const [currencyFilter, setCurrencyFilter] = useState<string>('ALL');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const availableCurrencies = useMemo(() => {
    const map = new Map<string, { currency: string; flag: string }>();
    for (const ev of events) {
      if (!map.has(ev.currency)) {
        map.set(ev.currency, { currency: ev.currency, flag: ev.flag });
      }
    }
    return Array.from(map.values());
  }, [events]);

  const tabCounts = useMemo(() => {
    const counts: Record<DateTabKey, number> = {
      yesterday: 0,
      today: 0,
      tomorrow: 0,
      this_week: 0,
      next_week: 0,
    };
    for (const tab of DATE_TABS) {
      counts[tab.key] = events.filter((ev) => {
        if (!matchesDateTab(ev.date, tab.key)) return false;
        if (
          onlyPortfolio &&
          getMatchedPortfolioSymbols(ev.relatedAssets, portfolioMap).length === 0
        ) {
          return false;
        }
        return true;
      }).length;
    }
    return counts;
  }, [events, onlyPortfolio, portfolioMap]);

  const filteredEvents = useMemo(() => {
    return events
      .filter((ev) => {
        if (!matchesDateTab(ev.date, dateTab)) return false;
        if (impactFilter !== 'ALL' && ev.impact !== impactFilter) return false;
        if (categoryFilter !== 'ALL' && ev.category !== categoryFilter) return false;
        if (currencyFilter !== 'ALL' && ev.currency !== currencyFilter) return false;
        if (onlyPortfolio) {
          return getMatchedPortfolioSymbols(ev.relatedAssets, portfolioMap).length > 0;
        }
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  }, [
    events,
    dateTab,
    impactFilter,
    categoryFilter,
    currencyFilter,
    onlyPortfolio,
    portfolioMap,
  ]);

  const matchedCountInView = useMemo(() => {
    return filteredEvents.filter(
      (ev) => getMatchedPortfolioSymbols(ev.relatedAssets, portfolioMap).length > 0
    ).length;
  }, [filteredEvents, portfolioMap]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function resetFilters() {
    setImpactFilter('ALL');
    setCategoryFilter('ALL');
    setCurrencyFilter('ALL');
    onToggleOnlyPortfolio(false);
  }

  const hasActiveFilters =
    impactFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    currencyFilter !== 'ALL' ||
    onlyPortfolio;

  return (
    <div className="space-y-5">
      {/* Date Range Tabs + Portfolio Switch */}
      <section className="bg-[#10151E] border border-[#1E2634] rounded-xl p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* 5 Date Range Tabs (14 days forward) */}
          <div
            role="tablist"
            aria-label="เลือกช่วงเวลาปฏิทิน"
            className="flex items-center gap-1 p-1 bg-[#090C11] border border-[#1E2634] rounded-lg overflow-x-auto"
          >
            {DATE_TABS.map((tab) => {
              const active = dateTab === tab.key;
              return (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setDateTab(tab.key)}
                  className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-[#141B27]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`font-mono tabular-nums text-[11px] ${
                      active ? 'text-slate-900/80' : 'text-slate-500'
                    }`}
                  >
                    ({tabCounts[tab.key]})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Toggle Switch: Portfolio Only */}
          <button
            type="button"
            role="switch"
            aria-checked={onlyPortfolio}
            onClick={() => onToggleOnlyPortfolio(!onlyPortfolio)}
            className={`inline-flex items-center justify-between sm:justify-start gap-3 px-3.5 py-2 rounded-lg border text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              onlyPortfolio
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                : 'bg-[#090C11] border-[#253042] text-slate-300 hover:border-slate-600'
            }`}
          >
            <span>ดูเฉพาะที่กระทบพอร์ตฉัน</span>
            <span
              className={`w-9 h-5 rounded-full p-0.5 transition-colors inline-flex items-center ${
                onlyPortfolio ? 'bg-amber-500 justify-end' : 'bg-slate-700 justify-start'
              }`}
              aria-hidden="true"
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-sm block" />
            </span>
          </button>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-[#1A2230]">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-400 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>ตัวกรอง:</span>
          </div>

          {/* Impact Filter */}
          <select
            value={impactFilter}
            onChange={(e) => {
              const v = e.target.value;
              setImpactFilter(v === 'ALL' ? 'ALL' : (Number(v) as ImpactLevel));
            }}
            aria-label="กรองตามระดับความสำคัญ"
            className="bg-[#090C11] border border-[#253042] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/70 cursor-pointer"
          >
            <option value="ALL">ความสำคัญ: ทุกระดับ</option>
            <option value="3">ระดับสูง (3 กระทิง)</option>
            <option value="2">ระดับกลาง (2 กระทิง)</option>
            <option value="1">ระดับต่ำ (1 กระทิง)</option>
          </select>

          {/* Event Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'ALL' | EventCategory)}
            aria-label="กรองตามประเภทเหตุการณ์"
            className="bg-[#090C11] border border-[#253042] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/70 cursor-pointer"
          >
            <option value="ALL">ประเภท: ทุกเหตุการณ์</option>
            <option value="economic">ตัวเลขเศรษฐกิจ (Macro)</option>
            <option value="earnings">ประกาศงบ (Earnings)</option>
            <option value="dividend">ปันผล (XD)</option>
          </select>

          {/* Currency / Country Filter */}
          <select
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            aria-label="กรองตามประเทศหรือสกุลเงิน"
            className="bg-[#090C11] border border-[#253042] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/70 cursor-pointer"
          >
            <option value="ALL">ประเทศ/สกุลเงิน: ทั้งหมด</option>
            {availableCurrencies.map((c) => (
              <option key={c.currency} value={c.currency}>
                {c.flag} {c.currency}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-amber-300 px-2 py-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ล้างตัวกรอง</span>
            </button>
          )}

          <div className="ml-auto text-xs text-slate-400 hidden sm:block">
            แสดง{' '}
            <span className="font-mono tabular-nums text-slate-200 font-medium">
              {filteredEvents.length}
            </span>{' '}
            รายการ
            {matchedCountInView > 0 && (
              <>
                <span className="mx-1.5 text-slate-600" aria-hidden="true">·</span>
                <span className="text-amber-300 font-medium">
                  กระทบพอร์ต {matchedCountInView} รายการ
                </span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Main Calendar Data Table (Desktop) & Card List (Mobile) */}
      <section className="bg-[#10151E] border border-[#1E2634] rounded-xl overflow-hidden">
        {filteredEvents.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <p className="text-sm text-slate-300 font-medium">
              ไม่พบเหตุการณ์ตามเงื่อนไขที่เลือกในช่วงเวลานี้
            </p>
            <p className="text-xs text-slate-500 mt-1">
              ลองเปลี่ยนแท็บช่วงเวลาเป็น &quot;สัปดาห์นี้&quot; หรือ &quot;สัปดาห์หน้า&quot; หรือปิดตัวกรองบางรายการ
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 px-4 py-2 text-xs font-medium rounded-lg bg-[#161E2B] border border-[#283549] text-slate-200 hover:bg-[#1E293B] transition-colors cursor-pointer"
              >
                แสดงเหตุการณ์ทั้งหมด
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0D121A] border-b border-[#1E2634] text-[11px] font-medium text-slate-400">
                    <th className="py-3 px-4 whitespace-nowrap">เวลา / วันที่</th>
                    <th className="py-3 px-3 whitespace-nowrap">ประเทศ</th>
                    <th className="py-3 px-3 whitespace-nowrap">ความสำคัญ</th>
                    <th className="py-3 px-3">เหตุการณ์ &amp; สินทรัพย์ที่เกี่ยวข้อง</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">ค่าจริง</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">คาดการณ์</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">ครั้งก่อน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2230]">
                  {filteredEvents.map((ev) => {
                    const matched = getMatchedPortfolioSymbols(ev.relatedAssets, portfolioMap);
                    const isMatched = matched.length > 0;
                    const expanded = Boolean(expandedIds[ev.id]);

                    const actualColor =
                      ev.actualOutcome === 'better'
                        ? 'text-emerald-400 font-semibold'
                        : ev.actualOutcome === 'worse'
                        ? 'text-rose-400 font-semibold'
                        : ev.actualOutcome === 'inline'
                        ? 'text-slate-100 font-semibold'
                        : 'text-slate-500';

                    return (
                      <React.Fragment key={ev.id}>
                        <tr
                          onClick={() => toggleExpand(ev.id)}
                          className={`transition-colors cursor-pointer ${
                            isMatched
                              ? 'bg-amber-500/[0.06] hover:bg-amber-500/[0.11]'
                              : 'hover:bg-[#151C28]'
                          }`}
                        >
                          {/* Time & Date */}
                          <td className="py-3.5 px-4 align-top whitespace-nowrap">
                            <div className="flex items-start gap-2.5">
                              <span
                                className={`w-1 h-8 rounded-full mt-0.5 shrink-0 ${
                                  isMatched ? 'bg-amber-400' : 'bg-transparent'
                                }`}
                                aria-hidden="true"
                              />
                              <div>
                                <div className="font-mono tabular-nums text-sm font-semibold text-slate-100">
                                  {ev.time}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {formatThaiShortDate(ev.date)}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Flag + Currency */}
                          <td className="py-3.5 px-3 align-top whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              <span className="text-base leading-none">{ev.flag}</span>
                              <div>
                                <div className="font-mono text-xs font-semibold text-slate-100">
                                  {ev.currency}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {ev.countryNameTh}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Impact */}
                          <td className="py-3.5 px-3 align-top whitespace-nowrap">
                            <div className="pt-0.5">
                              <ImpactRating level={ev.impact} />
                            </div>
                          </td>

                          {/* Event Title + Category + Asset Tags */}
                          <td className="py-3.5 px-3 align-top min-w-[280px]">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-slate-100 leading-snug">
                                {ev.title}
                              </span>
                              {isMatched && <PortfolioMatchBadge />}
                              {ev.isLiveSynced && (
                                <span className="text-[10px] font-medium text-sky-300 bg-sky-500/15 px-1.5 py-0.5 rounded">
                                  ข้อมูลสด
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400 mt-1">
                              <span
                                className={
                                  ev.category === 'earnings'
                                    ? 'text-sky-300 font-medium'
                                    : ev.category === 'dividend'
                                    ? 'text-emerald-300 font-medium'
                                    : 'text-slate-400'
                                }
                              >
                                {EVENT_CATEGORY_LABELS[ev.category]}
                              </span>
                              {ev.subtitle && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{ev.subtitle}</span>
                                </>
                              )}
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-0.5 text-slate-500">
                                รายละเอียด
                                {expanded ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </span>
                            </div>

                            {ev.relatedAssets.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                {ev.relatedAssets.map((tag) => (
                                  <AssetTickerTag
                                    key={tag}
                                    symbol={tag}
                                    matched={isAssetTagMatched(tag, portfolioMap)}
                                    onClick={() => onAssetTagClick(tag)}
                                  />
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Actual */}
                          <td className="py-3.5 px-3 align-top text-right whitespace-nowrap">
                            <span className={`font-mono tabular-nums text-sm ${actualColor}`}>
                              {ev.actual}
                            </span>
                          </td>

                          {/* Forecast */}
                          <td className="py-3.5 px-3 align-top text-right whitespace-nowrap">
                            <span className="font-mono tabular-nums text-sm text-slate-300">
                              {ev.forecast}
                            </span>
                          </td>

                          {/* Previous */}
                          <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                            <span className="font-mono tabular-nums text-sm text-slate-400">
                              {ev.previous}
                            </span>
                          </td>
                        </tr>

                        {expanded && (
                          <tr className="bg-[#0C1118]">
                            <td colSpan={7} className="px-6 py-3.5 border-t border-[#1A2230]/70">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                                <p className="text-slate-300 leading-relaxed max-w-3xl">
                                  <span className="text-amber-400 font-medium mr-1.5">
                                    มุมมองผลกระทบตลาด:
                                  </span>
                                  {ev.descriptionTh || 'ติดตามความผันผวนของสินทรัพย์ที่เกี่ยวข้องในช่วงเวลาประกาศตัวเลข'}
                                </p>
                                {isMatched && (
                                  <span className="text-amber-300 font-mono text-[11px] whitespace-nowrap shrink-0">
                                    ตรงกับพอร์ต: {matched.join(', ')}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Rows */}
            <div className="md:hidden divide-y divide-[#1A2230]">
              {filteredEvents.map((ev) => {
                const matched = getMatchedPortfolioSymbols(ev.relatedAssets, portfolioMap);
                const isMatched = matched.length > 0;
                const expanded = Boolean(expandedIds[ev.id]);

                const actualColor =
                  ev.actualOutcome === 'better'
                    ? 'text-emerald-400'
                    : ev.actualOutcome === 'worse'
                    ? 'text-rose-400'
                    : 'text-slate-100';

                return (
                  <article
                    key={ev.id}
                    onClick={() => toggleExpand(ev.id)}
                    className={`p-4 space-y-2.5 transition-colors ${
                      isMatched ? 'bg-amber-500/[0.06]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        {isMatched && (
                          <span
                            className="w-1 h-4 rounded-full bg-amber-400 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                        <span className="font-mono tabular-nums font-semibold text-slate-100">
                          {ev.time}
                        </span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-400">
                          {formatThaiShortDate(ev.date)}
                        </span>
                        <span className="text-slate-500">·</span>
                        <span className="font-mono text-slate-200">
                          {ev.flag} {ev.currency}
                        </span>
                      </div>
                      <ImpactRating level={ev.impact} />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-medium text-slate-100 leading-snug">
                          {ev.title}
                        </h3>
                        {isMatched && <PortfolioMatchBadge />}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {EVENT_CATEGORY_LABELS[ev.category]}
                        {ev.subtitle ? ` · ${ev.subtitle}` : ''}
                      </div>
                    </div>

                    {/* Actual | Forecast | Previous Strip */}
                    <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-lg bg-[#0B0F16] border border-[#1B2331] text-center">
                      <div>
                        <div className="text-[10px] text-slate-500">ค่าจริง</div>
                        <div className={`font-mono tabular-nums text-xs font-semibold mt-0.5 ${actualColor}`}>
                          {ev.actual}
                        </div>
                      </div>
                      <div className="border-x border-[#1B2331]">
                        <div className="text-[10px] text-slate-500">คาดการณ์</div>
                        <div className="font-mono tabular-nums text-xs text-slate-300 mt-0.5">
                          {ev.forecast}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">ครั้งก่อน</div>
                        <div className="font-mono tabular-nums text-xs text-slate-400 mt-0.5">
                          {ev.previous}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {ev.relatedAssets.map((tag) => (
                        <AssetTickerTag
                          key={tag}
                          symbol={tag}
                          matched={isAssetTagMatched(tag, portfolioMap)}
                          onClick={() => onAssetTagClick(tag)}
                        />
                      ))}
                    </div>

                    {expanded && ev.descriptionTh && (
                      <p className="text-xs text-slate-300 leading-relaxed pt-2 border-t border-[#1E2634]">
                        {ev.descriptionTh}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
