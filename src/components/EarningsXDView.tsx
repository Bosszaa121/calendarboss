import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarClock,
  Coins,
  ExternalLink,
  Info,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  DividendXDRecord,
  EarningsRecord,
  EarningsStatus,
  PortfolioAsset,
  SyncSource,
} from '../types';
import { formatThaiShortDate } from '../utils/portfolioMatcher';

interface EarningsXDViewProps {
  portfolio: PortfolioAsset[];
  earnings: EarningsRecord[];
  dividends: DividendXDRecord[];
  sources: SyncSource[];
  isSyncing: boolean;
  lastSyncedAt: string | null;
  onSyncLive: () => void;
  onGoToPortfolio: () => void;
}

const STATUS_BADGE: Record<
  EarningsStatus,
  { label: string; cls: string; icon?: 'up' | 'down' }
> = {
  beat: {
    label: 'งบดีกว่าคาด (Bullish)',
    cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    icon: 'up',
  },
  inline: {
    label: 'ตามคาด (Inline)',
    cls: 'bg-slate-700/40 text-slate-200 border-slate-600/60',
  },
  miss: {
    label: 'ต่ำกว่าคาด (Bearish)',
    cls: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    icon: 'down',
  },
  upcoming: {
    label: 'กำลังประกาศงบ',
    cls: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  },
  not_applicable: {
    label: 'ไม่มีปันผล / ไม่อิงงบการเงิน',
    cls: 'bg-[#161E2B] text-slate-400 border-[#283549]',
  },
};

