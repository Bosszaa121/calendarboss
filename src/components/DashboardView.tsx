import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Coins,
  Plus,
  RefreshCw,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  AppAlert,
  CalendarEvent,
  ChartTargetAsset,
  DividendXDRecord,
  EarningsRecord,
  FearGreedData,
  LiveAssetQuote,
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
import { formatCurrencyPrice } from '../utils/technicalAnalysis';
import {
  AssetDirectionForecastList,
  ImpactRating,
  PortfolioImpactMatrix,
  PortfolioMatchBadge,
  SentimentIndicator,
} from './ImpactRating';
import { FearGreedGauge } from './FearGreedGauge';
import {
  CalendarRowsSkeleton,
  LiveSearchingBanner,
  NewsCardsSkeleton,
} from './LoadingSkeletons';

interface DashboardViewProps {
  portfolio: PortfolioAsset[];
  portfolioMap: Map<string, string>;
  liveQuotes: Record<string, LiveAssetQuote>;
  calendarEvents: CalendarEvent[];
  newsItems: NewsItem[];
  earningsRecords: EarningsRecord[];
  dividendRecords: DividendXDRecord[];
  alerts: AppAlert[];
  fearGreed: FearGreedData | null;
  isLoadingMarket: boolean;
  marketError: string | null;
  onRetryMarket: () => void;
  onOpenTrendSheet: (asset: ChartTargetAsset) => void;
  onNavigate: (
    tab: NavTab,
    options?: { onlyPortfolio?: boolean; searchQuery?: string; newsSubTab?: NewsSubTab }
  ) => void;
}

