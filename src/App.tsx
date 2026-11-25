import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  CalendarRange,
  CheckCircle2,
  LayoutDashboard,
  Newspaper,
  RefreshCw,
  X,
  AlertCircle,
} from 'lucide-react';
import { DEFAULT_PORTFOLIO } from './data/assetCatalog';
import {
  buildInitialCalendarEvents,
  buildInitialNewsItems,
  INITIAL_FEAR_GREED,
} from './data/mockMarketData';
import {
  CalendarEvent,
  FearGreedData,
  NavTab,
  NewsItem,
  PortfolioAsset,
  SyncResponse,
  SyncSource,
} from './types';
import {
  buildPortfolioSymbolMap,
  getDayDiffFromToday,
  getFearGreedLabelTh,
  getMatchedPortfolioSymbols,
} from './utils/portfolioMatcher';
import { DashboardView } from './components/DashboardView';
import { PortfolioView } from './components/PortfolioView';
import { CalendarView } from './components/CalendarView';
import { NewsView } from './components/NewsView';

const PORTFOLIO_STORAGE_KEY = 'investcal_portfolio_v1';

function loadSavedPortfolio(): PortfolioAsset[] {
  try {
    const raw = window.localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    if (!raw) return DEFAULT_PORTFOLIO;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return DEFAULT_PORTFOLIO;
  } catch {
    return DEFAULT_PORTFOLIO;
  }
}

function InvestCalLogoMark() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="w-8 h-8 shrink-0"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="4"
        width="28"
        height="25"
        rx="6"
        fill="#141C28"
        stroke="#F59E0B"
        strokeWidth="1.75"
      />
      <path d="M2 11H30" stroke="#283549" strokeWidth="1.5" />
      <path d="M10 2V6.5M22 2V6.5" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M8 22L13 17.5L17 20L24 14"
        stroke="#FBBF24"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="14" r="2" fill="#10B981" />
    </svg>
  );
}

