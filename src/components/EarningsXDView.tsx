import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Plus,
  RefreshCw,
} from 'lucide-react';
import {
  DividendXDRecord,
  EarningsRecord,
  EarningsStatus,
  LiveAssetQuote,
  PortfolioAsset,
  SyncSource,
} from '../types';
import { formatThaiShortDate } from '../utils/portfolioMatcher';
import { formatCurrencyPrice } from '../utils/technicalAnalysis';
import { EarningsXDSkeleton, LiveSearchingBanner } from './LoadingSkeletons';

interface EarningsXDViewProps {
  portfolio: PortfolioAsset[];
  earnings: EarningsRecord[];
  dividends: DividendXDRecord[];
  liveQuotes: Record<string, LiveAssetQuote>;
  sources: SyncSource[];
  isSyncing: boolean;
  error: string | null;
  lastSyncedAt: string | null;
  onSyncLive: () => void;
  onGoToPortfolio: () => void;
}

const STATUS_BADGE: Record<EarningsStatus, { label: string; cls: string }> = {
  beat: {
    label: 'งบดีกว่าคาด',
    cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
  },
  inline: {
    label: 'ตามคาด',
    cls: 'bg-slate-700/40 text-slate-200 border-slate-600/60',
  },
  miss: {
    label: 'ต่ำกว่าคาด',
    cls: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
  },
  upcoming: {
    label: 'รอประกาศงบ',
    cls: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
  },
  not_applicable: {
    label: 'ไม่อิงงบการเงิน',
    cls: 'bg-[#161E2B] text-slate-400 border-[#283549]',
  },
};

