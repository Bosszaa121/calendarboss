import React, { useMemo, useState } from 'react';
import { ExternalLink, RotateCcw, Search } from 'lucide-react';
import { NewsItem, Sentiment, SyncSource } from '../types';
import {
  getMatchedPortfolioSymbols,
  isAssetTagMatched,
} from '../utils/portfolioMatcher';
import {
  AssetTickerTag,
  PortfolioMatchBadge,
  SentimentIndicator,
} from './ImpactRating';

interface NewsViewProps {
  newsItems: NewsItem[];
  portfolioMap: Map<string, string>;
  onlyPortfolio: boolean;
  onToggleOnlyPortfolio: (val: boolean) => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  sources: SyncSource[];
}

export function NewsView({
  newsItems,
  portfolioMap,
  onlyPortfolio,
  onToggleOnlyPortfolio,
  searchQuery,
  onSearchQueryChange,
  sources,
}: NewsViewProps) {
  const [sentimentFilter, setSentimentFilter] = useState<'ALL' | Sentiment>('ALL');

  const filteredNews = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return newsItems.filter((item) => {
      if (sentimentFilter !== 'ALL' && item.sentiment !== sentimentFilter) {
        return false;
      }
      if (onlyPortfolio) {
        if (getMatchedPortfolioSymbols(item.relatedAssets, portfolioMap).length === 0) {
          return false;
        }
      }
      if (q) {
        const hitHeadline = item.headline.toLowerCase().includes(q);
        const hitSummary = item.impactSummary.toLowerCase().includes(q);
        const hitSource = item.source.toLowerCase().includes(q);
        const hitAssets = item.relatedAssets.some((a) =>
          a.toLowerCase().includes(q)
        );
        return hitHeadline || hitSummary || hitSource || hitAssets;
      }
      return true;
    });
  }, [newsItems, sentimentFilter, onlyPortfolio, portfolioMap, searchQuery]);

  const matchedCount = useMemo(
    () =>
      filteredNews.filter(
        (n) => getMatchedPortfolioSymbols(n.relatedAssets, portfolioMap).length > 0
      ).length,
    [filteredNews, portfolioMap]
  );

  const hasFilters =
    sentimentFilter !== 'ALL' || onlyPortfolio || searchQuery.trim().length > 0;

  return (
    <div className="space-y-5">
      {/* Search & Filter Toolbar */}
      <section className="bg-[#10151E] border border-[#1E2634] rounded-xl p-4 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="ค้นหาข่าว, Ticker (เช่น NVDA, VOO, PTT.BK, BTC) หรือแหล่งข่าว..."
              className="w-full bg-[#090C11] border border-[#253042] rounded-lg pl-10 pr-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/20 transition-all"
              aria-label="ค้นหาข่าวเศรษฐกิจและการลงทุน"
            />
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
            <span>เฉพาะข่าวที่กระทบพอร์ตฉัน</span>
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

        {/* Sentiment Filter Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#1A2230]">
          <div className="flex items-center gap-1 p-1 bg-[#090C11] border border-[#1E2634] rounded-lg overflow-x-auto">
            {(
              [
                { key: 'ALL', label: 'ทุกทิศทาง' },
                { key: 'bullish', label: 'Bullish (เชิงบวก)' },
                { key: 'bearish', label: 'Bearish (เชิงลบ)' },
                { key: 'neutral', label: 'Neutral (เป็นกลาง)' },
              ] as const
            ).map((opt) => {
              const active = sentimentFilter === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSentimentFilter(opt.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#1C2536] text-amber-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSentimentFilter('ALL');
                  onToggleOnlyPortfolio(false);
                  onSearchQueryChange('');
                }}
                className="inline-flex items-center gap-1 text-slate-400 hover:text-amber-300 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>ล้างตัวกรอง</span>
              </button>
            )}
            <span>
              พบ{' '}
              <strong className="font-mono tabular-nums text-slate-200">
                {filteredNews.length}
              </strong>{' '}
              ข่าว
              {matchedCount > 0 && (
                <span className="text-amber-300 ml-1.5">
                  (กระทบพอร์ต {matchedCount})
                </span>
              )}
            </span>
          </div>
        </div>
      </section>

      {/* Global News Table (Forex Factory / Investing.com Style) */}
      <section className="bg-[#10151E] border border-[#1E2634] rounded-xl overflow-hidden">
        {filteredNews.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <p className="text-sm text-slate-300 font-medium">
              ไม่พบข่าวที่ตรงกับคำค้นหาหรือตัวกรองที่เลือก
            </p>
            <button
              type="button"
              onClick={() => {
                setSentimentFilter('ALL');
                onToggleOnlyPortfolio(false);
                onSearchQueryChange('');
              }}
              className="mt-4 px-4 py-2 text-xs font-medium rounded-lg bg-[#161E2B] border border-[#283549] text-slate-200 hover:bg-[#1E293B] transition-colors cursor-pointer"
            >
              แสดงข่าวทั้งหมด
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0D121A] border-b border-[#1E2634] text-[11px] font-medium text-slate-400">
                    <th className="py-3 px-4 whitespace-nowrap w-40">เวลา / แหล่งข่าว</th>
                    <th className="py-3 px-3 whitespace-nowrap w-48">สินทรัพย์ที่ได้รับผลกระทบ</th>
                    <th className="py-3 px-3 whitespace-nowrap w-40">ทิศทางผลกระทบ</th>
                    <th className="py-3 px-4">พาดหัวข่าวและวิเคราะห์ผลกระทบ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2230]">
                  {filteredNews.map((item) => {
                    const matched = getMatchedPortfolioSymbols(
                      item.relatedAssets,
                      portfolioMap
                    );
                    const isMatched = matched.length > 0;

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          isMatched
                            ? 'bg-amber-500/[0.06] hover:bg-amber-500/[0.1]'
                            : 'hover:bg-[#151C28]'
                        }`}
                      >
                        {/* Time & Source */}
                        <td className="py-4 px-4 align-top whitespace-nowrap">
                          <div className="flex items-start gap-2.5">
                            <span
                              className={`w-1 h-9 rounded-full mt-0.5 shrink-0 ${
                                isMatched ? 'bg-amber-400' : 'bg-transparent'
                              }`}
                              aria-hidden="true"
                            />
                            <div>
                              <div className="font-mono tabular-nums text-xs font-medium text-slate-200">
                                {item.timeLabel}
                              </div>
                              <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                                {item.countryFlag && <span>{item.countryFlag}</span>}
                                <span className="font-medium text-slate-300">
                                  {item.source}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Impacted Assets */}
                        <td className="py-4 px-3 align-top">
                          <div className="flex flex-wrap gap-1.5">
                            {item.relatedAssets.map((tag) => (
                              <AssetTickerTag
                                key={tag}
                                symbol={tag}
                                matched={isAssetTagMatched(tag, portfolioMap)}
                                onClick={() => onSearchQueryChange(tag)}
                              />
                            ))}
                          </div>
                        </td>

                        {/* Impact Direction */}
                        <td className="py-4 px-3 align-top whitespace-nowrap">
                          <div className="pt-0.5">
                            <SentimentIndicator sentiment={item.sentiment} />
                          </div>
                        </td>

                        {/* Headline & Impact Explanation */}
                        <td className="py-4 px-4 align-top">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-medium text-slate-100 leading-snug">
                              {item.headline}
                            </h3>
                            {isMatched && <PortfolioMatchBadge />}
                            {item.isLiveSynced && (
                              <span className="text-[10px] font-medium text-sky-300 bg-sky-500/15 px-1.5 py-0.5 rounded">
                                ข้อมูลสด
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                            {item.impactSummary}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile News Cards */}
            <div className="md:hidden divide-y divide-[#1A2230]">
              {filteredNews.map((item) => {
                const matched = getMatchedPortfolioSymbols(
                  item.relatedAssets,
                  portfolioMap
                );
                const isMatched = matched.length > 0;

                return (
                  <article
                    key={item.id}
                    className={`p-4 space-y-2.5 ${
                      isMatched ? 'bg-amber-500/[0.06]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        {isMatched && (
                          <span
                            className="w-1 h-4 rounded-full bg-amber-400 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                        <span className="font-mono tabular-nums">{item.timeLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-300 font-medium">
                          {item.countryFlag ? `${item.countryFlag} ` : ''}
                          {item.source}
                        </span>
                      </div>
                      <SentimentIndicator sentiment={item.sentiment} />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-medium text-slate-100 leading-snug">
                        {item.headline}
                      </h3>
                      {isMatched && <PortfolioMatchBadge />}
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      {item.impactSummary}
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {item.relatedAssets.map((tag) => (
                        <AssetTickerTag
                          key={tag}
                          symbol={tag}
                          matched={isAssetTagMatched(tag, portfolioMap)}
                          onClick={() => onSearchQueryChange(tag)}
                        />
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Live Search Grounding Sources (when synced via /api/sync) */}
      {sources.length > 0 && (
        <section className="bg-[#10151E] border border-[#1E2634] rounded-xl p-4">
          <h3 className="text-xs font-semibold text-slate-300 mb-2">
            แหล่งอ้างอิงจากการอัปเดตข้อมูลสด (Google Search)
          </h3>
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
