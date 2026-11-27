import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe,
  MessageSquareText,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  NewsItem,
  NewsSubTab,
  PortfolioAsset,
  PortfolioImpactDetail,
  Sentiment,
  SocialInsightItem,
  SocialPlatform,
  SocialSentiment,
  SyncSource,
} from '../types';
import {
  analyzePortfolioImpacts,
  isAssetTagMatched,
} from '../utils/portfolioMatcher';
import {
  AssetTickerTag,
  PortfolioImpactMatrix,
  PortfolioMatchBadge,
  SentimentIndicator,
} from './ImpactRating';
import { LiveSearchingBanner, NewsCardsSkeleton } from './LoadingSkeletons';

interface NewsViewProps {
  subTab: NewsSubTab;
  onSubTabChange: (tab: NewsSubTab) => void;
  newsItems: NewsItem[];
  socialInsights: SocialInsightItem[];
  portfolio: PortfolioAsset[];
  portfolioMap: Map<string, string>;
  onlyPortfolio: boolean;
  onToggleOnlyPortfolio: (val: boolean) => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  sources: SyncSource[];
  socialSources: SyncSource[];
  isLoadingNews: boolean;
  newsError: string | null;
  onRetryMarket: () => void;
  isSyncingSocial: boolean;
  socialError: string | null;
  lastSocialSyncAt: string | null;
  onSyncSocialLive: () => void;
  onGoToPortfolio: () => void;
}

const NEWS_COUNTRY_FILTERS: Array<{ code: string; flag: string; label: string }> = [
  { code: 'ALL', flag: '🌐', label: 'ทั้งหมด' },
  { code: 'US', flag: '🇺🇸', label: 'สหรัฐฯ' },
  { code: 'TH', flag: '🇹🇭', label: 'ไทย' },
  { code: 'CN', flag: '🇨🇳', label: 'จีน' },
  { code: 'EU', flag: '🇪🇺', label: 'ยุโรป' },
  { code: 'JP', flag: '🇯🇵', label: 'ญี่ปุ่น' },
];

function PlatformBadge({ platform }: { platform: SocialPlatform }) {
  if (platform === 'x') {
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-600/80 text-slate-100 shrink-0">
        X.com
      </span>
    );
  }
  if (platform === 'facebook') {
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-blue-500/15 border border-blue-500/35 text-blue-300 shrink-0">
        Facebook
      </span>
    );
  }
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-rose-500/15 border border-rose-500/35 text-rose-300 shrink-0">
      YouTube
    </span>
  );
}

function SocialSentimentBadge({ sentiment }: { sentiment: SocialSentiment }) {
  if (sentiment === 'bullish') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 shrink-0">
        <TrendingUp className="w-3 h-3" />
        <span>เชิงบวก</span>
      </span>
    );
  }
  if (sentiment === 'bearish') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-rose-500/15 border border-rose-500/35 text-rose-300 shrink-0">
        <TrendingDown className="w-3 h-3" />
        <span>เชิงลบ</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-300 shrink-0">
      <AlertTriangle className="w-3 h-3" />
      <span>เฝ้าระวัง</span>
    </span>
  );
}

function buildSocialActionUrl(item: SocialInsightItem): string {
  if (
    item.sourceUrl &&
    (item.sourceUrl.startsWith('https://') || item.sourceUrl.startsWith('http://'))
  ) {
    return item.sourceUrl;
  }
  const q = encodeURIComponent(
    item.searchQuery || `${item.channelName} ${item.relatedAssets.slice(0, 2).join(' ')}`
  );
  if (item.platform === 'x') return `https://x.com/search?q=${q}&f=live`;
  if (item.platform === 'youtube') return `https://www.youtube.com/results?search_query=${q}`;
  return `https://www.facebook.com/search/top?q=${q}`;
}

