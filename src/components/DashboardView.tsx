import React, { useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Briefcase,
  CalendarClock,
  Coins,
  Newspaper,
  Plus,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import {
  AppAlert,
  CalendarEvent,
  DividendXDRecord,
  EarningsRecord,
  FearGreedData,
  NavTab,
  NewsItem,
  NewsSubTab,
  PortfolioAsset,
  PortfolioImpactDetail,
} from '../types';
import {
  analyzePortfolioImpacts,
  computeEventAssetDirections,
  formatThaiShortDate,
  getAlertsForAsset,
  getDayDiffFromToday,
} from '../utils/portfolioMatcher';
import {
  AssetDirectionForecastList,
  AssetTickerTag,
  ImpactRating,
  PortfolioImpactMatrix,
  PortfolioMatchBadge,
  SentimentIndicator,
} from './ImpactRating';
import { FearGreedGauge } from './FearGreedGauge';
import {
  CalendarRowsSkeleton,
  FearGreedSkeleton,
  LiveSearchingBanner,
  NewsCardsSkeleton,
} from './LoadingSkeletons';

interface DashboardViewProps {
  portfolio: PortfolioAsset[];
  portfolioMap: Map<string, string>;
  calendarEvents: CalendarEvent[];
  newsItems: NewsItem[];
  earningsRecords: EarningsRecord[];
  dividendRecords: DividendXDRecord[];
  alerts: AppAlert[];
  fearGreed: FearGreedData | null;
  isLoadingMarket: boolean;
  marketError: string | null;
  onRetryMarket: () => void;
  onNavigate: (
    tab: NavTab,
    options?: { onlyPortfolio?: boolean; searchQuery?: string; newsSubTab?: NewsSubTab }
  ) => void;
}

export function DashboardView({
  portfolio,
  portfolioMap,
  calendarEvents,
  newsItems,
  earningsRecords,
  dividendRecords,
  alerts,
  fearGreed,
  isLoadingMarket,
  marketError,
  onRetryMarket,
  onNavigate,
}: DashboardViewProps) {
  const analyzed = useMemo(() => {
    const eventImpacts = new Map<string, PortfolioImpactDetail[]>();
    for (const ev of calendarEvents) {
      eventImpacts.set(
        ev.id,
        analyzePortfolioImpacts(
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
        )
      );
    }

    const newsImpacts = new Map<string, PortfolioImpactDetail[]>();
    for (const item of newsItems) {
      newsImpacts.set(
        item.id,
        analyzePortfolioImpacts(
          {
            title: item.headline,
            description: item.impactSummary,
            category: 'news',
            relatedAssets: item.relatedAssets,
            macroTags: item.macroTags,
            aiImpacts: item.aiImpacts,
          },
          portfolio,
          portfolioMap
        )
      );
    }

    const upcoming14d = calendarEvents.filter((ev) => {
      const diff = getDayDiffFromToday(ev.date);
      return diff >= 0 && diff <= 14;
    });
    const todayEvents = calendarEvents.filter((ev) => getDayDiffFromToday(ev.date) === 0);

    const matchedUpcoming = upcoming14d.filter(
      (ev) => (eventImpacts.get(ev.id)?.length ?? 0) > 0
    );
    const matchedToday = todayEvents.filter(
      (ev) => (eventImpacts.get(ev.id)?.length ?? 0) > 0
    );
    const directUpcomingCount = matchedUpcoming.filter((ev) =>
      eventImpacts.get(ev.id)?.some((i) => i.relation === 'direct')
    ).length;
    const indirectOnlyUpcomingCount = matchedUpcoming.length - directUpcomingCount;

    const upcomingEarningsCount = earningsRecords.filter(
      (e) =>
        e.status !== 'not_applicable' &&
        typeof e.daysUntil === 'number' &&
        e.daysUntil >= 0 &&
        e.daysUntil <= 7
    ).length;

    const upcomingXDCount = dividendRecords.filter(
      (d) =>
        d.applicable &&
        d.xdStatus === 'announced' &&
        typeof d.daysUntilXD === 'number' &&
        d.daysUntilXD >= 0 &&
        d.daysUntilXD <= 7
    ).length;

    const matchedHighSeverity = matchedUpcoming.filter((ev) =>
      eventImpacts.get(ev.id)?.some((i) => i.severity === 'high')
    );

    const matchedNews = newsItems.filter((n) => (newsImpacts.get(n.id)?.length ?? 0) > 0);
    const bullishNews = matchedNews.filter((n) => n.sentiment === 'bullish').length;
    const bearishNews = matchedNews.filter((n) => n.sentiment === 'bearish').length;

    const categoryCounts = {
      usEtf: portfolio.filter((p) => p.category === 'US ETF').length,
      thaiStock: portfolio.filter((p) => p.category === 'Thai Stock').length,
      usStock: portfolio.filter((p) => p.category === 'US Stock').length,
      other: portfolio.filter(
        (p) => p.category === 'Crypto' || p.category === 'Commodity' || p.category === 'Forex'
      ).length,
    };

    return {
      eventImpacts,
      newsImpacts,
      todayEvents,
      matchedUpcoming,
      matchedToday,
      directUpcomingCount,
      indirectOnlyUpcomingCount,
      upcomingEarningsCount,
      upcomingXDCount,
      matchedHighSeverity,
      matchedNews,
      bullishNews,
      bearishNews,
      categoryCounts,
    };
  }, [calendarEvents, newsItems, earningsRecords, dividendRecords, portfolio, portfolioMap]);

  const featuredTodayEvents = useMemo(() => {
    return [...analyzed.todayEvents]
      .sort((a, b) => {
        const aImp = analyzed.eventImpacts.get(a.id) ?? [];
        const bImp = analyzed.eventImpacts.get(b.id) ?? [];
        const aDirect = aImp.some((i) => i.relation === 'direct') ? 2 : aImp.length > 0 ? 1 : 0;
        const bDirect = bImp.some((i) => i.relation === 'direct') ? 2 : bImp.length > 0 ? 1 : 0;
        if (bDirect !== aDirect) return bDirect - aDirect;
        if (b.impact !== a.impact) return b.impact - a.impact;
        return a.time.localeCompare(b.time);
      })
      .slice(0, 6);
  }, [analyzed.todayEvents, analyzed.eventImpacts]);

  const featuredNews = useMemo(() => {
    return [...newsItems]
      .sort((a, b) => {
        const aImp = analyzed.newsImpacts.get(a.id)?.length ?? 0;
        const bImp = analyzed.newsImpacts.get(b.id)?.length ?? 0;
        return bImp - aImp;
      })
      .slice(0, 5);
  }, [newsItems, analyzed.newsImpacts]);

  const riskAlerts = useMemo(
    () => alerts.filter((a) => a.category === 'risk_warning'),
    [alerts]
  );

  const soonXdAlerts = useMemo(
    () =>
      dividendRecords.filter(
        (d) =>
          d.applicable &&
          d.xdStatus === 'announced' &&
          typeof d.daysUntilXD === 'number' &&
          d.daysUntilXD >= 0 &&
          d.daysUntilXD <= 7
      ),
    [dividendRecords]
  );

  const totalAlerts = analyzed.matchedUpcoming.length + analyzed.matchedNews.length;

  return (
    <div className="space-y-6">
      {/* Live Searching Banner */}
      {isLoadingMarket && (
        <LiveSearchingBanner message="กำลังค้นหาข้อมูลปฏิทินเศรษฐกิจ ข่าวโลก และ Fear & Greed Index จริงล่าสุดจาก Google Search..." />
      )}
      {/* Risk Warning Alert Strip (shown immediately if high risk detected) */}
      {riskAlerts.length > 0 && (
        <section
          aria-label="คำเตือนความเสี่ยงเร่งด่วน"
          className="bg-rose-500/10 border border-rose-500/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <div className="text-xs font-semibold text-rose-300">
                คำเตือนความเสี่ยงให้ระวัง ({riskAlerts.length} ประเด็น)
              </div>
              <p className="text-sm font-semibold text-slate-100 mt-0.5">
                {riskAlerts[0].title}
              </p>
              <p className="text-xs text-rose-200/85 mt-0.5 leading-relaxed">
                {riskAlerts[0].body}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              onNavigate(riskAlerts[0].targetTab, {
                newsSubTab: riskAlerts[0].targetNewsSubTab,
                onlyPortfolio: true,
              })
            }
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-500/20 border border-rose-400/40 text-rose-100 hover:bg-rose-500/30 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            ตรวจสอบรายละเอียด
          </button>
        </section>
      )}

      {/* Smart Alert Banner */}
      <section
        aria-label="สรุปการแจ้งเตือนกระทบพอร์ตโฟลิโอ"
        className="bg-gradient-to-r from-amber-500/12 via-[#141A24] to-[#10151E] border border-amber-500/35 rounded-xl p-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-amber-300 font-medium">
                <span>Smart Portfolio Alert</span>
                <span aria-hidden="true">·</span>
                <span>
                  {portfolio.length > 0
                    ? `วิเคราะห์จากพอร์ตจริงของคุณ (${portfolio.length} สินทรัพย์)`
                    : 'ยังไม่มีสินทรัพย์ในพอร์ต'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-slate-100 mt-1">
                {portfolio.length === 0
                  ? 'เริ่มเพิ่มสินทรัพย์จริงในพอร์ตของคุณ เพื่อเปิดระบบวิเคราะห์ทิศทาง งบการเงิน วัน XD และแจ้งเตือนความเสี่ยงอัตโนมัติ'
                  : totalAlerts > 0
                  ? `พบ ${analyzed.matchedToday.length} เหตุการณ์วันนี้ และ ${analyzed.matchedUpcoming.length} รายการใน 14 วัน พร้อม ${analyzed.matchedNews.length} ข่าวเชื่อมโยงพอร์ต`
                  : 'ยังไม่พบเหตุการณ์เร่งด่วนที่กระทบสินทรัพย์ในพอร์ตของคุณในช่วง 14 วันนี้'}
              </h2>
              {portfolio.length > 0 ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300 mt-1.5">
                  <span>
                    กระทบทางตรง:{' '}
                    <strong className="font-mono tabular-nums text-amber-300">
                      {analyzed.directUpcomingCount}
                    </strong>
                  </span>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span>
                    งบใน 7 วัน:{' '}
                    <strong className="font-mono tabular-nums text-sky-300">
                      {analyzed.upcomingEarningsCount}
                    </strong>
                  </span>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span>
                    ขึ้น XD ใน 7 วัน:{' '}
                    <strong className="font-mono tabular-nums text-emerald-300">
                      {analyzed.upcomingXDCount}
                    </strong>
                  </span>
                  {soonXdAlerts.length > 0 && (
                    <>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span className="text-emerald-300 font-medium">
                        {soonXdAlerts[0].symbol}{' '}
                        {soonXdAlerts[0].daysUntilXD === 0
                          ? 'XD วันนี้!'
                          : `อีก ${soonXdAlerts[0].daysUntilXD} วัน XD`}
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 mt-1">
                  รองรับ US ETF (QQQM, SMH, BLOK, GLD, SLV, VOO, JPST), หุ้นไทย (KCG, PTT, CPALL, DELTA) และพิมพ์ Ticker อิสระให้ AI จำแนกอัตโนมัติ
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {portfolio.length === 0 ? (
              <button
                type="button"
                onClick={() => onNavigate('portfolio')}
                className="px-4 py-2.5 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ เพิ่มสินทรัพย์ในพอร์ต</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate('calendar', { onlyPortfolio: true })}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>ปฏิทินกระทบพอร์ต</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('earnings')}
                  className="px-3.5 py-2 text-xs font-medium rounded-lg bg-[#161E2B] text-slate-200 border border-[#273245] hover:border-emerald-500/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  งบการเงิน &amp; วัน XD
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 4-Column KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#10151E] border border-[#1E2634] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>สินทรัพย์ในพอร์ตจริง</span>
            <Briefcase className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-2">
            {portfolio.length}
          </div>
          <div className="text-xs text-slate-400 mt-1.5 truncate">
            {portfolio.length === 0
              ? 'พอร์ตว่าง — กดเพิ่มสินทรัพย์เพื่อเริ่มต้น'
              : `US ETF ${analyzed.categoryCounts.usEtf} · หุ้นไทย ${analyzed.categoryCounts.thaiStock} · หุ้นสหรัฐฯ ${analyzed.categoryCounts.usStock} · อื่นๆ ${analyzed.categoryCounts.other}`}
          </div>
        </div>

        <div className="bg-[#10151E] border border-[#1E2634] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>ปฏิทินเชื่อมโยงพอร์ต (14 วัน)</span>
            <CalendarClock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-300 mt-2">
            {analyzed.matchedUpcoming.length}
          </div>
          <div className="text-xs text-slate-400 mt-1.5">
            ผลกระทบมาก{' '}
            <span className="font-mono tabular-nums text-rose-400 font-medium">
              {analyzed.matchedHighSeverity.length}
            </span>{' '}
            รายการ
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('earnings')}
          className="text-left bg-[#10151E] border border-[#1E2634] hover:border-emerald-500/40 rounded-xl p-4 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>งบการเงิน &amp; ปันผล XD (7 วัน)</span>
            <BarChart3 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-2">
            {analyzed.upcomingEarningsCount + analyzed.upcomingXDCount}
          </div>
          <div className="text-xs text-slate-400 mt-1.5">
            งบใกล้ประกาศ {analyzed.upcomingEarningsCount} · ขึ้น XD {analyzed.upcomingXDCount}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('news', { newsSubTab: 'social' })}
          className="text-left bg-[#10151E] border border-[#1E2634] hover:border-sky-500/40 rounded-xl p-4 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>ข่าวโลก &amp; โซเชียลเชื่อมโยงพอร์ต</span>
            <Newspaper className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-2">
            {analyzed.matchedNews.length}
          </div>
          <div className="text-xs mt-1.5 flex items-center gap-2">
            <span className="text-emerald-400 font-mono tabular-nums">
              เชิงบวก {analyzed.bullishNews}
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="text-rose-400 font-mono tabular-nums">
              เชิงลบ {analyzed.bearishNews}
            </span>
          </div>
        </button>
      </section>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 8 Columns: Today's Calendar + Latest Global News */}
        <div className="xl:col-span-8 space-y-6">
          {/* Today's Key Calendar */}
          <section className="bg-[#10151E] border border-[#1E2634] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1E2634] flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  ปฏิทินสำคัญวันนี้ &amp; คาดการณ์ทิศทางสินทรัพย์
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  แสดงธงชาติและทิศทาง 🟢 ขึ้น / 🔴 ลง / ⚪ คงที่ ตามพอร์ตจริงของคุณ · เวลาไทย (ICT)
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('calendar')}
                className="text-xs font-medium text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>ดูปฏิทิน 14 วัน</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {isLoadingMarket && calendarEvents.length === 0 ? (
              <CalendarRowsSkeleton rows={5} />
            ) : !isLoadingMarket && marketError && calendarEvents.length === 0 ? (
              <div className="py-10 px-5 text-center space-y-3">
                <AlertCircle className="w-5 h-5 text-rose-400 mx-auto" />
                <p className="text-xs text-rose-200 max-w-md mx-auto">{marketError}</p>
                <button
                  type="button"
                  onClick={onRetryMarket}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>ลองค้นหาใหม่</span>
                </button>
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1E2634] text-[11px] font-medium text-slate-400 bg-[#0D121A]">
                    <th className="py-2.5 px-4 whitespace-nowrap">เวลา</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">ประเทศ</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">สำคัญ</th>
                    <th className="py-2.5 px-3">เหตุการณ์ &amp; ทิศทางสินทรัพย์</th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">จริง / คาดการณ์</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2230]">
                  {featuredTodayEvents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                        ไม่มีกำหนดการประกาศตัวเลขสำคัญสำหรับวันนี้ (กดดูปฏิทิน 14 วันเพื่อดูรายการใกล้เคียง)
                      </td>
                    </tr>
                  ) : (
                    featuredTodayEvents.map((ev) => {
                      const impacts = analyzed.eventImpacts.get(ev.id) ?? [];
                      const directions = computeEventAssetDirections(
                        ev,
                        portfolio,
                        portfolioMap,
                        impacts
                      );
                      const directCount = impacts.filter((i) => i.relation === 'direct').length;
                      const indirectCount = impacts.length - directCount;
                      const isMatched = impacts.length > 0;
                      const isReleased = ev.actualOutcome !== 'pending' && ev.actual !== '—';

                      return (
                        <tr
                          key={ev.id}
                          onClick={() => onNavigate('calendar')}
                          className={`transition-colors cursor-pointer ${
                            directCount > 0
                              ? 'bg-amber-500/[0.06] hover:bg-amber-500/[0.11]'
                              : indirectCount > 0
                              ? 'bg-sky-500/[0.04] hover:bg-sky-500/[0.08]'
                              : 'hover:bg-[#151C28]'
                          }`}
                        >
                          <td className="py-3 px-4 align-top whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {isMatched && (
                                <span
                                  className={`w-1 h-4 rounded-full shrink-0 ${
                                    directCount > 0 ? 'bg-amber-400' : 'bg-sky-400'
                                  }`}
                                  aria-hidden="true"
                                />
                              )}
                              <span className="font-mono tabular-nums text-xs font-medium text-slate-200">
                                {ev.time}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 align-top whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-200">
                              <span className="text-sm">{ev.flag}</span>
                              <span>{ev.countryNameTh}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3 align-top">
                            <ImpactRating level={ev.impact} showLabel={false} />
                          </td>
                          <td className="py-3 px-3 align-top min-w-[260px]">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs sm:text-sm font-medium text-slate-100 leading-snug">
                                {ev.title}
                              </span>
                              {isMatched && (
                                <PortfolioMatchBadge
                                  directCount={directCount}
                                  indirectCount={indirectCount}
                                />
                              )}
                            </div>
                            <AssetDirectionForecastList
                              forecasts={directions}
                              isReleased={isReleased}
                              compact
                            />
                          </td>
                          <td className="py-3 px-4 align-top text-right whitespace-nowrap font-mono tabular-nums text-xs">
                            <div
                              className={
                                ev.actualOutcome === 'better'
                                  ? 'text-emerald-400 font-semibold'
                                  : ev.actualOutcome === 'worse'
                                  ? 'text-rose-400 font-semibold'
                                  : 'text-slate-200 font-medium'
                              }
                            >
                              {ev.actual}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              คาด {ev.forecast}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            )}
          </section>

          {/* Latest Global News Preview */}
          <section className="bg-[#10151E] border border-[#1E2634] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1E2634] flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  ข่าวเด่นเศรษฐกิจและการลงทุนล่าสุด
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  ระบุทิศทาง Bullish / Bearish พร้อมวิเคราะห์ผลกระทบทางตรงและทางอ้อมต่อพอร์ต
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => onNavigate('news', { newsSubTab: 'social' })}
                  className="text-xs font-medium text-sky-400 hover:text-sky-300 whitespace-nowrap cursor-pointer"
                >
                  ฟีดโซเชียล X/FB/YT
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('news', { newsSubTab: 'global' })}
                  className="text-xs font-medium text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  <span>ดูข่าวทั้งหมด</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {isLoadingMarket && newsItems.length === 0 ? (
              <div className="p-4">
                <NewsCardsSkeleton cards={2} />
              </div>
            ) : featuredNews.length === 0 ? (
              <div className="py-10 px-5 text-center space-y-2.5">
                <p className="text-xs text-slate-400">
                  {marketError || 'ยังไม่มีข่าวสดในขณะนี้ กดอัปเดตเพื่อค้นหาข่าวจริงล่าสุด'}
                </p>
                <button
                  type="button"
                  onClick={onRetryMarket}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#161E2B] border border-[#283549] text-slate-200 hover:border-amber-500/50 cursor-pointer"
                >
                  ค้นหาข่าวล่าสุด
                </button>
              </div>
            ) : (
            <div className="divide-y divide-[#1A2230]">
              {featuredNews.map((item) => {
                const impacts = analyzed.newsImpacts.get(item.id) ?? [];
                const directCount = impacts.filter((i) => i.relation === 'direct').length;
                const indirectCount = impacts.length - directCount;
                const isMatched = impacts.length > 0;
                return (
                  <article
                    key={item.id}
                    onClick={() => onNavigate('news', { newsSubTab: 'global' })}
                    className={`p-4 sm:px-5 transition-colors cursor-pointer ${
                      directCount > 0
                        ? 'bg-amber-500/[0.05] hover:bg-amber-500/[0.1]'
                        : indirectCount > 0
                        ? 'bg-sky-500/[0.04] hover:bg-sky-500/[0.08]'
                        : 'hover:bg-[#151C28]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        {isMatched && (
                          <span
                            className={`w-1 h-3.5 rounded-full shrink-0 ${
                              directCount > 0 ? 'bg-amber-400' : 'bg-sky-400'
                            }`}
                            aria-hidden="true"
                          />
                        )}
                        <span className="font-mono tabular-nums">{item.timeLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-300 font-medium">
                          {item.countryFlag || '🌐'} {item.source}
                        </span>
                        {isMatched && (
                          <PortfolioMatchBadge
                            directCount={directCount}
                            indirectCount={indirectCount}
                          />
                        )}
                      </div>
                      <SentimentIndicator sentiment={item.sentiment} />
                    </div>
                    <h3 className="text-sm font-medium text-slate-100 leading-snug">
                      {item.headline}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {item.impactSummary}
                    </p>
                    {isMatched ? (
                      <PortfolioImpactMatrix impacts={impacts} compact />
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                        {item.relatedAssets.map((tag) => (
                          <AssetTickerTag key={tag} symbol={tag} matched={false} />
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            )}
          </section>
        </div>

        {/* Right 4 Columns: Fear & Greed + XD Countdown + Portfolio Watchlist */}
        <div className="xl:col-span-4 space-y-6">
          {fearGreed ? (
            <FearGreedGauge data={fearGreed} />
          ) : isLoadingMarket ? (
            <FearGreedSkeleton />
          ) : (
            <section className="bg-[#10151E] border border-[#1E2634] rounded-xl p-5 text-center space-y-3">
              <h2 className="text-base font-semibold text-slate-100">
                ดัชนีความกลัวและความโลภ (Fear &amp; Greed)
              </h2>
              <p className="text-xs text-slate-400">
                {marketError || 'ยังไม่ได้ดึงค่า CNN Fear & Greed Index ล่าสุดจาก Google Search'}
              </p>
              <button
                type="button"
                onClick={onRetryMarket}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>ดึงค่าจริงล่าสุด</span>
              </button>
            </section>
          )}

          {/* Upcoming XD Quick Widget */}
          {soonXdAlerts.length > 0 && (
            <section className="bg-[#10151E] border border-emerald-500/35 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#1E2634] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-slate-100">
                    ใกล้ขึ้นเครื่องหมาย XD
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('earnings')}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
                >
                  ดูทั้งหมด
                </button>
              </div>
              <div className="divide-y divide-[#1A2230]">
                {soonXdAlerts.slice(0, 4).map((d) => (
                  <div
                    key={d.id}
                    onClick={() => onNavigate('earnings')}
                    className="px-5 py-3 hover:bg-[#151C28] flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-bold text-slate-100 flex items-center gap-1.5">
                        <span>{d.flag}</span>
                        <span>{d.symbol}</span>
                        <span className="font-sans font-normal text-slate-400">
                          · {d.dps}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        XD {formatThaiShortDate(d.xdDate)} · Yield {d.dividendYield}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 whitespace-nowrap shrink-0">
                      {d.daysUntilXD === 0 ? 'วันนี้ XD' : `อีก ${d.daysUntilXD} วัน XD`}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Portfolio Quick Summary */}
          <section className="bg-[#10151E] border border-[#1E2634] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1E2634] flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  พอร์ตโฟลิโอของคุณ
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  สถานะการเชื่อมโยงปฏิทินและข่าวของแต่ละสินทรัพย์
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('portfolio')}
                className="text-xs font-medium text-amber-400 hover:text-amber-300 whitespace-nowrap shrink-0 cursor-pointer"
              >
                จัดการพอร์ต
              </button>
            </div>

            {portfolio.length === 0 ? (
              <div className="p-6 text-center space-y-3">
                <p className="text-sm text-slate-300 font-medium">
                  พอร์ตโฟลิโอของคุณยังว่างอยู่
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  เพิ่ม US ETF หรือหุ้นไทยที่คุณถือครอง เพื่อรับการวิเคราะห์ผลกระทบ งบ และวัน XD เฉพาะพอร์ตของคุณ
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('portfolio')}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ เพิ่มสินทรัพย์ในพอร์ต</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#1A2230]">
                {portfolio.map((asset) => {
                  const alert = getAlertsForAsset(asset, calendarEvents, newsItems);
                  return (
                    <div
                      key={asset.id}
                      onClick={() => onNavigate('portfolio')}
                      className="px-5 py-3 hover:bg-[#151C28] transition-colors cursor-pointer flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{asset.flag}</span>
                          <span className="font-mono text-sm font-semibold text-slate-100">
                            {asset.symbol}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {asset.category}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 truncate mt-0.5">
                          {asset.name}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex flex-col items-end gap-1">
                          {alert.earningsCount > 0 && (
                            <span className="text-[11px] font-medium text-sky-300 bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 rounded whitespace-nowrap">
                              งบ {alert.nextEventDate ? formatThaiShortDate(alert.nextEventDate) : ''}
                            </span>
                          )}
                          {alert.dividendCount > 0 && (
                            <span className="text-[11px] font-medium text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded whitespace-nowrap">
                              ปันผล XD
                            </span>
                          )}
                          {alert.earningsCount === 0 &&
                            alert.dividendCount === 0 &&
                            alert.economicDirectCount > 0 && (
                              <span className="text-[11px] font-medium text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded whitespace-nowrap">
                                กระทบทางตรง {alert.economicDirectCount}
                              </span>
                            )}
                          {alert.earningsCount === 0 &&
                            alert.dividendCount === 0 &&
                            alert.economicDirectCount === 0 &&
                            alert.economicIndirectCount > 0 && (
                              <span className="text-[11px] font-medium text-sky-300 bg-sky-500/12 border border-sky-500/30 px-1.5 py-0.5 rounded whitespace-nowrap">
                                ทางอ้อม {alert.economicIndirectCount}
                              </span>
                            )}
                          {alert.earningsCount === 0 &&
                            alert.dividendCount === 0 &&
                            alert.economicDirectCount === 0 &&
                            alert.economicIndirectCount === 0 && (
                              <span className="text-[11px] text-slate-500">ปกติ</span>
                            )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
