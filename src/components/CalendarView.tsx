import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Plus,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import {
  AssetDirectionForecast,
  CalendarEvent,
  DateTabKey,
  EventCategory,
  ImpactLevel,
  PortfolioAsset,
  PortfolioImpactDetail,
  SyncSource,
} from '../types';
import {
  analyzePortfolioImpacts,
  computeEventAssetDirections,
  formatThaiShortDate,
  matchesDateTab,
} from '../utils/portfolioMatcher';
import {
  AssetDirectionForecastList,
  ImpactRating,
  PortfolioImpactMatrix,
  PortfolioMatchBadge,
} from './ImpactRating';
import { CalendarRowsSkeleton, LiveSearchingBanner } from './LoadingSkeletons';

interface CalendarViewProps {
  events: CalendarEvent[];
  portfolio: PortfolioAsset[];
  portfolioMap: Map<string, string>;
  onlyPortfolio: boolean;
  onToggleOnlyPortfolio: (val: boolean) => void;
  onAssetTagClick: (symbol: string) => void;
  onGoToPortfolio: () => void;
  isLoading: boolean;
  error: string | null;
  sources: SyncSource[];
  onRetrySync: () => void;
}

const DATE_TABS: Array<{ key: DateTabKey; label: string }> = [
  { key: 'yesterday', label: 'เมื่อวาน' },
  { key: 'today', label: 'วันนี้' },
  { key: 'tomorrow', label: 'พรุ่งนี้' },
  { key: 'this_week', label: 'สัปดาห์นี้' },
  { key: 'next_week', label: 'สัปดาห์หน้า' },
];

const COUNTRY_FILTER_OPTIONS: Array<{ code: string; flag: string; label: string }> = [
  { code: 'ALL', flag: '🌐', label: 'ทั้งหมด' },
  { code: 'US', flag: '🇺🇸', label: 'สหรัฐฯ' },
  { code: 'TH', flag: '🇹🇭', label: 'ไทย' },
  { code: 'CN', flag: '🇨🇳', label: 'จีน' },
  { code: 'EU', flag: '🇪🇺', label: 'ยุโรป' },
  { code: 'JP', flag: '🇯🇵', label: 'ญี่ปุ่น' },
  { code: 'GB', flag: '🇬🇧', label: 'อังกฤษ' },
];

const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  economic: 'ตัวเลขเศรษฐกิจ',
  earnings: 'ประกาศงบ',
  dividend: 'ปันผล XD',
};