export function EarningsXDView({
  portfolio,
  earnings,
  dividends,
  sources,
  isSyncing,
  lastSyncedAt,
  onSyncLive,
  onGoToPortfolio,
}: EarningsXDViewProps) {
  const [sectionTab, setSectionTab] = useState<'all' | 'earnings' | 'xd'>('all');

  const summary = useMemo(() => {
    const activeEarnings = earnings.filter((e) => e.status !== 'not_applicable');
    const soonEarnings = activeEarnings.filter(
      (e) => typeof e.daysUntil === 'number' && e.daysUntil >= 0 && e.daysUntil <= 3
    ).length;
    const beatCount = activeEarnings.filter((e) => e.status === 'beat').length;
    const upcomingXD = dividends.filter(
      (d) =>
        d.applicable &&
        typeof d.daysUntilXD === 'number' &&
        d.daysUntilXD >= 0 &&
        d.daysUntilXD <= 7
    ).length;
    const nonDividendCount = dividends.filter((d) => !d.applicable).length;
    return {
      activeEarningsCount: activeEarnings.length,
      soonEarnings,
      beatCount,
      upcomingXD,
      nonDividendCount,
    };
  }, [earnings, dividends]);

  const sortedDividends = useMemo(() => {
    return [...dividends].sort((a, b) => {
      if (a.applicable !== b.applicable) return a.applicable ? -1 : 1;
      const da = typeof a.daysUntilXD === 'number' && a.daysUntilXD >= 0 ? a.daysUntilXD : 9999;
      const db = typeof b.daysUntilXD === 'number' && b.daysUntilXD >= 0 ? b.daysUntilXD : 9999;
      return da - db;
    });
  }, [dividends]);

  const sortedEarnings = useMemo(() => {
    return [...earnings].sort((a, b) => {
      if (a.status === 'not_applicable' && b.status !== 'not_applicable') return 1;
      if (a.status !== 'not_applicable' && b.status === 'not_applicable') return -1;
      const da = typeof a.daysUntil === 'number' && a.daysUntil >= 0 ? a.daysUntil : 999;
      const db = typeof b.daysUntil === 'number' && b.daysUntil >= 0 ? b.daysUntil : 999;
      return da - db;
    });
  }, [earnings]);

  if (portfolio.length === 0) {
    return (
      <section className="bg-[#10151E] border border-[#1E2634] rounded-xl py-16 px-6 text-center max-w-2xl mx-auto space-y-4">
        <div className="w-12 h-12 rounded-xl bg-amber-500/12 border border-amber-500/30 flex items-center justify-center mx-auto">
          <BarChart3 className="w-6 h-6 text-amber-400" />
        </div>
        <h2 className="text-base sm:text-lg font-semibold text-slate-100">
          ติดตามงบการเงินและวัน XD เฉพาะพอร์ตของคุณ
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-lg mx-auto">
          เพิ่มสินทรัพย์จริงของคุณก่อน เช่น หุ้นไทย (KCG, PTT, KBANK), US ETF (QQQM, SMH, BLOK, SCHD, VOO) หรือทองคำ/คริปโต (GLD, SLV, BTC) แล้วระบบจะดึงข้อมูลงบการเงินของหุ้นหรือ Top Holdings พร้อมแจ้งเตือนนับถอยหลังวัน XD อัตโนมัติด้วย Google Search
        </p>
        <button
          type="button"
          onClick={onGoToPortfolio}
          className="px-4 py-2.5 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ เพิ่มสินทรัพย์ในพอร์ต</span>
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header Toolbar */}
      <section className="bg-[#10151E] border border-[#1E2634] rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              สรุปงบการเงิน &amp; ปฏิทินวันขึ้นเครื่องหมาย XD ของพอร์ต ({portfolio.length} สินทรัพย์)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              หุ้นรายตัวดึงงบตรงบริษัท · Equity ETF ดึงงบ Top Holdings (เช่น NVDA, TSM, AVGO, AAPL, COIN) · ดึงข้อมูลจริงผ่าน Google Search Grounding
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {lastSyncedAt && (
              <span className="text-[11px] font-mono text-slate-400">
                อัปเดตสด {lastSyncedAt} น.
              </span>
            )}
            <button
              type="button"
              onClick={onSyncLive}
              disabled={isSyncing}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-70 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>
                {isSyncing ? 'กำลังค้นหางบ & XD ล่าสุด...' : 'อัปเดตงบ & XD สด (Google Search)'}
              </span>
            </button>
          </div>
        </div>

        {/* KPI Summary + View Switch */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#1A2230]">
          <div className="flex items-center gap-1 p-1 bg-[#090C11] border border-[#1E2634] rounded-lg overflow-x-auto">
            {(
              [
                { key: 'all', label: 'แสดงทั้งหมด' },
                { key: 'earnings', label: `งบการเงิน (${summary.activeEarningsCount})` },
                { key: 'xd', label: `วัน XD & ปันผล (${dividends.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSectionTab(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sectionTab === tab.key
                    ? 'bg-[#1C2536] text-amber-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>
              งบใน 3 วัน:{' '}
              <strong className="font-mono text-sky-300">{summary.soonEarnings}</strong>
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span>
              งบดีกว่าคาด:{' '}
              <strong className="font-mono text-emerald-400">{summary.beatCount}</strong>
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span>
              XD ใน 7 วัน:{' '}
              <strong className="font-mono text-amber-300">{summary.upcomingXD}</strong>
            </span>
          </div>
        </div>
      </section>

      {/* Section 1: XD Dividend Alerts */}
      {(sectionTab === 'all' || sectionTab === 'xd') && (
        <section className="bg-[#10151E] border border-[#1E2634] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1E2634] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm sm:text-base font-semibold text-slate-100">
                แจ้งเตือนวันขึ้นเครื่องหมาย XD และปันผล (XD Alerts)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              แสดงนับถอยหลัง &quot;อีก X วัน XD&quot;
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4 sm:p-5">
            {sortedDividends.map((div) => {
              const isSoon =
                div.applicable &&
                typeof div.daysUntilXD === 'number' &&
                div.daysUntilXD >= 0 &&
                div.daysUntilXD <= 7;

              return (
                <article
                  key={div.id}
                  className={`rounded-xl border p-4 flex flex-col justify-between gap-3 ${
                    !div.applicable
                      ? 'bg-[#0C1017] border-[#1B2230] opacity-85'
                      : isSoon
                      ? 'bg-emerald-500/[0.06] border-emerald-500/40'
                      : 'bg-[#0D121A] border-[#1F293A]'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base shrink-0">{div.flag}</span>
                        <div className="min-w-0">
                          <div className="font-mono text-sm font-bold text-slate-100 flex items-center gap-1.5">
                            <span>{div.symbol}</span>
                            {div.isLiveSynced && (
                              <span className="text-[9px] font-sans font-medium text-sky-300 bg-sky-500/15 px-1.5 py-0.5 rounded">
                                สด
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">{div.name}</div>
                        </div>
                      </div>

                      {!div.applicable ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#161E2B] border border-[#283549] text-slate-400 whitespace-nowrap shrink-0">
                          ไม่มีปันผล / ไม่อิงงบการเงิน
                        </span>
                      ) : typeof div.daysUntilXD === 'number' && div.daysUntilXD >= 0 ? (
                        <span
                          className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap shrink-0 ${
                            div.daysUntilXD <= 7
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                              : 'bg-amber-500/12 text-amber-300 border-amber-500/35'
                          }`}
                        >
                          {div.daysUntilXD === 0 ? 'วันนี้ XD!' : `อีก ${div.daysUntilXD} วัน XD`}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500 whitespace-nowrap shrink-0">
                          {div.frequency || 'ปันผลตามรอบ'}
                        </span>
                      )}
                    </div>

                    {div.applicable ? (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1C2534] text-xs">
                        <div>
                          <div className="text-[10px] text-slate-500">วันที่ขึ้น XD</div>
                          <div className="font-mono text-slate-100 font-semibold mt-0.5">
                            {div.xdDate !== '—' ? formatThaiShortDate(div.xdDate) : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">ปันผลต่อหุ้น (DPS)</div>
                          <div className="font-mono text-emerald-300 font-semibold mt-0.5">
                            {div.dps}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">Dividend Yield</div>
                          <div className="font-mono text-amber-300 font-semibold mt-0.5">
                            {div.dividendYield}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">วันจ่ายเงินปันผล</div>
                          <div className="font-mono text-slate-300 mt-0.5">
                            {div.payDate !== '—' ? formatThaiShortDate(div.payDate) : '—'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-[#1B2230] flex items-start gap-2 text-xs text-slate-400">
                        <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                        <p className="leading-relaxed">
                          {div.noteTh || 'สินทรัพย์นี้ไม่มีการจ่ายเงินปันผล'}
                        </p>
                      </div>
                    )}
                  </div>

                  {div.applicable && div.noteTh && (
                    <p className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-[#1A2230]">
                      {div.noteTh}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Section 2: Earnings Summaries (Individual Stocks & ETF Top Holdings) */}
      {(sectionTab === 'all' || sectionTab === 'earnings') && (
        <section className="bg-[#10151E] border border-[#1E2634] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1E2634] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm sm:text-base font-semibold text-slate-100">
                สรุปงบการเงินล่าสุด (หุ้นในพอร์ต &amp; Top Holdings ของ ETF)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              {sortedEarnings.length} รายการ
            </span>
          </div>

          <div className="divide-y divide-[#1A2230]">
            {sortedEarnings.map((rec) => {
              const badge = STATUS_BADGE[rec.status];
              const isUpcomingSoon =
                rec.status !== 'not_applicable' &&
                typeof rec.daysUntil === 'number' &&
                rec.daysUntil >= 0 &&
                rec.daysUntil <= 3;

              return (
                <article
                  key={rec.id}
                  className={`p-4 sm:p-5 space-y-2.5 ${
                    isUpcomingSoon ? 'bg-sky-500/[0.05]' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2.5">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-lg leading-none mt-0.5 shrink-0">{rec.flag}</span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold text-slate-100">
                            {rec.reportedSymbol}
                          </span>
                          {rec.isTopHolding && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 text-amber-200 whitespace-nowrap">
                              Top Holding ของ {rec.portfolioSymbol}
                              {rec.holdingWeight ? ` (${rec.holdingWeight})` : ''}
                            </span>
                          )}
                          {!rec.isTopHolding && (
                            <span className="text-[11px] text-slate-400">
                              พอร์ต: <strong className="font-mono text-slate-200">{rec.portfolioSymbol}</strong>
                            </span>
                          )}
                          {isUpcomingSoon && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300 bg-sky-500/15 border border-sky-500/35 px-2 py-0.5 rounded whitespace-nowrap">
                              <CalendarClock className="w-3 h-3" />
                              {rec.daysUntil === 0
                                ? 'ประกาศงบวันนี้'
                                : `ประกาศงบในอีก ${rec.daysUntil} วัน`}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-300 mt-0.5">
                          {rec.reportedName}
                          {rec.reportDate !== '—' && (
                            <span className="text-slate-500">
                              {' '}
                              · วันที่ {formatThaiShortDate(rec.reportDate)} ({rec.periodLabel})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded border whitespace-nowrap shrink-0 ${badge.cls}`}
                    >
                      {badge.icon === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
                      {badge.icon === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
                      <span>{badge.label}</span>
                    </span>
                  </div>

                  {rec.status !== 'not_applicable' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <div className="px-3 py-2 rounded-lg bg-[#0B0F16] border border-[#1B2331]">
                        <div className="text-[10px] text-slate-500">รายได้ / การเติบโต (% YoY)</div>
                        <div className="text-xs font-medium text-slate-100 mt-0.5">
                          {rec.revenueSummary}
                        </div>
                      </div>
                      <div className="px-3 py-2 rounded-lg bg-[#0B0F16] border border-[#1B2331]">
                        <div className="text-[10px] text-slate-500">กำไร / เทียบคาดการณ์</div>
                        <div className="text-xs font-medium text-slate-100 mt-0.5">
                          {rec.profitSummary}
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {rec.trendSummaryTh}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Grounding Sources */}
      {sources.length > 0 && (
        <section className="bg-[#10151E] border border-[#1E2634] rounded-xl p-4">
          <h4 className="text-xs font-semibold text-slate-300 mb-2">
            แหล่งอ้างอิงงบการเงินและวัน XD (Google Search Grounding)
          </h4>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {sources.map((src) => (
              <a
                key={src.uri}
                href={src.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 hover:underline max-w-xs truncate"
              >
                <span className="truncate">{src.title}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
