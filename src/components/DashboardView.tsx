import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CalendarClock,
  Newspaper,
  TrendingUp,
} from 'lucide-react';
import {
  CalendarEvent,
  FearGreedData,
  NavTab,
  NewsItem,
  PortfolioAsset,
} from '../types';
import {
  formatThaiShortDate,
  getAlertsForAsset,
  getDayDiffFromToday,
  getMatchedPortfolioSymbols,
  isAssetTagMatched,
} from '../utils/portfolioMatcher';
import {
  AssetTickerTag,
  ImpactRating,
  PortfolioMatchBadge,
  SentimentIndicator,
} from './ImpactRating';
import { FearGreedGauge } from './FearGreedGauge';

interface DashboardViewProps {
  portfolio: PortfolioAsset[];
  portfolioMap: Map<string, string>;
  calendarEvents: CalendarEvent[];
  newsItems: NewsItem[];
  fearGreed: FearGreedData;
  onNavigate: (tab: NavTab, options?: { onlyPortfolio?: boolean; searchQuery?: string }) => void;
}

export function DashboardView({
  portfolio,
  portfolioMap,
  calendarEvents,
  newsItems,
  fearGreed,
  onNavigate,
}: DashboardViewProps) {
  const stats = useMemo(() => {
    const upcoming14d = calendarEvents.filter((ev) => {
      const diff = getDayDiffFromToday(ev.date);
      return diff >= 0 && diff <= 14;
    });

    const todayEvents = calendarEvents.filter((ev) => getDayDiffFromToday(ev.date) === 0);

    const matchedUpcoming = upcoming14d.filter(
      (ev) => getMatchedPortfolioSymbols(ev.relatedAssets, portfolioMap).length > 0
    );
    const matchedToday = todayEvents.filter(
      (ev) => getMatchedPortfolioSymbols(ev.relatedAssets, portfolioMap).length > 0
    );
    const matchedEarnings = matchedUpcoming.filter((ev) => ev.category === 'earnings');
    const matchedDividends = matchedUpcoming.filter((ev) => ev.category === 'dividend');
    const matchedHighImpact = matchedUpcoming.filter((ev) => ev.impact === 3);

    const matchedNews = newsItems.filter(
      (n) => getMatchedPortfolioSymbols(n.relatedAssets, portfolioMap).length > 0
    );
    const bullishNews = matchedNews.filter((n) => n.sentiment === 'bullish').length;
    const bearishNews = matchedNews.filter((n) => n.sentiment === 'bearish').length;

    const categoryCounts = {
      Stock: portfolio.filter((p) => p.category === 'Stock').length,
      ETF: portfolio.filter((p) => p.category === 'ETF').length,
      Crypto: portfolio.filter((p) => p.category === 'Crypto').length,
      Forex: portfolio.filter((p) => p.category === 'Forex').length,
    };

    return {
      todayEvents,
      matchedUpcoming,
      matchedToday,
      matchedEarnings,
      matchedDividends,
      matchedHighImpact,
      matchedNews,
      bullishNews,
      bearishNews,
      categoryCounts,
    };
  }, [calendarEvents, newsItems, portfolio, portfolioMap]);

  const featuredTodayEvents = useMemo(() => {
    return [...stats.todayEvents]
      .sort((a, b) => {
        const aMatch = getMatchedPortfolioSymbols(a.relatedAssets, portfolioMap).length > 0 ? 1 : 0;
        const bMatch = getMatchedPortfolioSymbols(b.relatedAssets, portfolioMap).length > 0 ? 1 : 0;
        if (bMatch !== aMatch) return bMatch - aMatch;
        if (b.impact !== a.impact) return b.impact - a.impact;
        return a.time.localeCompare(b.time);
      })
      .slice(0, 6);
  }, [stats.todayEvents, portfolioMap]);

  const featuredNews = useMemo(() => {
    return [...newsItems]
      .sort((a, b) => {
        const aMatch = getMatchedPortfolioSymbols(a.relatedAssets, portfolioMap).length > 0 ? 1 : 0;
        const bMatch = getMatchedPortfolioSymbols(b.relatedAssets, portfolioMap).length > 0 ? 1 : 0;
        return bMatch - aMatch;
      })
      .slice(0, 5);
  }, [newsItems, portfolioMap]);

  const totalAlerts = stats.matchedUpcoming.length + stats.matchedNews.length;

  return (
    <div className="space-y-6">
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
                <span>อัปเดตอัตโนมัติตามพอร์ต {portfolio.length} สินทรัพย์</span>
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-slate-100 mt-1">
                {portfolio.length === 0
                  ? 'ยังไม่มีสินทรัพย์ในพอร์ตโฟลิโอ — เพิ่มหุ้น ETF หรือคริปโตเพื่อเปิดระบบจับคู่ข่าวอัตโนมัติ'
                  : totalAlerts > 0
                  ? `พบ ${stats.matchedToday.length} เหตุการณ์วันนี้ และ ${stats.matchedUpcoming.length} รายการใน 14 วันข้างหน้า พร้อม ${stats.matchedNews.length} ข่าวสำคัญที่กระทบพอร์ตของคุณ`
                  : 'ยังไม่มีเหตุการณ์เร่งด่วนที่กระทบสินทรัพย์ในพอร์ตของคุณในช่วง 14 วันนี้'}
              </h2>
              {portfolio.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300 mt-1.5">
                  <span>
                    ตัวเลขเศรษฐกิจสำคัญ:{' '}
                    <strong className="font-mono tabular-nums text-amber-300">
                      {stats.matchedUpcoming.filter((e) => e.category === 'economic').length}
                    </strong>
                  </span>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span>
                    ประกาศงบ (Earnings):{' '}
                    <strong className="font-mono tabular-nums text-sky-300">
                      {stats.matchedEarnings.length}
                    </strong>
                  </span>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span>
                    ขึ้นเครื่องหมายปันผล (XD):{' '}
                    <strong className="font-mono tabular-nums text-emerald-300">
                      {stats.matchedDividends.length}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('calendar', { onlyPortfolio: true })}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>ดูปฏิทินกระทบพอร์ต</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('news', { onlyPortfolio: true })}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-[#161E2B] text-slate-200 border border-[#273245] hover:bg-[#1D2738] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              ดูข่าวกระทบพอร์ต ({stats.matchedNews.length})
            </button>
          </div>
        </div>
      </section>

      {/* 4-Column KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#10151E] border border-[#1E2634] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>สินทรัพย์ในพอร์ตทั้งหมด</span>
            <Briefcase className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-2">
            {portfolio.length}
          </div>
          <div className="text-xs text-slate-400 mt-1.5 truncate">
            หุ้น {stats.categoryCounts.Stock} · ETF {stats.categoryCounts.ETF} · คริปโต {stats.categoryCounts.Crypto} · FX {stats.categoryCounts.Forex}
          </div>
        </div>

        <div className="bg-[#10151E] border border-[#1E2634] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>ปฏิทินกระทบพอร์ต (14 วัน)</span>
            <CalendarClock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-300 mt-2">
            {stats.matchedUpcoming.length}
          </div>
          <div className="text-xs text-slate-400 mt-1.5">
            ความสำคัญระดับสูง{' '}
            <span className="font-mono tabular-nums text-rose-400 font-medium">
              {stats.matchedHighImpact.length}
            </span>{' '}
            รายการ
          </div>
        </div>

        <div className="bg-[#10151E] border border-[#1E2634] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>ประกาศงบ &amp; ปันผล XD</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-2">
            {stats.matchedEarnings.length + stats.matchedDividends.length}
          </div>
          <div className="text-xs text-slate-400 mt-1.5">
            งบการเงิน {stats.matchedEarnings.length} · ขึ้น XD ปันผล {stats.matchedDividends.length}
          </div>
        </div>

        <div className="bg-[#10151E] border border-[#1E2634] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>ข่าวสารกระทบพอร์ตล่าสุด</span>
            <Newspaper className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-2">
            {stats.matchedNews.length}
          </div>
          <div className="text-xs mt-1.5 flex items-center gap-2">
            <span className="text-emerald-400 font-mono tabular-nums">
              เชิงบวก {stats.bullishNews}
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="text-rose-400 font-mono tabular-nums">
              เชิงลบ {stats.bearishNews}
            </span>
          </div>
        </div>
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
                  ปฏิทินสำคัญวันนี้
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  เรียงลำดับตามรายการที่กระทบพอร์ตและระดับความสำคัญ · เวลาไทย (ICT)
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

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1E2634] text-[11px] font-medium text-slate-400 bg-[#0D121A]">
                    <th className="py-2.5 px-4 whitespace-nowrap">เวลา</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">สกุลเงิน</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">สำคัญ</th>
                    <th className="py-2.5 px-3">เหตุการณ์</th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">จริง / คาดการณ์</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2230]">
                  {featuredTodayEvents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                        ไม่มีกำหนดการประกาศตัวเลขสำคัญสำหรับวันนี้
                      </td>
                    </tr>
                  ) : (
                    featuredTodayEvents.map((ev) => {
                      const matched = getMatchedPortfolioSymbols(ev.relatedAssets, portfolioMap);
                      const isMatched = matched.length > 0;
                      return (
                        <tr
                          key={ev.id}
                          onClick={() => onNavigate('calendar')}
                          className={`transition-colors cursor-pointer ${
                            isMatched
                              ? 'bg-amber-500/[0.06] hover:bg-amber-500/[0.11]'
                              : 'hover:bg-[#151C28]'
                          }`}
                        >
                          <td className="py-3 px-4 align-top whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {isMatched && (
                                <span
                                  className="w-1 h-4 rounded-full bg-amber-400 shrink-0"
                                  aria-hidden="true"
                                />
                              )}
                              <span className="font-mono tabular-nums text-xs font-medium text-slate-200">
                                {ev.time}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 align-top whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-200">
                              <span>{ev.flag}</span>
                              <span>{ev.currency}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3 align-top">
                            <ImpactRating level={ev.impact} showLabel={false} />
                          </td>
                          <td className="py-3 px-3 align-top min-w-[220px]">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs sm:text-sm font-medium text-slate-100 leading-snug">
                                {ev.title}
                              </span>
                              {isMatched && <PortfolioMatchBadge />}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              {ev.relatedAssets.slice(0, 4).map((tag) => (
                                <AssetTickerTag
                                  key={tag}
                                  symbol={tag}
                                  matched={isAssetTagMatched(tag, portfolioMap)}
                                />
                              ))}
                            </div>
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
          </section>

          {/* Latest Global News Preview */}
          <section className="bg-[#10151E] border border-[#1E2634] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1E2634] flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  ข่าวเด่นเศรษฐกิจและการลงทุนล่าสุด
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  วิเคราะห์ทิศทางผลกระทบ Bullish / Bearish ต่อสินทรัพย์ในพอร์ต
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('news')}
                className="text-xs font-medium text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>ดูข่าวทั้งหมด</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-[#1A2230]">
              {featuredNews.map((item) => {
                const matched = getMatchedPortfolioSymbols(item.relatedAssets, portfolioMap);
                const isMatched = matched.length > 0;
                return (
                  <article
                    key={item.id}
                    onClick={() => onNavigate('news')}
                    className={`p-4 sm:px-5 transition-colors cursor-pointer ${
                      isMatched
                        ? 'bg-amber-500/[0.05] hover:bg-amber-500/[0.1]'
                        : 'hover:bg-[#151C28]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        {isMatched && (
                          <span
                            className="w-1 h-3.5 rounded-full bg-amber-400 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                        <span className="font-mono tabular-nums">{item.timeLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-300 font-medium">{item.source}</span>
                        {isMatched && <PortfolioMatchBadge />}
                      </div>
                      <SentimentIndicator sentiment={item.sentiment} />
                    </div>
                    <h3 className="text-sm font-medium text-slate-100 leading-snug">
                      {item.headline}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {item.impactSummary}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                      {item.relatedAssets.map((tag) => (
                        <AssetTickerTag
                          key={tag}
                          symbol={tag}
                          matched={isAssetTagMatched(tag, portfolioMap)}
                        />
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right 4 Columns: Fear & Greed + Portfolio Watchlist Summary */}
        <div className="xl:col-span-4 space-y-6">
          <FearGreedGauge data={fearGreed} />

          {/* Portfolio Quick Summary */}
          <section className="bg-[#10151E] border border-[#1E2634] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1E2634] flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  พอร์ตโฟลิโอของคุณ
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  สถานะแจ้งเตือนงบการเงิน ปันผล XD และข่าวด่วน
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
              <div className="p-6 text-center">
                <p className="text-sm text-slate-400">ยังไม่มีสินทรัพย์ในพอร์ต</p>
                <button
                  type="button"
                  onClick={() => onNavigate('portfolio')}
                  className="mt-3 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
                >
                  เพิ่มสินทรัพย์แรกของคุณ
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#1A2230]">
                {portfolio.map((asset) => {
                  const alert = getAlertsForAsset(asset.symbol, calendarEvents, newsItems);
                  const hasSpecialAlert =
                    alert.earningsCount > 0 || alert.dividendCount > 0 || alert.newsCount > 0;
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
                        {hasSpecialAlert ? (
                          <div className="flex flex-col items-end gap-1">
                            {alert.earningsCount > 0 && (
                              <span className="text-[11px] font-medium text-sky-300 bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 rounded whitespace-nowrap">
                                งบการเงิน {alert.nextEventDate ? formatThaiShortDate(alert.nextEventDate) : ''}
                              </span>
                            )}
                            {alert.dividendCount > 0 && (
                              <span className="text-[11px] font-medium text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded whitespace-nowrap">
                                ปันผล XD
                              </span>
                            )}
                            {alert.earningsCount === 0 &&
                              alert.dividendCount === 0 &&
                              alert.newsCount > 0 && (
                                <span className="text-[11px] font-medium text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded whitespace-nowrap">
                                  {alert.newsCount} ข่าวเกี่ยวข้อง
                                </span>
                              )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500">ปกติ</span>
                        )}
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