export function DashboardView({
  portfolio,
  portfolioMap,
  liveQuotes,
  calendarEvents,
  newsItems,
  earningsRecords,
  dividendRecords,
  alerts,
  fearGreed,
  isLoadingMarket,
  marketError,
  onRetryMarket,
  onOpenTrendSheet,
  onNavigate,
}: DashboardViewProps) {
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  function toggleCard(id: string) {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  }

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

    const matchedNews = newsItems.filter((n) => (newsImpacts.get(n.id)?.length ?? 0) > 0);

    // Aggregate primary currency P/L summary if user recorded cost + qty
    const pnlByCurrency = new Map<string, { cost: number; value: number }>();
    for (const asset of portfolio) {
      if (!asset.averageCost || !asset.quantity) continue;
      const quote = liveQuotes[asset.symbol.toUpperCase()];
      if (!quote || quote.price === null) continue;
      const cur = (quote.currency || asset.currency || 'USD').toUpperCase();
      const prev = pnlByCurrency.get(cur) ?? { cost: 0, value: 0 };
      prev.cost += asset.averageCost * asset.quantity;
      prev.value += quote.price * asset.quantity;
      pnlByCurrency.set(cur, prev);
    }

    const currencySummaries = Array.from(pnlByCurrency.entries()).map(([currency, v]) => {
      const pnl = v.value - v.cost;
      const pnlPct = v.cost > 0 ? (pnl / v.cost) * 100 : 0;
      return { currency, cost: v.cost, value: v.value, pnl, pnlPct };
    });

    return {
      eventImpacts,
      newsImpacts,
      todayEvents,
      matchedUpcoming,
      upcomingEarningsCount,
      upcomingXDCount,
      matchedNews,
      currencySummaries,
    };
  }, [
    calendarEvents,
    newsItems,
    earningsRecords,
    dividendRecords,
    portfolio,
    portfolioMap,
    liveQuotes,
  ]);

  const featuredTodayEvents = useMemo(() => {
    return [...analyzed.todayEvents]
      .sort((a, b) => {
        const aImp = analyzed.eventImpacts.get(a.id)?.length ?? 0;
        const bImp = analyzed.eventImpacts.get(b.id)?.length ?? 0;
        if (bImp !== aImp) return bImp - aImp;
        if (b.impact !== a.impact) return b.impact - a.impact;
        return a.time.localeCompare(b.time);
      })
      .slice(0, 4);
  }, [analyzed.todayEvents, analyzed.eventImpacts]);

  const featuredNews = useMemo(() => {
    return [...newsItems]
      .sort((a, b) => {
        const aImp = analyzed.newsImpacts.get(a.id)?.length ?? 0;
        const bImp = analyzed.newsImpacts.get(b.id)?.length ?? 0;
        return bImp - aImp;
      })
      .slice(0, 4);
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

  return (
    <div className="space-y-3">
      {/* Live Searching Banner */}
      {isLoadingMarket && (
        <LiveSearchingBanner message="กำลังอัปเดตราคา ข่าว RSS ปฏิทินเศรษฐกิจ และดัชนีตลาด..." />
      )}

      {/* TOP ANCHOR: Compact Portfolio Summary + Fear & Greed Index */}
      <section className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-4 space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium text-amber-400">
              สรุปพอร์ตโฟลิโอ &amp; สภาวะตลาด
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-mono tabular-nums text-2xl font-bold text-slate-100">
                {portfolio.length}
              </span>
              <span className="text-xs text-slate-400">สินทรัพย์ที่ถือครอง</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('portfolio')}
            className="min-h-[38px] px-3 rounded-xl bg-amber-500/15 border border-amber-500/35 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {portfolio.length === 0 ? (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่มหุ้น</span>
              </>
            ) : (
              <>
                <span>จัดการพอร์ต</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        {/* Portfolio Unrealized P/L Strip (if user entered cost + qty) */}
        {analyzed.currencySummaries.length > 0 && (
          <div className="grid grid-cols-1 gap-2">
            {analyzed.currencySummaries.map((sum) => {
              const isPos = sum.pnl > 0;
              const isNeg = sum.pnl < 0;
              return (
                <div
                  key={sum.currency}
                  className="bg-[#090C11] border border-[#1B2331] rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="text-slate-400">
                    มูลค่าพอร์ต ({sum.currency}){' '}
                    <span className="font-mono tabular-nums font-semibold text-slate-100 ml-1">
                      {formatCurrencyPrice(sum.value, sum.currency)}
                    </span>
                  </div>
                  <div
                    className={`font-mono tabular-nums font-bold inline-flex items-center gap-1 shrink-0 ${
                      isPos ? 'text-emerald-400' : isNeg ? 'text-rose-400' : 'text-slate-300'
                    }`}
                  >
                    {isPos ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : isNeg ? (
                      <TrendingDown className="w-3.5 h-3.5" />
                    ) : null}
                    <span>
                      {sum.pnlPct > 0 ? '+' : ''}
                      {sum.pnlPct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Compact 3-Metric Quick Nav Strip */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onNavigate('calendar', { onlyPortfolio: true })}
            className="bg-[#090C11] border border-[#1B2331] hover:border-amber-500/40 rounded-xl p-2.5 text-left transition-colors cursor-pointer"
          >
            <div className="text-[10px] text-slate-400 truncate">ปฏิทิน 14 วัน</div>
            <div className="font-mono tabular-nums text-base font-bold text-amber-300 mt-0.5">
              {analyzed.matchedUpcoming.length}
            </div>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('earnings')}
            className="bg-[#090C11] border border-[#1B2331] hover:border-emerald-500/40 rounded-xl p-2.5 text-left transition-colors cursor-pointer"
          >
            <div className="text-[10px] text-slate-400 truncate">งบ &amp; XD (7 วัน)</div>
            <div className="font-mono tabular-nums text-base font-bold text-emerald-300 mt-0.5">
              {analyzed.upcomingEarningsCount + analyzed.upcomingXDCount}
            </div>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('news', { onlyPortfolio: true, newsSubTab: 'global' })}
            className="bg-[#090C11] border border-[#1B2331] hover:border-sky-500/40 rounded-xl p-2.5 text-left transition-colors cursor-pointer"
          >
            <div className="text-[10px] text-slate-400 truncate">ข่าวกระทบพอร์ต</div>
            <div className="font-mono tabular-nums text-base font-bold text-sky-300 mt-0.5">
              {analyzed.matchedNews.length}
            </div>
          </button>
        </div>

        {/* Compact Fear & Greed Index (Chart-free linear bar) */}
        <div className="pt-3 border-t border-[#1B2331]">
          {fearGreed ? (
            <FearGreedGauge data={fearGreed} />
          ) : (
            <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
              <span>ยังไม่ได้ดึงค่า Fear &amp; Greed ล่าสุด</span>
              <button
                type="button"
                onClick={onRetryMarket}
                className="text-amber-400 hover:text-amber-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>ดึงค่าสด</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Urgent Risk Alert Strip (if detected) */}
      {riskAlerts.length > 0 && (
        <section className="bg-rose-500/10 border border-rose-500/35 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-rose-300">
                คำเตือนความเสี่ยง ({riskAlerts.length})
              </div>
              <p className="text-sm font-semibold text-slate-100 mt-0.5 line-clamp-2">
                {riskAlerts[0].title}
              </p>
              <p className="text-xs text-rose-200/80 mt-0.5 line-clamp-2">
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
            className="w-full min-h-[40px] rounded-xl text-xs font-semibold bg-rose-500/20 border border-rose-400/40 text-rose-100 hover:bg-rose-500/30 transition-colors cursor-pointer"
          >
            ตรวจสอบรายละเอียด
          </button>
        </section>
      )}

      {/* Upcoming Official XD Strip (if any within 7 days) */}
      {soonXdAlerts.length > 0 && (
        <section className="bg-[#10151E] border border-emerald-500/35 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold text-emerald-300 inline-flex items-center gap-1.5">
              <Coins className="w-4 h-4" />
              <span>ใกล้ขึ้นเครื่องหมาย XD</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('earnings')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
            >
              ดูทั้งหมด
            </button>
          </div>
          <div className="space-y-2">
            {soonXdAlerts.slice(0, 3).map((d) => (
              <div
                key={d.id}
                onClick={() => onNavigate('earnings')}
                className="bg-[#090C11] border border-[#1B2331] rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="font-mono text-xs font-bold text-slate-100">
                    {d.flag} {d.symbol} <span className="text-slate-400 font-sans">· {d.dps}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    XD {formatThaiShortDate(d.xdDate)} · Yield {d.dividendYield}
                  </div>
                </div>
                <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 shrink-0">
                  {d.daysUntilXD === 0 ? 'วันนี้ XD' : `อีก ${d.daysUntilXD} วัน`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Portfolio Quick Glance (Single-Column Cards with Trend & Fibonacci CTA) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-sm font-bold text-slate-100">พอร์ตของฉัน</h2>
          <button
            type="button"
            onClick={() => onNavigate('portfolio')}
            className="text-xs font-medium text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>ดูทั้งหมด</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {portfolio.length === 0 ? (
          <div className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-5 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-200">พอร์ตโฟลิโอของคุณยังว่างอยู่</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              เพิ่มหุ้นไทย (KCG, PTT) หรือ US ETF / หุ้นสหรัฐฯ (QQQM, SMH, PEP, GLD) เพื่อวิเคราะห์เทรน เป้า Fibonacci และรับแจ้งเตือนงบ/XD อัตโนมัติ
            </p>
            <button
              type="button"
              onClick={() => onNavigate('portfolio')}
              className="min-h-[44px] px-5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มสินทรัพย์แรก</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {portfolio.slice(0, 5).map((asset) => {
              const quote = liveQuotes[asset.symbol.toUpperCase()];
              const currency = quote?.currency || asset.currency || 'USD';
              const alert = getAlertsForAsset(asset, calendarEvents, newsItems);
              const expanded = Boolean(expandedCards[`port-${asset.id}`]);
              const pnlPct =
                asset.averageCost && quote?.price
                  ? ((quote.price - asset.averageCost) / asset.averageCost) * 100
                  : null;

              return (
                <article
                  key={asset.id}
                  className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-4 space-y-3"
                >
                  {/* 1. Flag + Ticker + Price/% */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{asset.flag}</span>
                        <span className="font-mono text-sm font-bold text-slate-100">
                          {asset.symbol}
                        </span>
                        <span className="text-[11px] text-slate-500">{asset.market}</span>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{asset.name}</p>
                    </div>

                    <div className="text-right shrink-0">
                      {quote && quote.price !== null ? (
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

                  {/* 2. Short status line (<= 2 lines) */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {pnlPct !== null && (
                      <span
                        className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                          pnlPct >= 0
                            ? 'bg-emerald-500/12 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-500/12 border-rose-500/30 text-rose-300'
                        }`}
                      >
                        ทุน {formatCurrencyPrice(asset.averageCost!, currency)} ({pnlPct >= 0 ? '+' : ''}
                        {pnlPct.toFixed(1)}%)
                      </span>
                    )}
                    {alert.earningsCount > 0 ? (
                      <span className="text-[11px] text-sky-300">มีกำหนดประกาศงบใกล้ถึง</span>
                    ) : alert.dividendCount > 0 ? (
                      <span className="text-[11px] text-emerald-300">มีกำหนดปันผล XD</span>
                    ) : alert.economicDirectCount > 0 ? (
                      <span className="text-[11px] text-amber-300">
                        เชื่อมโยงปฏิทิน {alert.economicDirectCount} รายการ
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500">{asset.sector}</span>
                    )}
                  </div>

                  {/* 3. Primary CTA + Progressive Disclosure Toggle */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenTrendSheet({
                          symbol: asset.symbol,
                          name: asset.name,
                          category: asset.category,
                          market: asset.market,
                          flag: asset.flag,
                          currency,
                          sector: asset.sector,
                          averageCost: asset.averageCost,
                          quantity: asset.quantity,
                          portfolioId: asset.id,
                        })
                      }
                      className="flex-1 min-h-[44px] px-3 rounded-xl bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 text-amber-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Target className="w-3.5 h-3.5 shrink-0" />
                      <span>🎯 วิเคราะห์เทรน &amp; เป้า Fibonacci</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleCard(`port-${asset.id}`)}
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

                  {expanded && (
                    <div className="pt-3 border-t border-[#1B2331] space-y-2 text-xs text-slate-400">
                      <div className="flex items-center justify-between">
                        <span>หมวดหมู่ / กลุ่มอุตสาหกรรม</span>
                        <span className="text-slate-200">
                          {asset.category} · {asset.sector}
                        </span>
                      </div>
                      {asset.quantity && (
                        <div className="flex items-center justify-between">
                          <span>จำนวนหน่วยที่ถือ</span>
                          <span className="font-mono text-slate-200">
                            {asset.quantity.toLocaleString('en-US')}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate('news', {
                              searchQuery: asset.symbol,
                              newsSubTab: 'global',
                            })
                          }
                          className="text-sky-400 hover:text-sky-300 font-medium cursor-pointer"
                        >
                          ดูข่าว {asset.symbol} →
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Today's Key Calendar (Single-Column Expandable Cards) */}
      <section className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-sm font-bold text-slate-100">ปฏิทินสำคัญวันนี้</h2>
          <button
            type="button"
            onClick={() => onNavigate('calendar')}
            className="text-xs font-medium text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>ดูปฏิทิน 14 วัน</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {isLoadingMarket && calendarEvents.length === 0 ? (
          <div className="bg-[#10151E] border border-[#1E2634] rounded-2xl overflow-hidden">
            <CalendarRowsSkeleton rows={3} />
          </div>
        ) : !isLoadingMarket && marketError && calendarEvents.length === 0 ? (
          <div className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-5 text-center space-y-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 mx-auto" />
            <p className="text-xs text-rose-200">{marketError}</p>
            <button
              type="button"
              onClick={onRetryMarket}
              className="min-h-[40px] px-4 rounded-xl text-xs font-semibold bg-amber-500 text-slate-950 cursor-pointer"
            >
              ลองอัปเดตใหม่
            </button>
          </div>
        ) : featuredTodayEvents.length === 0 ? (
          <div className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-4 text-center text-xs text-slate-400">
            ไม่มีตัวเลขเศรษฐกิจสำคัญประกาศวันนี้ — แตะดูปฏิทิน 14 วัน
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {featuredTodayEvents.map((ev) => {
              const impacts = analyzed.eventImpacts.get(ev.id) ?? [];
              const directions = computeEventAssetDirections(
                ev,
                portfolio,
                portfolioMap,
                impacts
              );
              const directCount = impacts.filter((i) => i.relation === 'direct').length;
              const indirectCount = impacts.length - directCount;
              const isReleased = ev.actualOutcome !== 'pending' && ev.actual !== '—';
              const expanded = Boolean(expandedCards[`ev-${ev.id}`]);

              return (
                <article
                  key={ev.id}
                  className={`bg-[#10151E] border rounded-2xl p-4 space-y-2.5 ${
                    directCount > 0 ? 'border-amber-500/35' : 'border-[#1E2634]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-300 min-w-0">
                      <span>{ev.flag}</span>
                      <span className="font-mono tabular-nums font-semibold text-slate-100">
                        {ev.time}
                      </span>
                      <span className="text-slate-500">·</span>
                      <span className="truncate">{ev.countryNameTh}</span>
                    </div>
                    <ImpactRating level={ev.impact} showLabel={false} />
                  </div>

                  <h3 className="text-sm font-semibold text-slate-100 leading-snug line-clamp-2">
                    {ev.title}
                  </h3>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                      <span className="text-slate-400">
                        จริง: <strong className="text-slate-100">{ev.actual}</strong>
                      </span>
                      <span className="text-slate-500">คาด: {ev.forecast}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleCard(`ev-${ev.id}`)}
                      className="text-xs text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>{expanded ? 'ย่อ' : 'ดูเพิ่มเติม'}</span>
                      {expanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {expanded && (
                    <div className="pt-2.5 border-t border-[#1B2331] space-y-2">
                      {impacts.length > 0 && (
                        <PortfolioMatchBadge
                          directCount={directCount}
                          indirectCount={indirectCount}
                        />
                      )}
                      <AssetDirectionForecastList
                        forecasts={directions}
                        isReleased={isReleased}
                        compact
                      />
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
      </section>

      {/* Latest News Preview (Single-Column Expandable Cards) */}
      <section className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-sm font-bold text-slate-100">ข่าวเด่นล่าสุด</h2>
          <button
            type="button"
            onClick={() => onNavigate('news', { newsSubTab: 'global' })}
            className="text-xs font-medium text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>ดูข่าวทั้งหมด</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {isLoadingMarket && newsItems.length === 0 ? (
          <NewsCardsSkeleton cards={2} />
        ) : featuredNews.length === 0 ? (
          <div className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-4 text-center text-xs text-slate-400">
            ยังไม่มีข่าวสด — กดปุ่มอัปเดตด้านบนเพื่อดึงข่าวล่าสุด
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {featuredNews.map((item) => {
              const impacts = analyzed.newsImpacts.get(item.id) ?? [];
              const expanded = Boolean(expandedCards[`news-${item.id}`]);

              return (
                <article
                  key={item.id}
                  className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-400 truncate">
                      {item.countryFlag || '🌐'} {item.source} · {item.timeLabel}
                    </span>
                    <SentimentIndicator sentiment={item.sentiment} />
                  </div>

                  <h3 className="text-sm font-semibold text-slate-100 leading-snug line-clamp-2">
                    {item.headline}
                  </h3>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-slate-500 truncate">
                      {impacts.length > 0
                        ? `กระทบพอร์ต ${impacts.length} สินทรัพย์`
                        : item.relatedAssets.slice(0, 3).join(', ')}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleCard(`news-${item.id}`)}
                      className="text-xs text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-0.5 shrink-0 cursor-pointer"
                    >
                      <span>{expanded ? 'ย่อ' : 'ดูเพิ่มเติม'}</span>
                      {expanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {expanded && (
                    <div className="pt-2.5 border-t border-[#1B2331] space-y-2">
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {item.impactSummary}
                      </p>
                      {impacts.length > 0 && <PortfolioImpactMatrix impacts={impacts} compact />}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
