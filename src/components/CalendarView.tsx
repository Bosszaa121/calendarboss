import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Pin,
  Plus,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import {
  AssetDirectionForecast,
  CalendarEvent,
  CalendarEventKind,
  DateTabKey,
  EventCategory,
  ImpactLevel,
  PortfolioAsset,
  PortfolioImpactDetail,
  RegionFilterKey,
  SyncSource,
} from '../types';
import {
  REGION_FILTER_OPTIONS,
  matchesRegionFilter,
} from '../utils/economicDictionary';
import {
  analyzePortfolioImpacts,
  computeEventAssetDirections,
  formatThaiShortDate,
  matchesDateTab,
} from '../utils/portfolioMatcher';
import { ensureThaiClockSuffix } from '../utils/thaiTime';
import {
  AssetDirectionForecastList,
  ImpactRating,
  MacroImpactMatrix,
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
  { key: 'next_7_days', label: 'ล่วงหน้า 7 วัน' },
  { key: 'all_14_days', label: 'ทั้งหมด (14 วัน)' },
];

const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  economic: 'ตัวเลขเศรษฐกิจ',
  earnings: 'ประกาศงบ',
  dividend: 'ปันผล XD',
};

const SPECIAL_KIND_META: Partial<
  Record<CalendarEventKind, { badge: string; cls: string }>
> = {
  holiday: {
    badge: '🏖️ วันหยุดตลาด',
    cls: 'bg-sky-500/15 border-sky-500/40 text-sky-200',
  },
  meeting: {
    badge: '🎙️ การประชุม/แถลงการณ์',
    cls: 'bg-violet-500/15 border-violet-500/40 text-violet-200',
  },
  speech: {
    badge: '🎙️ การประชุม/แถลงการณ์',
    cls: 'bg-violet-500/15 border-violet-500/40 text-violet-200',
  },
  election: {
    badge: '🗳️ การเลือกตั้ง',
    cls: 'bg-amber-500/15 border-amber-500/40 text-amber-200',
  },
};