export function CalendarView({
  events,
  portfolio,
  portfolioMap,
  onlyPortfolio,
  onToggleOnlyPortfolio,
  onAssetTagClick,
  onGoToPortfolio,
  isLoading,
  error,
  onRetrySync,
}: CalendarViewProps) {
  const [dateTab, setDateTab] = useState<DateTabKey>('this_week');
  const [impactFilter, setImpactFilter] = useState<'ALL' | ImpactLevel>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | EventCategory>('ALL');
  const [countryFilter, setCountryFilter] = useState<string>('ALL');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const eventAnalysisMap = useMemo(() => {
    const map = new Map<
      string,
      { impacts: PortfolioImpactDetail[]; directions: AssetDirectionForecast[] }
    >();
    for (const ev of events) {
      const impacts = analyzePortfolioImpacts(
        {
          title: ev.title,
          description: ev.descriptionTh,
          currency: ev.currency,
          category: ev.category,
          relatedAssets: ev.relatedAssets,
          macroTags: ev.macroTags,
          aiImpacts: ev.aiImpacts,
        },
        portfolio,
        portfolioMap
      );
      const directions = computeEventAssetDirections(ev, portfolio, portfolioMap, impacts);
      map.set(ev.id, { impacts, directions });
    }
    return map;
  }, [events, portfolio, portfolioMap]);

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
        if (countryFilter !== 'ALL' && ev.countryCode.toUpperCase() !== countryFilter) {
          return false;
        }
        if (onlyPortfolio && (eventAnalysisMap.get(ev.id)?.impacts.length ?? 0) === 0) {
          return false;
        }
        return true;
      }).length;
    }
    return counts;
  }, [events, onlyPortfolio, countryFilter, eventAnalysisMap]);

  const filteredEvents = useMemo(() => {
    return events
      .filter((ev) => {
        if (!matchesDateTab(ev.date, dateTab)) return false;
        if (impactFilter !== 'ALL' && ev.impact !== impactFilter) return false;
        if (categoryFilter !== 'ALL' && ev.category !== categoryFilter) return false;
        if (countryFilter !== 'ALL' && ev.countryCode.toUpperCase() !== countryFilter) {
          return false;
        }
        if (onlyPortfolio) {
          return (eventAnalysisMap.get(ev.id)?.impacts.length ?? 0) > 0;
        }
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  }, [
    events,
    dateTab,
    impactFilter,
    categoryFilter,
    countryFilter,
    onlyPortfolio,
    eventAnalysisMap,
  ]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function resetFilters() {
    setImpactFilter('ALL');
    setCategoryFilter('ALL');
    setCountryFilter('ALL');
    onToggleOnlyPortfolio(false);
  }

  const hasActiveFilters =
    impactFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    countryFilter !== 'ALL' ||
    onlyPortfolio;

  return (
    <div className="space-y-3">
      {/* Single-Row Horizontal Scrollable Filter Controls */}
      <section className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-3.5 space-y-2.5">
        {/* Row 1: Date Tabs (single row horizontal scroll) */}
        <div
          role="tablist"
          aria-label="เลือกช่วงเวลาปฏิทิน"
          className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap no-scrollbar"
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
                className={`px-3 min-h-[38px] text-xs font-medium rounded-xl border transition-colors inline-flex items-center gap-1 shrink-0 cursor-pointer ${
                  active
                    ? 'bg-amber-500 text-slate-950 border-amber-500 font-semibold'
                    : 'bg-[#090C11] border-[#1E2634] text-slate-400 hover:text-slate-100'
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

        {/* Row 2: Country Filter Bar (single row horizontal scroll) */}
        <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap no-scrollbar pt-2 border-t border-[#1A2230]">
          {COUNTRY_FILTER_OPTIONS.map((c) => {
            const active = countryFilter === c.code;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => setCountryFilter(c.code)}
                className={`px-2.5 min-h-[36px] rounded-xl border text-xs font-medium inline-flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                    : 'bg-[#090C11] border-[#222C3D] text-slate-300'
                }`}
              >
                <span>{c.flag}</span>
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>

        {/* Row 3: Portfolio Switch + Impact/Category Filter (single row scroll) */}
        <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap no-scrollbar pt-2 border-t border-[#1A2230]">
          <button
            type="button"
            role="switch"
            aria-checked={onlyPortfolio}
            onClick={() => onToggleOnlyPortfolio(!onlyPortfolio)}
            className={`px-3 min-h-[36px] rounded-xl border text-xs font-medium inline-flex items-center gap-2 shrink-0 cursor-pointer transition-colors ${
              onlyPortfolio
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                : 'bg-[#090C11] border-[#253042] text-slate-300'
            }`}
          >
            <span>เฉพาะกระทบพอร์ต</span>
            <span
              className={`w-2 h-2 rounded-full ${
                onlyPortfolio ? 'bg-amber-400' : 'bg-slate-600'
              }`}
            />
          </button>

          <select
            value={impactFilter}
            onChange={(e) => {
              const v = e.target.value;
              setImpactFilter(v === 'ALL' ? 'ALL' : (Number(v) as ImpactLevel));
            }}
            aria-label="ระดับความสำคัญ"
            className="min-h-[36px] bg-[#090C11] border border-[#253042] rounded-xl px-2.5 text-xs text-slate-200 focus:outline-none shrink-0 cursor-pointer"
          >
            <option value="ALL">ทุกระดับความสำคัญ</option>
            <option value="3">สำคัญมาก (3)</option>
            <option value="2">สำคัญกลาง (2)</option>
            <option value="1">สำคัญน้อย (1)</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'ALL' | EventCategory)}
            aria-label="ประเภทเหตุการณ์"
            className="min-h-[36px] bg-[#090C11] border border-[#253042] rounded-xl px-2.5 text-xs text-slate-200 focus:outline-none shrink-0 cursor-pointer"
          >
            <option value="ALL">ทุกประเภท</option>
            <option value="economic">เศรษฐกิจ</option>
            <option value="earnings">ประกาศงบ</option>
            <option value="dividend">ปันผล XD</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-[36px] px-2.5 text-xs text-slate-400 hover:text-amber-300 inline-flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ล้าง</span>
            </button>
          )}
        </div>
      </section>

      {isLoading && <LiveSearchingBanner message="กำลังอัปเดตปฏิทินเศรษฐกิจล่าสุด..." />}

      {/* Single-Column Event Cards */}
      {isLoading && events.length === 0 ? (
        <div className="bg-[#10151E] border border-[#1E2634] rounded-2xl overflow-hidden">
          <CalendarRowsSkeleton rows={5} />
        </div>
      ) : !isLoading && error && events.length === 0 ? (
        <div className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-6 h-6 text-rose-400 mx-auto" />
          <p className="text-xs text-rose-200">{error}</p>
          <button
            type="button"
            onClick={onRetrySync}
            className="min-h-[40px] px-4 rounded-xl text-xs font-semibold bg-amber-500 text-slate-950 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>ลองอัปเดตใหม่</span>
          </button>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-6 text-center space-y-3">
          {onlyPortfolio && portfolio.length === 0 ? (
            <>
              <p className="text-sm text-slate-200 font-semibold">พอร์ตของคุณยังว่างอยู่</p>
              <button
                type="button"
                onClick={onGoToPortfolio}
                className="min-h-[42px] px-4 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มสินทรัพย์ในพอร์ต</span>
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-400">
                ไม่พบเหตุการณ์ตามตัวกรองที่เลือกในช่วงเวลานี้
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="min-h-[38px] px-4 rounded-xl bg-[#161E2B] border border-[#253042] text-xs text-slate-200 cursor-pointer"
                >
                  แสดงทั้งหมด
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredEvents.map((ev) => {
            const analysis = eventAnalysisMap.get(ev.id);
            const impacts = analysis?.impacts ?? [];
            const directions = analysis?.directions ?? [];
            const directCount = impacts.filter((i) => i.relation === 'direct').length;
            const indirectCount = impacts.length - directCount;
            const isMatched = impacts.length > 0;
            const expanded = Boolean(expandedIds[ev.id]);
            const isReleased = ev.actualOutcome !== 'pending' && ev.actual !== '—';

            const actualColor =
              ev.actualOutcome === 'better'
                ? 'text-emerald-400'
                : ev.actualOutcome === 'worse'
                ? 'text-rose-400'
                : 'text-slate-100';

            return (
              <article
                key={ev.id}
                className={`bg-[#10151E] border rounded-2xl p-4 space-y-2.5 ${
                  directCount > 0
                    ? 'border-amber-500/40'
                    : indirectCount > 0
                    ? 'border-sky-500/35'
                    : 'border-[#1E2634]'
                }`}
              >
                {/* Element 1: Flag + Date/Time + Impact */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0 text-slate-300">
                    <span className="shrink-0">{ev.flag}</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-100 shrink-0">
                      {ev.time}
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-400 shrink-0">
                      {formatThaiShortDate(ev.date)}
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="truncate">{ev.countryNameTh}</span>
                  </div>
                  <ImpactRating level={ev.impact} showLabel={false} />
                </div>

                {/* Element 2: Event Title (<= 2 lines) & Concise Status */}
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-100 leading-snug line-clamp-2">
                    {ev.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <span>{EVENT_CATEGORY_LABELS[ev.category]}</span>
                    <span>·</span>
                    <span className={isReleased ? 'text-emerald-300' : 'text-amber-300'}>
                      {isReleased ? `จริง ${ev.actual}` : `คาดการณ์ ${ev.forecast}`}
                    </span>
                    {isMatched && (
                      <PortfolioMatchBadge
                        directCount={directCount}
                        indirectCount={indirectCount}
                      />
                    )}
                  </div>
                </div>

                {/* Element 3: Clean Expand Toggle */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#1A2230]">
                  <span className="text-[11px] font-mono text-slate-500">
                    ครั้งก่อน {ev.previous}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleExpand(ev.id)}
                    className="min-h-[36px] px-2.5 text-xs font-medium text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>{expanded ? 'ย่อ' : 'ดูเพิ่มเติม'}</span>
                    {expanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Progressive Disclosure Body */}
                {expanded && (
                  <div className="pt-2.5 border-t border-[#1B2331] space-y-3">
                    <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-[#090C11] border border-[#1B2331] text-center">
                      <div>
                        <div className="text-[10px] text-slate-500">ค่าจริง</div>
                        <div className={`font-mono tabular-nums text-xs font-bold mt-0.5 ${actualColor}`}>
                          {ev.actual}
                        </div>
                      </div>
                      <div className="border-x border-[#1B2331]">
                        <div className="text-[10px] text-slate-500">คาดการณ์</div>
                        <div className="font-mono tabular-nums text-xs text-slate-200 mt-0.5">
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

                    {directions.length > 0 && (
                      <AssetDirectionForecastList
                        forecasts={directions}
                        isReleased={isReleased}
                        onTickerClick={onAssetTagClick}
                      />
                    )}

                    {isMatched && (
                      <PortfolioImpactMatrix
                        impacts={impacts}
                        onTickerClick={onAssetTagClick}
                      />
                    )}

                    {ev.descriptionTh && (
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {ev.descriptionTh}
                      </p>
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