const NAV_ITEMS: Array<{
  id: NavTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'แดชบอร์ดภาพรวม', shortLabel: 'ภาพรวม', icon: LayoutDashboard },
  { id: 'portfolio', label: 'พอร์ตโฟลิโอของฉัน', shortLabel: 'พอร์ตฉัน', icon: Briefcase },
  { id: 'calendar', label: 'ปฏิทินการลงทุน', shortLabel: 'ปฏิทิน', icon: CalendarRange },
  { id: 'news', label: 'ข่าวสารทั่วโลก', shortLabel: 'ข่าวโลก', icon: Newspaper },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [portfolio, setPortfolio] = useState<PortfolioAsset[]>(() => loadSavedPortfolio());
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(() =>
    buildInitialCalendarEvents()
  );
  const [newsItems, setNewsItems] = useState<NewsItem[]>(() => buildInitialNewsItems());
  const [fearGreed, setFearGreed] = useState<FearGreedData>(INITIAL_FEAR_GREED);
  const [syncSources, setSyncSources] = useState<SyncSource[]>([]);

  // Shared filter states for smooth cross-tab navigation
  const [calendarOnlyPortfolio, setCalendarOnlyPortfolio] = useState(false);
  const [newsOnlyPortfolio, setNewsOnlyPortfolio] = useState(false);
  const [newsSearchQuery, setNewsSearchQuery] = useState('');

  // Real-time Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Persist portfolio changes to LocalStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(portfolio));
    } catch {
      // Ignore storage quota errors gracefully
    }
  }, [portfolio]);

  const portfolioMap = useMemo(() => buildPortfolioSymbolMap(portfolio), [portfolio]);

  const matchedCalendar14dCount = useMemo(
    () =>
      calendarEvents.filter((ev) => {
        const diff = getDayDiffFromToday(ev.date);
        return (
          diff >= 0 &&
          diff <= 14 &&
          getMatchedPortfolioSymbols(ev.relatedAssets, portfolioMap).length > 0
        );
      }).length,
    [calendarEvents, portfolioMap]
  );

  const matchedNewsCount = useMemo(
    () =>
      newsItems.filter(
        (n) => getMatchedPortfolioSymbols(n.relatedAssets, portfolioMap).length > 0
      ).length,
    [newsItems, portfolioMap]
  );

  function handleAddAsset(assetInput: Omit<PortfolioAsset, 'id' | 'addedAt'>) {
    setPortfolio((prev) => {
      if (prev.some((p) => p.symbol.toUpperCase() === assetInput.symbol.toUpperCase())) {
        return prev;
      }
      return [
        {
          ...assetInput,
          id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          addedAt: new Date().toISOString(),
        },
        ...prev,
      ];
    });
  }

  function handleRemoveAsset(id: string) {
    setPortfolio((prev) => prev.filter((item) => item.id !== id));
  }

  function handleResetDefaultPortfolio() {
    setPortfolio(DEFAULT_PORTFOLIO);
  }

  function handleNavigate(
    tab: NavTab,
    options?: { onlyPortfolio?: boolean; searchQuery?: string }
  ) {
    if (tab === 'calendar') {
      if (typeof options?.onlyPortfolio === 'boolean') {
        setCalendarOnlyPortfolio(options.onlyPortfolio);
      }
    }
    if (tab === 'news') {
      if (typeof options?.onlyPortfolio === 'boolean') {
        setNewsOnlyPortfolio(options.onlyPortfolio);
      }
      if (typeof options?.searchQuery === 'string') {
        setNewsSearchQuery(options.searchQuery);
        setNewsOnlyPortfolio(false);
      }
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleLiveSync() {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncNotice(null);

    try {
      const symbols = portfolio.map((p) => p.symbol);
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(
          'เซิร์ฟเวอร์ซิงค์ข้อมูลสดไม่พร้อมใช้งานในโหมดสแตติก กำลังแสดงชุดข้อมูลปฏิทินและข่าวจำลองล่าสุด'
        );
      }

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || `Sync failed (${res.status})`);
      }

      const data = payload as SyncResponse;

      if (Array.isArray(data.calendarEvents) && data.calendarEvents.length > 0) {
        setCalendarEvents((prev) => {
          const nonLive = prev.filter((e) => !e.isLiveSynced);
          return [...data.calendarEvents, ...nonLive];
        });
      }

      if (Array.isArray(data.newsItems) && data.newsItems.length > 0) {
        setNewsItems((prev) => {
          const nonLive = prev.filter((n) => !n.isLiveSynced);
          return [...data.newsItems, ...nonLive];
        });
      }

      if (data.fearGreed && typeof data.fearGreed.value === 'number') {
        const val = data.fearGreed.value;
        setFearGreed((prev) => ({
          ...prev,
          value: val,
          labelTh: getFearGreedLabelTh(val),
          previousClose: data.fearGreed?.previousClose ?? prev.previousClose,
          oneWeekAgo: data.fearGreed?.oneWeekAgo ?? prev.oneWeekAgo,
          oneMonthAgo: data.fearGreed?.oneMonthAgo ?? prev.oneMonthAgo,
          marketNote: data.fearGreed?.marketNote ?? prev.marketNote,
          updatedLabel: 'อัปเดตสดจากเว็บ',
        }));
      }

      if (Array.isArray(data.sources)) {
        setSyncSources(data.sources);
      }

      const nowTime = new Date().toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setLastSyncedAt(nowTime);
      setSyncNotice({
        type: 'success',
        message: `อัปเดตข้อมูลสดสำเร็จ เวลา ${nowTime} น. — เพิ่มปฏิทิน ${data.calendarEvents.length} รายการ และข่าว ${data.newsItems.length} รายการ`,
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'ไม่สามารถเชื่อมต่อระบบอัปเดตข้อมูลสดได้ในขณะนี้';
      setSyncNotice({
        type: 'error',
        message: msg,
      });
    } finally {
      setIsSyncing(false);
    }
  }

  const currentNavMeta = NAV_ITEMS.find((n) => n.id === activeTab) ?? NAV_ITEMS[0];

  const todayFormattedTh = useMemo(() => {
    return new Date().toLocaleDateString('th-TH', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#090C11] text-[#E6EDF3] flex">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-[#0C1017] border-r border-[#1B2230] z-30">
        {/* Brand */}
        <div className="h-16 px-5 flex items-center gap-3 border-b border-[#1B2230]">
          <InvestCalLogoMark />
          <span className="text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap">
            InvestCal
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-5 space-y-1" aria-label="เมนูหลัก">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            const badgeCount =
              item.id === 'calendar'
                ? matchedCalendar14dCount
                : item.id === 'news'
                ? matchedNewsCount
                : item.id === 'portfolio'
                ? portfolio.length
                : null;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-amber-500/12 text-amber-300 border border-amber-500/25'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-[#141B27] border border-transparent'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      active ? 'text-amber-400' : 'text-slate-500'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {badgeCount !== null && (
                  <span
                    className={`font-mono tabular-nums text-[11px] px-1.5 py-0.5 rounded ${
                      active
                        ? 'text-amber-300 bg-amber-500/15'
                        : 'text-slate-500'
                    }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer Info */}
        <div className="p-4 border-t border-[#1B2230] text-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span>สินทรัพย์ที่ติดตาม</span>
            <span className="font-mono tabular-nums text-slate-200 font-semibold">
              {portfolio.length} รายการ
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>ซิงค์ข้อมูลล่าสุด</span>
            <span className="font-mono tabular-nums">
              {lastSyncedAt ? `${lastSyncedAt} น.` : 'ข้อมูลพื้นฐาน'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-[#090C11]/90 backdrop-blur-md border-b border-[#1B2230] px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Brand Mark */}
            <div className="flex items-center gap-2 lg:hidden shrink-0">
              <InvestCalLogoMark />
              <span className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap">
                InvestCal
              </span>
            </div>

            {/* Desktop Contextual Page Heading */}
            <div className="hidden lg:flex items-center gap-2.5 min-w-0">
              <h1 className="text-base font-semibold text-slate-100 whitespace-nowrap">
                {currentNavMeta.label}
              </h1>
              <span className="text-slate-600" aria-hidden="true">/</span>
              <span className="text-xs text-slate-400 truncate">
                {todayFormattedTh}
              </span>
            </div>
          </div>

          {/* Primary Top-Right Action: Live Sync */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleLiveSync}
              disabled={isSyncing}
              className="px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-70 disabled:cursor-wait transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`}
              />
              <span>{isSyncing ? 'กำลังอัปเดตข้อมูล...' : 'อัปเดตข้อมูลล่าสุด'}</span>
            </button>
          </div>
        </header>

        {/* Sync Feedback Banner */}
        {syncNotice && (
          <div className="px-4 sm:px-6 pt-4">
            <div
              className={`rounded-lg px-4 py-2.5 text-xs flex items-center justify-between gap-3 border ${
                syncNotice.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-200'
                  : 'bg-rose-500/10 border-rose-500/35 text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {syncNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span className="leading-snug">{syncNotice.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setSyncNotice(null)}
                className="text-slate-400 hover:text-slate-100 shrink-0 cursor-pointer"
                aria-label="ปิดการแจ้งเตือน"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Active View Content */}
        <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 py-5 pb-24 lg:pb-10">
          {/* Mobile Section Title */}
          <div className="lg:hidden mb-4">
            <h1 className="text-lg font-semibold text-slate-100">
              {currentNavMeta.label}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">{todayFormattedTh}</p>
          </div>

          {activeTab === 'dashboard' && (
            <DashboardView
              portfolio={portfolio}
              portfolioMap={portfolioMap}
              calendarEvents={calendarEvents}
              newsItems={newsItems}
              fearGreed={fearGreed}
              onNavigate={handleNavigate}
            />
          )}

          {activeTab === 'portfolio' && (
            <PortfolioView
              portfolio={portfolio}
              calendarEvents={calendarEvents}
              newsItems={newsItems}
              onAddAsset={handleAddAsset}
              onRemoveAsset={handleRemoveAsset}
              onResetDefault={handleResetDefaultPortfolio}
              onNavigate={handleNavigate}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarView
              events={calendarEvents}
              portfolioMap={portfolioMap}
              onlyPortfolio={calendarOnlyPortfolio}
              onToggleOnlyPortfolio={setCalendarOnlyPortfolio}
              onAssetTagClick={(symbol) =>
                handleNavigate('news', { searchQuery: symbol })
              }
            />
          )}

          {activeTab === 'news' && (
            <NewsView
              newsItems={newsItems}
              portfolioMap={portfolioMap}
              onlyPortfolio={newsOnlyPortfolio}
              onToggleOnlyPortfolio={setNewsOnlyPortfolio}
              searchQuery={newsSearchQuery}
              onSearchQueryChange={setNewsSearchQuery}
              sources={syncSources}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="แถบนำทางมือถือ"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-[#0C1017]/95 backdrop-blur-md border-t border-[#1E2634] grid grid-cols-4"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              className={`flex flex-col items-center justify-center gap-1 min-h-[44px] transition-colors cursor-pointer ${
                active ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-medium whitespace-nowrap">
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