function isPinnedSpecialEvent(ev: CalendarEvent): boolean {
  if (ev.isAllDay) return true;
  if (ev.eventKind === 'holiday') return true;
  if (
    (ev.eventKind === 'meeting' || ev.eventKind === 'speech' || ev.eventKind === 'election') &&
    (!ev.time || !/^\d{1,2}:\d{2}/.test(ev.time.trim()))
  ) {
    return true;
  }
  return false;
}

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
  const [dateTab, setDateTab] = useState<DateTabKey>('today');
  const [impactFilter, setImpactFilter] = useState<'ALL' | ImpactLevel>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | EventCategory>('ALL');
  const [regionFilter, setRegionFilter] = useState<RegionFilterKey>('ALL');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const userPickedTabRef = useRef<boolean>(false);

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
      next_7_days: 0,
      all_14_days: 0,
    };
    for (const tab of DATE_TABS) {
      counts[tab.key] = events.filter((ev) => {
        if (!matchesDateTab(ev.date, tab.key)) return false;
        if (!matchesRegionFilter(regionFilter, ev.countryCode, ev.currency)) {
          return false;
        }
        if (onlyPortfolio && (eventAnalysisMap.get(ev.id)?.impacts.length ?? 0) === 0) {
          return false;
        }
        return true;
      }).length;
    }
    return counts;
  }, [events, onlyPortfolio, regionFilter, eventAnalysisMap]);

  // Smart Default Tab: if "วันนี้" has 0 events (e.g. Saturday/Sunday/Holiday),
  // automatically switch to "พรุ่งนี้" -> "ล่วงหน้า 7 วัน" -> "ทั้งหมด (14 วัน)"
  useEffect(() => {
    if (userPickedTabRef.current) return;
    if (events.length === 0) return;

    const todayTotal = events.filter((ev) => matchesDateTab(ev.date, 'today')).length;
    if (todayTotal > 0) {
      setDateTab('today');
      return;
    }

    const tomorrowTotal = events.filter((ev) => matchesDateTab(ev.date, 'tomorrow')).length;
    if (tomorrowTotal > 0) {
      setDateTab('tomorrow');
      return;
    }

    const next7Total = events.filter((ev) => matchesDateTab(ev.date, 'next_7_days')).length;
    if (next7Total > 0) {
      setDateTab('next_7_days');
      return;
    }

    setDateTab('all_14_days');
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events
      .filter((ev) => {
        if (!matchesDateTab(ev.date, dateTab)) return false;
        if (impactFilter !== 'ALL' && ev.impact !== impactFilter) return false;
        if (categoryFilter !== 'ALL' && ev.category !== categoryFilter) return false;
        if (!matchesRegionFilter(regionFilter, ev.countryCode, ev.currency)) {
          return false;
        }
        if (onlyPortfolio) {
          return (eventAnalysisMap.get(ev.id)?.impacts.length ?? 0) > 0;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        const aPinned = isPinnedSpecialEvent(a);
        const bPinned = isPinnedSpecialEvent(b);
        if (aPinned !== bPinned) return aPinned ? -1 : 1;
        const aMs = a.eventTimestampIso ? Date.parse(a.eventTimestampIso) : 0;
        const bMs = b.eventTimestampIso ? Date.parse(b.eventTimestampIso) : 0;
        if (aMs && bMs && aMs !== bMs) return aMs - bMs;
        return a.time.localeCompare(b.time);
      });
  }, [
    events,
    dateTab,
    impactFilter,
    categoryFilter,
    regionFilter,
    onlyPortfolio,
    eventAnalysisMap,
  ]);

  const groupedByDate = useMemo(() => {
    const groups: Array<{
      date: string;
      pinned: CalendarEvent[];
      timed: CalendarEvent[];
    }> = [];
    const byDate = new Map<
      string,
      { date: string; pinned: CalendarEvent[]; timed: CalendarEvent[] }
    >();

    for (const ev of filteredEvents) {
      let bucket = byDate.get(ev.date);
      if (!bucket) {
        bucket = { date: ev.date, pinned: [], timed: [] };
        byDate.set(ev.date, bucket);
        groups.push(bucket);
      }
      if (isPinnedSpecialEvent(ev)) {
        bucket.pinned.push(ev);
      } else {
        bucket.timed.push(ev);
      }
    }

    return groups;
  }, [filteredEvents]);

  function handleSelectDateTab(tab: DateTabKey) {
    userPickedTabRef.current = true;
    setDateTab(tab);
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function resetFilters() {
    setImpactFilter('ALL');
    setCategoryFilter('ALL');
    setRegionFilter('ALL');
    onToggleOnlyPortfolio(false);
  }

  const hasActiveFilters =
    impactFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    regionFilter !== 'ALL' ||
    onlyPortfolio;

  function renderEventCard(ev: CalendarEvent, pinned: boolean) {
    const analysis = eventAnalysisMap.get(ev.id);
    const impacts = analysis?.impacts ?? [];
    const directions = analysis?.directions ?? [];
    const directCount = impacts.filter((i) => i.relation === 'direct').length;
    const indirectCount = impacts.length - directCount;
    const isMatched = impacts.length > 0;
    const expanded = Boolean(expandedIds[ev.id]);
    const isReleased = ev.actualOutcome !== 'pending' && ev.actual !== '—';
    const specialMeta = ev.eventKind ? SPECIAL_KIND_META[ev.eventKind] : undefined;
    const isHolidayOrSpecialNoNumbers =
      ev.eventKind === 'holiday' ||
      (ev.actual === '—' && ev.forecast === '—' && ev.previous === '—');

    const actualColor =
      ev.actualOutcome === 'better'
        ? 'text-emerald-400'
        : ev.actualOutcome === 'worse'
        ? 'text-rose-400'
        : 'text-slate-100';

    const timeDisplay = pinned
      ? ev.eventKind === 'holiday'
        ? 'ทั้งวัน'
        : ev.time && /^\d{1,2}:\d{2}/.test(ev.time.trim())
        ? ensureThaiClockSuffix(ev.time)
        : 'ตลอดวัน'
      : ensureThaiClockSuffix(ev.time);

    return (
      <article
        key={ev.id}
        className={`rounded-2xl p-4 space-y-2.5 border ${
          pinned
            ? 'bg-[#121927] border-sky-500/35'
            : directCount > 0
            ? 'bg-[#10151E] border-amber-500/40'
            : indirectCount > 0
            ? 'bg-[#10151E] border-sky-500/35'
            : 'bg-[#10151E] border-[#1E2634]'
        }`}
      >
        {/* Element 1: Flag + Thai Time (UTC+7) + Currency + Country + Impact */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 min-w-0 text-slate-300">
            {pinned && (
              <Pin className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />
            )}
            <span className="shrink-0">{ev.flag}</span>
            <span
              className={`font-mono tabular-nums font-semibold shrink-0 ${
                pinned ? 'text-sky-300' : 'text-amber-300'
              }`}
            >
              {timeDisplay}
            </span>
            <span className="text-slate-500">·</span>
            <span className="font-mono text-[11px] text-slate-200 shrink-0">
              {ev.currency}
            </span>
            <span className="truncate text-slate-400">{ev.countryNameTh}</span>
          </div>
          {!pinned ? (
            <ImpactRating level={ev.impact} showLabel={false} />
          ) : (
            <span className="text-[10px] font-semibold text-sky-300 whitespace-nowrap shrink-0">
              ปักหมุด
            </span>
          )}
        </div>

        {/* Element 2: Event Title (<= 2 lines) & Concise Status */}
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-slate-100 leading-snug line-clamp-2">
            {ev.title}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
            {specialMeta ? (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold whitespace-nowrap ${specialMeta.cls}`}
              >
                {specialMeta.badge}
              </span>
            ) : (
              <span>{EVENT_CATEGORY_LABELS[ev.category]}</span>
            )}
            {!isHolidayOrSpecialNoNumbers && (
              <>
                <span className="text-slate-600">·</span>
                <span className={isReleased ? 'text-emerald-300 font-medium' : 'text-amber-300'}>
                  {isReleased
                    ? `จริง ${ev.actual}`
                    : ev.forecast !== '—'
                    ? `คาดการณ์ ${ev.forecast}`
                    : 'รอประกาศ'}
                </span>
              </>
            )}
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
          <span className="text-[11px] font-mono text-slate-500 truncate">
            {isHolidayOrSpecialNoNumbers
              ? `${formatThaiShortDate(ev.date)} · ปฏิทินตลาดโลก`
              : `ครั้งก่อน ${ev.previous}`}
          </span>
          <button
            type="button"
            onClick={() => toggleExpand(ev.id)}
            className="min-h-[36px] px-2.5 text-xs font-medium text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 shrink-0 cursor-pointer"
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
            {!isHolidayOrSpecialNoNumbers && (
              <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-[#090C11] border border-[#1B2331] text-center">
                <div>
                  <div className="text-[10px] text-slate-500">ค่าจริง</div>
                  <div
                    className={`font-mono tabular-nums text-xs font-bold mt-0.5 ${actualColor}`}
                  >
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
            )}

            {directions.length > 0 && (
              <AssetDirectionForecastList
                forecasts={directions}
                isReleased={isReleased}
                onTickerClick={onAssetTagClick}
              />
            )}

            {ev.macroImpacts && ev.macroImpacts.length > 0 && (
              <MacroImpactMatrix impacts={ev.macroImpacts} />
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
  }

  return (
    <div className="space-y-3">
      {/* Single-Row Horizontal Scrollable Filter Controls */}
      <section className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
          <span className="font-medium text-slate-300">ปฏิทินเศรษฐกิจโลก 54 ประเทศ</span>
          <span className="font-mono text-amber-300/90">เวลาไทย (UTC+7 · 24 ชม.)</span>
        </div>

        {/* Row 1: Cross-Week 14-Day Date Tabs (single row horizontal scroll) */}
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
                onClick={() => handleSelectDateTab(tab.key)}
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

        {/* Row 2: 6-Group Regional Filter Bar (identical across Calendar & News) */}
        <div
          role="group"
          aria-label="กรองภูมิภาคปฏิทิน"
          className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap no-scrollbar pt-2 border-t border-[#1A2230]"
        >
          {REGION_FILTER_OPTIONS.map((opt) => {
            const active = regionFilter === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setRegionFilter(opt.key)}
                className={`px-2.5 min-h-[36px] rounded-xl border text-xs font-medium inline-flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                    : 'bg-[#090C11] border-[#222C3D] text-slate-300'
                }`}
              >
                <span>{opt.label}</span>
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

      {isLoading && <LiveSearchingBanner message="กำลังอัปเดตปฏิทินเศรษฐกิจ 54 ประเทศ..." />}

      {/* Single-Column Event Cards Grouped by Thai Date with Pinned Holidays/Meetings */}
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
      ) : groupedByDate.length === 0 ? (
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
              <div className="flex flex-wrap items-center justify-center gap-2">
                {dateTab !== 'next_7_days' && dateTab !== 'all_14_days' && (
                  <button
                    type="button"
                    onClick={() => handleSelectDateTab('next_7_days')}
                    className="min-h-[38px] px-4 rounded-xl bg-amber-500 text-slate-950 text-xs font-semibold cursor-pointer"
                  >
                    ดูล่วงหน้า 7 วัน ({tabCounts.next_7_days})
                  </button>
                )}
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="min-h-[38px] px-4 rounded-xl bg-[#161E2B] border border-[#253042] text-xs text-slate-200 cursor-pointer"
                  >
                    ล้างตัวกรอง
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByDate.map((group) => {
            const totalForDay = group.pinned.length + group.timed.length;
            return (
              <section key={group.date} className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-semibold text-amber-300">
                    {formatThaiShortDate(group.date)}
                  </h2>
                  <span className="text-[11px] font-mono tabular-nums text-slate-500">
                    {totalForDay} รายการ
                    {group.pinned.length > 0 ? ` · ปักหมุด ${group.pinned.length}` : ''}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {group.pinned.map((ev) => renderEventCard(ev, true))}
                  {group.timed.map((ev) => renderEventCard(ev, false))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