export function NewsView({
  subTab,
  onSubTabChange,
  newsItems,
  socialInsights,
  portfolio,
  portfolioMap,
  onlyPortfolio,
  onToggleOnlyPortfolio,
  searchQuery,
  onSearchQueryChange,
  isLoadingNews,
  newsError,
  onRetryMarket,
  isSyncingSocial,
  socialError,
  onSyncSocialLive,
  onGoToPortfolio,
}: NewsViewProps) {
  const [sentimentFilter, setSentimentFilter] = useState<'ALL' | Sentiment>('ALL');
  const [countryFilter, setCountryFilter] = useState<string>('ALL');
  const [platformFilter, setPlatformFilter] = useState<'ALL' | SocialPlatform>('ALL');
  const [socialSentimentFilter, setSocialSentimentFilter] = useState<'ALL' | SocialSentiment>('ALL');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  function toggleExpand(id: string) {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const newsImpactsMap = useMemo(() => {
    const map = new Map<string, PortfolioImpactDetail[]>();
    for (const item of newsItems) {
      map.set(
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
    return map;
  }, [newsItems, portfolio, portfolioMap]);

  const filteredNews = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return newsItems.filter((item) => {
      if (sentimentFilter !== 'ALL' && item.sentiment !== sentimentFilter) return false;
      if (countryFilter !== 'ALL' && (item.countryCode || '').toUpperCase() !== countryFilter) {
        return false;
      }
      const impacts = newsImpactsMap.get(item.id) ?? [];
      if (onlyPortfolio && impacts.length === 0) return false;
      if (q) {
        const hitHeadline = item.headline.toLowerCase().includes(q);
        const hitSummary = item.impactSummary.toLowerCase().includes(q);
        const hitSource = item.source.toLowerCase().includes(q);
        const hitAssets = item.relatedAssets.some((a) => a.toLowerCase().includes(q));
        const hitImpacts = impacts.some(
          (i) => i.symbol.toLowerCase().includes(q) || i.reasonTh.toLowerCase().includes(q)
        );
        return hitHeadline || hitSummary || hitSource || hitAssets || hitImpacts;
      }
      return true;
    });
  }, [newsItems, sentimentFilter, countryFilter, onlyPortfolio, newsImpactsMap, searchQuery]);

  const filteredSocial = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return socialInsights.filter((item) => {
      if (platformFilter !== 'ALL' && item.platform !== platformFilter) return false;
      if (socialSentimentFilter !== 'ALL' && item.sentiment !== socialSentimentFilter) {
        return false;
      }
      const matchedAssets = item.relatedAssets.filter((tag) =>
        isAssetTagMatched(tag, portfolioMap)
      );
      if (onlyPortfolio && matchedAssets.length === 0) return false;
      if (q) {
        const hitTitle = item.title.toLowerCase().includes(q);
        const hitSummary = item.deepSummaryTh.toLowerCase().includes(q);
        const hitChannel =
          item.channelName.toLowerCase().includes(q) ||
          item.handleOrPage.toLowerCase().includes(q);
        const hitAssets = item.relatedAssets.some((a) => a.toLowerCase().includes(q));
        return hitTitle || hitSummary || hitChannel || hitAssets;
      }
      return true;
    });
  }, [
    socialInsights,
    platformFilter,
    socialSentimentFilter,
    onlyPortfolio,
    portfolioMap,
    searchQuery,
  ]);

  const hasFilters =
    sentimentFilter !== 'ALL' ||
    countryFilter !== 'ALL' ||
    platformFilter !== 'ALL' ||
    socialSentimentFilter !== 'ALL' ||
    onlyPortfolio ||
    searchQuery.trim().length > 0;

  return (
    <div className="space-y-3">
      {/* Segmented Global / Social Sub-Tabs */}
      <div
        role="tablist"
        aria-label="หมวดข่าวสาร"
        className="grid grid-cols-2 gap-1 p-1 bg-[#10151E] border border-[#1E2634] rounded-2xl"
      >
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'global'}
          onClick={() => onSubTabChange('global')}
          className={`min-h-[40px] px-3 text-xs font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
            subTab === 'global'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          <Globe className="w-3.5 h-3.5 shrink-0" />
          <span>ข่าวโลก ({newsItems.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'social'}
          onClick={() => onSubTabChange('social')}
          className={`min-h-[40px] px-3 text-xs font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
            subTab === 'social'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          <MessageSquareText className="w-3.5 h-3.5 shrink-0" />
          <span>โซเชียล ({socialInsights.length})</span>
        </button>
      </div>

      {/* Search + Single-Row Scrollable Filters */}
      <section className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-3.5 space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder={
              subTab === 'global'
                ? 'ค้นหาข่าว, Ticker (QQQM, KCG, PEP)...'
                : 'ค้นหากระแส X / Facebook / YouTube...'
            }
            className="w-full min-h-[42px] bg-[#090C11] border border-[#253042] rounded-xl pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70"
            aria-label="ค้นหาข่าวสาร"
          />
        </div>

        {/* Single-Row Scrollable Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap no-scrollbar pt-1">
          <button
            type="button"
            role="switch"
            aria-checked={onlyPortfolio}
            onClick={() => onToggleOnlyPortfolio(!onlyPortfolio)}
            className={`px-3 min-h-[36px] rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 shrink-0 cursor-pointer ${
              onlyPortfolio
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                : 'bg-[#090C11] border-[#253042] text-slate-300'
            }`}
          >
            <span>เฉพาะพอร์ตฉัน</span>
            <span
              className={`w-2 h-2 rounded-full ${
                onlyPortfolio ? 'bg-amber-400' : 'bg-slate-600'
              }`}
            />
          </button>

          {subTab === 'global' ? (
            <>
              {(
                [
                  { key: 'ALL', label: 'ทุกทิศทาง' },
                  { key: 'bullish', label: 'เชิงบวก' },
                  { key: 'bearish', label: 'เชิงลบ' },
                  { key: 'neutral', label: 'เป็นกลาง' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSentimentFilter(opt.key)}
                  className={`px-3 min-h-[36px] rounded-xl border text-xs font-medium shrink-0 cursor-pointer ${
                    sentimentFilter === opt.key
                      ? 'bg-[#1C2536] border-amber-500/40 text-amber-300'
                      : 'bg-[#090C11] border-[#222C3D] text-slate-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              {NEWS_COUNTRY_FILTERS.slice(1).map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setCountryFilter(countryFilter === c.code ? 'ALL' : c.code)}
                  className={`px-2.5 min-h-[36px] rounded-xl border text-xs font-medium inline-flex items-center gap-1 shrink-0 cursor-pointer ${
                    countryFilter === c.code
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                      : 'bg-[#090C11] border-[#222C3D] text-slate-300'
                  }`}
                >
                  <span>{c.flag}</span>
                  <span>{c.label}</span>
                </button>
              ))}
            </>
          ) : (
            <>
              {(
                [
                  { key: 'ALL', label: 'ทุกแพลตฟอร์ม' },
                  { key: 'x', label: 'X.com' },
                  { key: 'facebook', label: 'Facebook' },
                  { key: 'youtube', label: 'YouTube' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPlatformFilter(opt.key)}
                  className={`px-3 min-h-[36px] rounded-xl border text-xs font-medium shrink-0 cursor-pointer ${
                    platformFilter === opt.key
                      ? 'bg-[#1C2536] border-amber-500/40 text-amber-300'
                      : 'bg-[#090C11] border-[#222C3D] text-slate-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              {(
                [
                  { key: 'bullish', label: 'เชิงบวก' },
                  { key: 'bearish', label: 'เชิงลบ' },
                  { key: 'watch', label: 'เฝ้าระวัง' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() =>
                    setSocialSentimentFilter(socialSentimentFilter === opt.key ? 'ALL' : opt.key)
                  }
                  className={`px-3 min-h-[36px] rounded-xl border text-xs font-medium shrink-0 cursor-pointer ${
                    socialSentimentFilter === opt.key
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                      : 'bg-[#090C11] border-[#222C3D] text-slate-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </>
          )}

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSentimentFilter('ALL');
                setCountryFilter('ALL');
                setPlatformFilter('ALL');
                setSocialSentimentFilter('ALL');
                onToggleOnlyPortfolio(false);
                onSearchQueryChange('');
              }}
              className="min-h-[36px] px-2.5 text-xs text-slate-400 hover:text-amber-300 inline-flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ล้าง</span>
            </button>
          )}
        </div>
      </section>

      {/* BODY: GLOBAL NEWS */}
      {subTab === 'global' ? (
        <div className="space-y-3">
          {isLoadingNews && <LiveSearchingBanner message="กำลังดึงข่าวเศรษฐกิจและการลงทุนล่าสุด..." />}

          {isLoadingNews && newsItems.length === 0 ? (
            <NewsCardsSkeleton cards={3} />
          ) : !isLoadingNews && newsError && newsItems.length === 0 ? (
            <div className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-6 text-center space-y-3">
              <AlertCircle className="w-6 h-6 text-rose-400 mx-auto" />
              <p className="text-xs text-rose-200">{newsError}</p>
              <button
                type="button"
                onClick={onRetryMarket}
                className="min-h-[40px] px-4 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>ลองดึงข่าวใหม่</span>
              </button>
            </div>
          ) : filteredNews.length === 0 ? (
            <div className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-6 text-center space-y-3">
              {onlyPortfolio && portfolio.length === 0 ? (
                <>
                  <p className="text-sm text-slate-200 font-semibold">พอร์ตของคุณยังว่างอยู่</p>
                  <button
                    type="button"
                    onClick={onGoToPortfolio}
                    className="min-h-[42px] px-4 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>เพิ่มสินทรัพย์ในพอร์ต</span>
                  </button>
                </>
              ) : (
                <p className="text-xs text-slate-400">ไม่พบข่าวที่ตรงกับเงื่อนไขที่เลือก</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredNews.map((item) => {
                const impacts = newsImpactsMap.get(item.id) ?? [];
                const directCount = impacts.filter((i) => i.relation === 'direct').length;
                const indirectCount = impacts.length - directCount;
                const isMatched = impacts.length > 0;
                const expanded = Boolean(expandedIds[`g-${item.id}`]);

                return (
                  <article
                    key={item.id}
                    className={`bg-[#10151E] border rounded-2xl p-4 space-y-2.5 ${
                      directCount > 0 ? 'border-amber-500/35' : 'border-[#1E2634]'
                    }`}
                  >
                    {/* Element 1: Flag + Source/Time + Sentiment */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-400 truncate">
                        {item.countryFlag || '🌐'} {item.source} · {item.timeLabel}
                      </span>
                      <SentimentIndicator sentiment={item.sentiment} />
                    </div>

                    {/* Element 2: Headline (<= 2 lines) */}
                    <h3 className="text-sm font-semibold text-slate-100 leading-snug line-clamp-2">
                      {item.headline}
                    </h3>

                    {/* Element 3: Action Row + ดูเพิ่มเติม Toggle */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#1A2230]">
                      <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                        {isMatched ? (
                          <PortfolioMatchBadge
                            directCount={directCount}
                            indirectCount={indirectCount}
                          />
                        ) : (
                          item.relatedAssets.slice(0, 2).map((tag) => (
                            <AssetTickerTag
                              key={tag}
                              symbol={tag}
                              matched={isAssetTagMatched(tag, portfolioMap)}
                              onClick={() => onSearchQueryChange(tag)}
                            />
                          ))
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleExpand(`g-${item.id}`)}
                        className="min-h-[36px] px-2 text-xs font-medium text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <span>{expanded ? 'ย่อ' : 'ดูเพิ่มเติม'}</span>
                        {expanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Progressive Disclosure Details */}
                    {expanded && (
                      <div className="pt-2.5 border-t border-[#1B2331] space-y-2.5">
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {item.impactSummary}
                        </p>
                        {isMatched && (
                          <PortfolioImpactMatrix
                            impacts={impacts}
                            onTickerClick={(sym) => onSearchQueryChange(sym)}
                          />
                        )}
                        {item.sourceUrl &&
                          (item.sourceUrl.startsWith('https://') ||
                            item.sourceUrl.startsWith('http://')) && (
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300"
                            >
                              <span>อ่านต้นฉบับ</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* BODY: SOCIAL INSIGHTS (Single-Column Expandable Cards) */
        <div className="space-y-3">
          {isSyncingSocial && <LiveSearchingBanner message="กำลังอัปเดตฟีดข่าวโซเชียลล่าสุด..." />}

          {isSyncingSocial && socialInsights.length === 0 ? (
            <NewsCardsSkeleton cards={3} />
          ) : !isSyncingSocial && socialError && socialInsights.length === 0 ? (
            <div className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-6 text-center space-y-3">
              <AlertCircle className="w-6 h-6 text-rose-400 mx-auto" />
              <p className="text-xs text-rose-200">{socialError}</p>
              <button
                type="button"
                onClick={onSyncSocialLive}
                className="min-h-[40px] px-4 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>ลองดึงข้อมูลใหม่</span>
              </button>
            </div>
          ) : filteredSocial.length === 0 ? (
            <div className="bg-[#10151E] border border-[#1E2634] rounded-2xl p-6 text-center text-xs text-slate-400">
              ไม่พบกระแสโซเชียลตามตัวกรองที่เลือก
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredSocial.map((item) => {
                const matchedSymbols = item.relatedAssets.filter((tag) =>
                  isAssetTagMatched(tag, portfolioMap)
                );
                const actionUrl = buildSocialActionUrl(item);
                const expanded = Boolean(expandedIds[`s-${item.id}`]);

                return (
                  <article
                    key={item.id}
                    className={`bg-[#10151E] border rounded-2xl p-4 space-y-2.5 ${
                      matchedSymbols.length > 0 ? 'border-amber-500/35' : 'border-[#1E2634]'
                    }`}
                  >
                    {/* Element 1: Platform + Channel + Sentiment */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <PlatformBadge platform={item.platform} />
                        <span className="text-xs font-medium text-slate-300 truncate">
                          {item.channelName}
                        </span>
                      </div>
                      <SocialSentimentBadge sentiment={item.sentiment} />
                    </div>

                    {/* Element 2: Title (<= 2 lines) */}
                    <h3 className="text-sm font-semibold text-slate-100 leading-snug line-clamp-2">
                      {item.title}
                    </h3>

                    {/* Element 3: Action Link + ดูเพิ่มเติม Toggle */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#1A2230]">
                      <a
                        href={actionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[36px] inline-flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300"
                      >
                        <span>เปิดต้นฉบับ</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      <button
                        type="button"
                        onClick={() => toggleExpand(`s-${item.id}`)}
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

                    {/* Progressive Disclosure Details */}
                    {expanded && (
                      <div className="pt-2.5 border-t border-[#1B2331] space-y-2.5">
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {item.deepSummaryTh}
                        </p>
                        {item.analystViewTh && (
                          <div className="px-3 py-2 rounded-xl bg-[#090C11] border border-[#1B2331] text-xs text-amber-200/90 leading-relaxed">
                            {item.analystViewTh}
                          </div>
                        )}
                        {item.relatedAssets.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.relatedAssets.map((tag) => (
                              <AssetTickerTag
                                key={tag}
                                symbol={tag}
                                matched={isAssetTagMatched(tag, portfolioMap)}
                                onClick={() => onSearchQueryChange(tag)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
