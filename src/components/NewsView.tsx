import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
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
  isSyncingSocial: boolean;
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

function PlatformIcon({ platform }: { platform: SocialPlatform }) {
  if (platform === 'x') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800 border border-slate-600/80 text-slate-100 whitespace-nowrap shrink-0">
        <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        <span>X.com</span>
      </span>
    );
  }
  if (platform === 'facebook') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/40 text-blue-300 whitespace-nowrap shrink-0">
        <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" aria-hidden="true">
          <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
        </svg>
        <span>Facebook</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/40 text-rose-300 whitespace-nowrap shrink-0">
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
      <span>YouTube</span>
    </span>
  );
}

function SocialSentimentBadge({ sentiment }: { sentiment: SocialSentiment }) {
  if (sentiment === 'bullish') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 whitespace-nowrap shrink-0">
        <TrendingUp className="w-3 h-3" />
        <span>เชิงบวก</span>
      </span>
    );
  }
  if (sentiment === 'bearish') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/40 text-rose-300 whitespace-nowrap shrink-0">
        <TrendingDown className="w-3 h-3" />
        <span>เชิงลบ</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 whitespace-nowrap shrink-0">
      <AlertTriangle className="w-3 h-3" />
      <span>เฝ้าระวัง</span>
    </span>
  );
}