export function EarningsXDView({
  portfolio,
  earnings,
  dividends,
  liveQuotes,
  isSyncing,
  error,
  onSyncLive,
  onGoToPortfolio,
}: EarningsXDViewProps) {
  const [sectionTab, setSectionTab] = useState<'all' | 'xd' | 'earnings'>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  function toggleExpand(id: string) {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const sortedDividends = useMemo(() => {
    const rankStatus = (d: DividendXDRecord) => {
      if (!d.applicable || d.xdStatus === 'not_applicable') return 3;
      if (d.xdStatus === 'announced') return 1;
      return 2;
    };
    return [...dividends].sort((a, b) => {
      const ra = rankStatus(a);
      const rb = rankStatus(b);
      if (ra !== rb) return ra - rb;
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
      <section className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-6 text-center space-y-3">
        <div className="w-11 h-11 rounded-xl bg-amber-500/12 border border-amber-500/30 flex items-center justify-center mx-auto">
          <BarChart3 className="w-5 h-5 text-amber-400" />
        </div>
        <h2 className="text-sm font-bold text-slate-100">
          ติดตามงบการเงินและวัน XD เฉพาะพอร์ตคุณ
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          เพิ่มหุ้นไทยหรือต่างประเทศในพอร์ตก่อน เพื่อตรวจสอบวันขึ้น XD ที่ประกาศทางการแล้วและสรุปงบการเงินล่าสุด
        </p>
        <button
          type="button"
          onClick={onGoToPortfolio}
          className="min-h-[44px] px-5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มสินทรัพย์ในพอร์ต</span>
        </button>
      </section>
    );
  }

  const hasData = earnings.length > 0 || dividends.length > 0;
  const activeEarningsCount = earnings.filter((e) => e.status !== 'not_applicable').length;

  return (
    <div className="space-y-3">
      {/* Single-Row Horizontal Scrollable Section Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap no-scrollbar py-0.5">
        {(
          [
            { key: 'all', label: 'ทั้งหมด' },
            { key: 'xd', label: `วัน XD & ปันผล (${dividends.length})` },
            { key: 'earnings', label: `งบการเงิน (${activeEarningsCount})` },
          ] as const
        ).map((tab) => {
          const active = sectionTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSectionTab(tab.key)}
              className={`px-3.5 min-h-[38px] text-xs font-medium rounded-xl border transition-colors shrink-0 cursor-pointer ${
                active
                  ? 'bg-amber-500 text-slate-950 border-amber-500 font-semibold'
                  : 'bg-[#10151E] border-[#1E2634] text-slate-400 hover:text-slate-100'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {isSyncing && <LiveSearchingBanner message="กำลังดึงข้อมูลงบการเงินและวัน XD จริง..." />}

      {isSyncing && !hasData ? (
        <EarningsXDSkeleton cards={3} />
      ) : !hasData ? (
        <section className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-6 text-center space-y-3">
          {error ? (
            <>
              <AlertCircle className="w-6 h-6 text-rose-400 mx-auto" />
              <p className="text-xs text-rose-200">{error}</p>
            </>
          ) : (
            <p className="text-xs text-slate-400">ยังไม่มีข้อมูลงบและวัน XD กดอัปเดตเพื่อดึงข้อมูลสด</p>
          )}
          <button
            type="button"
            onClick={onSyncLive}
            className="min-h-[40px] px-4 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>อัปเดตข้อมูลล่าสุด</span>
          </button>
        </section>
      ) : (
        <>
          {/* Section 1: Official XD & Dividend Cards (Single Column) */}
          {(sectionTab === 'all' || sectionTab === 'xd') && sortedDividends.length > 0 && (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between px-0.5">
                <h2 className="text-sm font-bold text-slate-100 inline-flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-400" />
                  <span>วันขึ้นเครื่องหมาย XD &amp; ปันผล</span>
                </h2>
                <span className="text-[11px] text-slate-500">เฉพาะที่ประกาศทางการ</span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {sortedDividends.map((div) => {
                  const quote = liveQuotes[div.symbol.toUpperCase()];
                  const effectiveYield =
                    div.dividendYield && div.dividendYield !== '—'
                      ? div.dividendYield
                      : quote?.dividendYield || '—';
                  const isNotApplicable =
                    !div.applicable || div.xdStatus === 'not_applicable';
                  const isAnnounced =
                    !isNotApplicable &&
                    div.xdStatus === 'announced' &&
                    typeof div.daysUntilXD === 'number' &&
                    div.daysUntilXD >= 0;
                  const isSoon = isAnnounced && (div.daysUntilXD ?? 99) <= 7;
                  const expanded = Boolean(expandedIds[`xd-${div.id}`]);

                  return (
                    <article
                      key={div.id}
                      className={`bg-[#10151E] border rounded-2xl p-4 space-y-2.5 ${
                        isSoon
                          ? 'border-emerald-500/45'
                          : isNotApplicable
                          ? 'border-[#1B2230] opacity-85'
                          : 'border-[#1E2634]'
                      }`}
                    >
                      {/* Element 1: Flag + Symbol + Live Price / Yield */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span>{div.flag}</span>
                            <span className="font-mono text-sm font-bold text-slate-100">
                              {div.symbol}
                            </span>
                            {quote && quote.price !== null && (
                              <span className="font-mono text-xs text-slate-400">
                                {formatCurrencyPrice(quote.price, quote.currency)}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 truncate mt-0.5">{div.name}</div>
                        </div>

                        {isNotApplicable ? (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-[#161E2B] text-slate-400 shrink-0">
                            ไม่มีปันผล
                          </span>
                        ) : isAnnounced ? (
                          <span
                            className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ${
                              isSoon
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/45'
                                : 'bg-amber-500/12 text-amber-300 border-amber-500/35'
                            }`}
                          >
                            {div.daysUntilXD === 0 ? 'วันนี้ XD!' : `อีก ${div.daysUntilXD} วัน XD`}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 shrink-0">
                            <Clock className="w-3 h-3" />
                            <span>ยังไม่ประกาศ XD</span>
                          </span>
                        )}
                      </div>

                      {/* Element 2: Concise Status Line */}
                      <div className="text-xs text-slate-300 line-clamp-2">
                        {isNotApplicable ? (
                          <span className="text-slate-400">
                            {div.noteTh || 'สินทรัพย์นี้ไม่มีการจ่ายเงินปันผล'}
                          </span>
                        ) : isAnnounced ? (
                          <span>
                            XD <strong className="font-mono text-slate-100">{formatThaiShortDate(div.xdDate)}</strong> ·
                            ปันผล <strong className="font-mono text-emerald-300">{div.dps}</strong> · Yield{' '}
                            <strong className="font-mono text-amber-300">{effectiveYield}</strong>
                          </span>
                        ) : (
                          <span>
                            Yield <strong className="font-mono text-amber-300">{effectiveYield}</strong> ·
                            รอบล่าสุดจ่าย {div.lastPaidDps || div.dps || '—'}
                          </span>
                        )}
                      </div>

                      {/* Element 3: Progressive Disclosure Toggle */}
                      {!isNotApplicable && (
                        <div className="flex justify-end pt-1 border-t border-[#1A2230]">
                          <button
                            type="button"
                            onClick={() => toggleExpand(`xd-${div.id}`)}
                            className="min-h-[36px] px-2 text-xs font-medium text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>{expanded ? 'ย่อ' : 'ดูเพิ่มเติม'}</span>
                            {expanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      )}

                      {expanded && !isNotApplicable && (
                        <div className="pt-2.5 border-t border-[#1B2331] space-y-2.5 text-xs">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-[#090C11] border border-[#1B2331] rounded-xl p-2.5">
                              <div className="text-[10px] text-slate-500">
                                {isAnnounced ? 'วันขึ้น XD (ประกาศแล้ว)' : 'วัน XD รอบล่าสุด'}
                              </div>
                              <div className="font-mono text-slate-100 font-semibold mt-0.5">
                                {isAnnounced
                                  ? div.xdDate !== '—'
                                    ? formatThaiShortDate(div.xdDate)
                                    : '—'
                                  : div.lastPaidXdDate && div.lastPaidXdDate !== '—'
                                  ? formatThaiShortDate(div.lastPaidXdDate)
                                  : '—'}
                              </div>
                            </div>
                            <div className="bg-[#090C11] border border-[#1B2331] rounded-xl p-2.5">
                              <div className="text-[10px] text-slate-500">
                                {isAnnounced ? 'วันจ่ายปันผล' : 'วันจ่ายรอบล่าสุด'}
                              </div>
                              <div className="font-mono text-slate-200 font-semibold mt-0.5">
                                {isAnnounced
                                  ? div.payDate !== '—'
                                    ? formatThaiShortDate(div.payDate)
                                    : '—'
                                  : div.lastPaidPayDate && div.lastPaidPayDate !== '—'
                                  ? formatThaiShortDate(div.lastPaidPayDate)
                                  : '—'}
                              </div>
                            </div>
                          </div>
                          {div.noteTh && (
                            <p className="text-xs text-slate-400 leading-relaxed">{div.noteTh}</p>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* Section 2: Earnings Cards (Single Column) */}
          {(sectionTab === 'all' || sectionTab === 'earnings') && sortedEarnings.length > 0 && (
            <section className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between px-0.5">
                <h2 className="text-sm font-bold text-slate-100 inline-flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-sky-400" />
                  <span>สรุปงบการเงินล่าสุด</span>
                </h2>
                <span className="text-[11px] text-slate-500">{sortedEarnings.length} รายการ</span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {sortedEarnings.map((rec) => {
                  const badge = STATUS_BADGE[rec.status];
                  const expanded = Boolean(expandedIds[`earn-${rec.id}`]);

                  return (
                    <article
                      key={rec.id}
                      className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-4 space-y-2.5"
                    >
                      {/* Element 1: Flag + Symbol + Status Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{rec.flag}</span>
                            <span className="font-mono text-sm font-bold text-slate-100">
                              {rec.reportedSymbol}
                            </span>
                            {rec.isTopHolding && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                                ใน {rec.portfolioSymbol}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {rec.reportedName}
                            {rec.reportDate !== '—' ? ` · ${formatThaiShortDate(rec.reportDate)}` : ''}
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border whitespace-nowrap shrink-0 ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      {/* Element 2: Concise Trend Summary (<= 2 lines) */}
                      <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                        {rec.trendSummaryTh}
                      </p>

                      {/* Element 3: Progressive Disclosure Toggle */}
                      <div className="flex items-center justify-between pt-1 border-t border-[#1A2230]">
                        <span className="text-[11px] text-slate-500">{rec.periodLabel}</span>
                        <button
                          type="button"
                          onClick={() => toggleExpand(`earn-${rec.id}`)}
                          className="min-h-[36px] px-2 text-xs font-medium text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>{expanded ? 'ย่อ' : 'ดูเพิ่มเติม'}</span>
                          {expanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {expanded && (
                        <div className="pt-2.5 border-t border-[#1B2331] space-y-2.5 text-xs">
                          {rec.status !== 'not_applicable' && (
                            <div className="grid grid-cols-1 gap-2">
                              <div className="bg-[#090C11] border border-[#1B2331] rounded-xl p-2.5">
                                <div className="text-[10px] text-slate-500">รายได้ / การเติบโต</div>
                                <div className="text-slate-100 mt-0.5">{rec.revenueSummary}</div>
                              </div>
                              <div className="bg-[#090C11] border border-[#1B2331] rounded-xl p-2.5">
                                <div className="text-[10px] text-slate-500">กำไร / เทียบคาดการณ์</div>
                                <div className="text-slate-100 mt-0.5">{rec.profitSummary}</div>
                              </div>
                            </div>
                          )}
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {rec.trendSummaryTh}
                          </p>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