function buildSocialActionUrl(item: SocialInsightItem): string {
  if (item.sourceUrl && (item.sourceUrl.startsWith('https://') || item.sourceUrl.startsWith('http://'))) {
    return item.sourceUrl;
  }
  const q = encodeURIComponent(item.searchQuery || `${item.channelName} ${item.relatedAssets.slice(0, 2).join(' ')}`);
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
  sources,
  socialSources,
  isSyncingSocial,
  lastSocialSyncAt,
  onSyncSocialLive,
  onGoToPortfolio,
}: NewsViewProps) {
  const [sentimentFilter, setSentimentFilter] = useState<'ALL' | Sentiment>('ALL');
  const [countryFilter, setCountryFilter] = useState<string>('ALL');
  const [platformFilter, setPlatformFilter] = useState<'ALL' | SocialPlatform>('ALL');
  const [socialSentimentFilter, setSocialSentimentFilter] = useState<'ALL' | SocialSentiment>('ALL');

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
      if (sentimentFilter !== 'ALL' && item.sentiment !== sentimentFilter) {
        return false;
      }
      if (countryFilter !== 'ALL' && (item.countryCode || '').toUpperCase() !== countryFilter) {
        return false;
      }
      const impacts = newsImpactsMap.get(item.id) ?? [];
      if (onlyPortfolio && impacts.length === 0) {
        return false;
      }
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

  const matchedGlobalCount = useMemo(
    () => filteredNews.filter((n) => (newsImpactsMap.get(n.id)?.length ?? 0) > 0).length,
    [filteredNews, newsImpactsMap]
  );

  const hasGlobalFilters =
    sentimentFilter !== 'ALL' ||
    countryFilter !== 'ALL' ||
    onlyPortfolio ||
    searchQuery.trim().length > 0;

  return (
    <div className="space-y-5">
      {/* Sub-Tab Switcher: Global News vs Social Media Deep Insights */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#10151E] border border-[#1E2634] rounded-xl p-3">
        <div
          role="tablist"
          aria-label="เลือกหมวดข่าวสาร"
          className="grid grid-cols-2 sm:inline-flex gap-1 p-1 bg-[#090C11] border border-[#1E2634] rounded-lg"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'global'}
            onClick={() => onSubTabChange('global')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
              subTab === 'global'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>ข่าวเศรษฐกิจโลก ({newsItems.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'social'}
            onClick={() => onSubTabChange('social')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
              subTab === 'social'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <MessageSquareText className="w-3.5 h-3.5" />
            <span>ข่าวโซเชียล X / FB / YT ({socialInsights.length})</span>
          </button>
        </div>

        {subTab === 'social' && (
          <div className="flex flex-wrap items-center gap-2">
            {lastSocialSyncAt && (
              <span className="text-[11px] font-mono text-slate-400">
                อัปเดตสด {lastSocialSyncAt} น.
              </span>
            )}
            <button
              type="button"
              onClick={onSyncSocialLive}
              disabled={isSyncingSocial}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#182130] border border-amber-500/40 text-amber-200 hover:bg-amber-500/15 disabled:opacity-65 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSocial ? 'animate-spin' : ''}`} />
              <span>
                {isSyncingSocial
                  ? 'กำลังค้นหาฟีดโซเชียล...'
                  : 'อัปเดตฟีดโซเชียลสด (Google Search)'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Shared Search & Portfolio Switch Toolbar */}
      <section className="bg-[#10151E] border border-[#1E2634] rounded-xl p-4 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder={
                subTab === 'global'
                  ? 'ค้นหาข่าว, Ticker (เช่น QQQM, SMH, GLD, KCG, BTC) หรือแหล่งข่าว...'
                  : 'ค้นหากระแสโซเชียล, ชื่อช่อง/เพจ (เช่น ลงทุนแมน, Finnomena) หรือ Ticker...'
              }
              className="w-full bg-[#090C11] border border-[#253042] rounded-lg pl-10 pr-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/20 transition-all"
              aria-label="ค้นหาข่าวและโซเชียล"
            />
          </div>

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
            <span>เฉพาะที่กระทบพอร์ตฉัน</span>
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

        {subTab === 'global' ? (
          <>
            {/* Country Flag Filter Bar for Global News */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-3 border-t border-[#1A2230]">
              <span className="text-xs text-slate-400 mr-1 whitespace-nowrap shrink-0">
                ประเทศ:
              </span>
              {NEWS_COUNTRY_FILTERS.map((c) => {
                const active = countryFilter === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setCountryFilter(c.code)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      active
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                        : 'bg-[#090C11] border-[#222C3D] text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span>{c.flag}</span>
                    <span>{c.label}</span>
                  </button>
                );
              })}
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
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSentimentFilter(opt.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      sentimentFilter === opt.key
                        ? 'bg-[#1C2536] text-amber-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400">
                {hasGlobalFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setSentimentFilter('ALL');
                      setCountryFilter('ALL');
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
                  {matchedGlobalCount > 0 && (
                    <span className="text-amber-300 ml-1.5">
                      (เชื่อมโยงพอร์ต {matchedGlobalCount})
                    </span>
                  )}
                </span>
              </div>
            </div>
          </>
        ) : (
          /* Social Platform & Sentiment Filters */
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#1A2230]">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-[#090C11] border border-[#1E2634] rounded-lg">
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
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      platformFilter === opt.key
                        ? 'bg-[#1C2536] text-amber-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 p-1 bg-[#090C11] border border-[#1E2634] rounded-lg">
                {(
                  [
                    { key: 'ALL', label: 'ทุกมุมมอง' },
                    { key: 'bullish', label: 'เชิงบวก' },
                    { key: 'bearish', label: 'เชิงลบ' },
                    { key: 'watch', label: 'เฝ้าระวัง' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSocialSentimentFilter(opt.key)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      socialSentimentFilter === opt.key
                        ? 'bg-[#1C2536] text-amber-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs text-slate-400">
              แสดง{' '}
              <strong className="font-mono tabular-nums text-slate-200">
                {filteredSocial.length}
              </strong>{' '}
              ประเด็นเชิงลึก
            </div>
          </div>
        )}
      </section>

      {/* BODY CONTENT */}
      {subTab === 'global' ? (
        <section className="bg-[#10151E] border border-[#1E2634] rounded-xl overflow-hidden">
          {filteredNews.length === 0 ? (
            <div className="py-14 px-6 text-center space-y-3">
              {onlyPortfolio && portfolio.length === 0 ? (
                <>
                  <p className="text-sm text-slate-200 font-medium">
                    พอร์ตโฟลิโอของคุณยังว่างอยู่
                  </p>
                  <p className="text-xs text-slate-400">
                    เพิ่มสินทรัพย์ในพอร์ตก่อน เพื่อให้ระบบคัดกรองข่าวที่ส่งผลทางตรงและทางอ้อมต่อพอร์ตของคุณ
                  </p>
                  <button
                    type="button"
                    onClick={onGoToPortfolio}
                    className="mt-2 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ เพิ่มสินทรัพย์ในพอร์ต</span>
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-300 font-medium">
                    ไม่พบข่าวที่ตรงกับคำค้นหาหรือตัวกรองที่เลือก
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSentimentFilter('ALL');
                      setCountryFilter('ALL');
                      onToggleOnlyPortfolio(false);
                      onSearchQueryChange('');
                    }}
                    className="mt-2 px-4 py-2 text-xs font-medium rounded-lg bg-[#161E2B] border border-[#283549] text-slate-200 hover:bg-[#1E293B] transition-colors cursor-pointer"
                  >
                    แสดงข่าวทั้งหมด
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Desktop News Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0D121A] border-b border-[#1E2634] text-[11px] font-medium text-slate-400">
                      <th className="py-3 px-4 whitespace-nowrap w-44">เวลา / แหล่งข่าว</th>
                      <th className="py-3 px-3 whitespace-nowrap w-44">สินทรัพย์เกี่ยวข้อง</th>
                      <th className="py-3 px-3 whitespace-nowrap w-40">ทิศทางผลกระทบ</th>
                      <th className="py-3 px-4">พาดหัวข่าวและวิเคราะห์ผลกระทบต่อพอร์ต</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A2230]">
                    {filteredNews.map((item) => {
                      const impacts = newsImpactsMap.get(item.id) ?? [];
                      const directCount = impacts.filter((i) => i.relation === 'direct').length;
                      const indirectCount = impacts.length - directCount;
                      const isMatched = impacts.length > 0;

                      return (
                        <tr
                          key={item.id}
                          className={`transition-colors ${
                            directCount > 0
                              ? 'bg-amber-500/[0.06] hover:bg-amber-500/[0.1]'
                              : indirectCount > 0
                              ? 'bg-sky-500/[0.04] hover:bg-sky-500/[0.08]'
                              : 'hover:bg-[#151C28]'
                          }`}
                        >
                          <td className="py-4 px-4 align-top whitespace-nowrap">
                            <div className="flex items-start gap-2.5">
                              <span
                                className={`w-1 h-9 rounded-full mt-0.5 shrink-0 ${
                                  directCount > 0
                                    ? 'bg-amber-400'
                                    : indirectCount > 0
                                    ? 'bg-sky-400'
                                    : 'bg-transparent'
                                }`}
                                aria-hidden="true"
                              />
                              <div>
                                <div className="font-mono tabular-nums text-xs font-medium text-slate-200">
                                  {item.timeLabel}
                                </div>
                                <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                                  <span className="text-sm">{item.countryFlag || '🌐'}</span>
                                  <span className="font-medium text-slate-300">
                                    {item.source}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

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

                          <td className="py-4 px-3 align-top whitespace-nowrap">
                            <div className="pt-0.5">
                              <SentimentIndicator sentiment={item.sentiment} />
                            </div>
                          </td>

                          <td className="py-4 px-4 align-top">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-medium text-slate-100 leading-snug">
                                {item.headline}
                              </h3>
                              {isMatched && (
                                <PortfolioMatchBadge
                                  directCount={directCount}
                                  indirectCount={indirectCount}
                                />
                              )}
                              {item.isLiveSynced && (
                                <span className="text-[10px] font-medium text-sky-300 bg-sky-500/15 px-1.5 py-0.5 rounded">
                                  ข้อมูลสด
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                              {item.impactSummary}
                            </p>
                            {isMatched && (
                              <PortfolioImpactMatrix
                                impacts={impacts}
                                onTickerClick={(sym) => onSearchQueryChange(sym)}
                              />
                            )}
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
                  const impacts = newsImpactsMap.get(item.id) ?? [];
                  const directCount = impacts.filter((i) => i.relation === 'direct').length;
                  const indirectCount = impacts.length - directCount;
                  const isMatched = impacts.length > 0;

                  return (
                    <article
                      key={item.id}
                      className={`p-4 space-y-2.5 ${
                        directCount > 0
                          ? 'bg-amber-500/[0.06]'
                          : indirectCount > 0
                          ? 'bg-sky-500/[0.04]'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="font-mono tabular-nums">{item.timeLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-300 font-medium">
                            {item.countryFlag || '🌐'} {item.source}
                          </span>
                        </div>
                        <SentimentIndicator sentiment={item.sentiment} />
                      </div>
                      <h3 className="text-sm font-medium text-slate-100 leading-snug">
                        {item.headline}
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {item.impactSummary}
                      </p>
                      {isMatched ? (
                        <PortfolioImpactMatrix
                          impacts={impacts}
                          onTickerClick={(sym) => onSearchQueryChange(sym)}
                        />
                      ) : (
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
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
      ) : (
        /* Social Media Deep Insights Grid (10-15 items across X.com, Facebook, YouTube) */
        <section className="space-y-4">
          {filteredSocial.length === 0 ? (
            <div className="bg-[#10151E] border border-[#1E2634] rounded-xl py-14 px-6 text-center space-y-3">
              <p className="text-sm text-slate-300 font-medium">
                ไม่พบประเด็นโซเชียลตามตัวกรองที่เลือก
              </p>
              <button
                type="button"
                onClick={() => {
                  setPlatformFilter('ALL');
                  setSocialSentimentFilter('ALL');
                  onToggleOnlyPortfolio(false);
                  onSearchQueryChange('');
                }}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-[#161E2B] border border-[#283549] text-slate-200 hover:bg-[#1E293B] cursor-pointer"
              >
                แสดงประเด็นโซเชียลทั้งหมด
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredSocial.map((item) => {
                const matchedSymbols = item.relatedAssets.filter((tag) =>
                  isAssetTagMatched(tag, portfolioMap)
                );
                const hasMatch = matchedSymbols.length > 0;
                const actionUrl = buildSocialActionUrl(item);

                return (
                  <article
                    key={item.id}
                    className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between gap-3.5 transition-colors ${
                      hasMatch
                        ? 'bg-gradient-to-br from-amber-500/[0.06] to-[#10151E] border-amber-500/35'
                        : 'bg-[#10151E] border-[#1E2634]'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Top Meta Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <PlatformIcon platform={item.platform} />
                          <span className="text-xs font-semibold text-slate-200 truncate">
                            {item.channelName}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap">
                            · {item.timeLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {item.countryFlag && (
                            <span className="text-sm" aria-hidden="true">
                              {item.countryFlag}
                            </span>
                          )}
                          <SocialSentimentBadge sentiment={item.sentiment} />
                        </div>
                      </div>

                      {/* Headline & Deep Summary */}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-100 leading-snug">
                            {item.title}
                          </h3>
                          {item.isLiveSynced && (
                            <span className="text-[10px] font-medium text-sky-300 bg-sky-500/15 px-1.5 py-0.5 rounded">
                              สด
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                          {item.deepSummaryTh}
                        </p>
                      </div>

                      {/* Analyst View Callout */}
                      {item.analystViewTh && (
                        <div className="px-3 py-2 rounded-lg bg-[#0B0F16] border border-[#1D2636] text-xs text-amber-200/90 leading-relaxed">
                          {item.analystViewTh}
                        </div>
                      )}
                    </div>

                    {/* Footer: Related Assets + External Open Link */}
                    <div className="pt-3 border-t border-[#1B2332] flex flex-wrap items-center justify-between gap-2.5">
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
                      <a
                        href={actionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300 whitespace-nowrap shrink-0"
                      >
                        <span>
                          {item.sourceUrl ? 'เปิดแหล่งที่มา' : 'ค้นหาต้นฉบับ'}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Grounding Sources */}
      {(subTab === 'global' ? sources : socialSources).length > 0 && (
        <section className="bg-[#10151E] border border-[#1E2634] rounded-xl p-4">
          <h3 className="text-xs font-semibold text-slate-300 mb-2">
            แหล่งอ้างอิงจากการอัปเดตข้อมูลสด (Google Search Grounding)
          </h3>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {(subTab === 'global' ? sources : socialSources).map((src) => (
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
