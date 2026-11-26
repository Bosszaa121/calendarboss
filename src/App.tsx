import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Briefcase,
  CalendarRange,
  CheckCircle2,
  LayoutDashboard,
  LogIn,
  Newspaper,
  RefreshCw,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  buildBaselineEarningsXD,
  buildInitialCalendarEvents,
  buildInitialNewsItems,
  buildInitialSocialInsights,
  INITIAL_FEAR_GREED,
} from './data/mockMarketData';
import {
  AssetCategory,
  CalendarEvent,
  DividendXDRecord,
  EarningsRecord,
  EarningsXDResponse,
  FearGreedData,
  LocalUserAccount,
  NavTab,
  NewsItem,
  NewsSubTab,
  PortfolioAsset,
  SocialInsightItem,
  SocialInsightsResponse,
  SyncResponse,
  SyncSource,
} from './types';
import {
  analyzePortfolioImpacts,
  buildPortfolioSymbolMap,
  getDayDiffFromToday,
  getFearGreedLabelTh,
} from './utils/portfolioMatcher';
import {
  getReadAlertsStorageKey,
  GUEST_ACCOUNT_ID,
  loadActiveAccountId,
  loadLocalAccounts,
  loadPortfolioForAccount,
  savePortfolioForAccount,
} from './utils/localAuth';
import {
  BrowserNotificationPermission,
  buildInvestorAlerts,
  fireChromeNotification,
  getBrowserNotificationPermission,
  requestChromeNotificationPermission,
  sendTestChromeNotification,
} from './utils/alertEngine';
import { DashboardView } from './components/DashboardView';
import { PortfolioView } from './components/PortfolioView';
import { CalendarView } from './components/CalendarView';
import { EarningsXDView } from './components/EarningsXDView';
import { NewsView } from './components/NewsView';
import { AuthModal } from './components/AuthModal';
import { NotificationCenter } from './components/NotificationCenter';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

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
  { id: 'earnings', label: 'งบการเงิน & วัน XD', shortLabel: 'งบ & XD', icon: BarChart3 },
  { id: 'news', label: 'ข่าวโลก & โซเชียล', shortLabel: 'ข่าวสาร', icon: Newspaper },
];

const VALID_CATEGORIES = new Set<AssetCategory>([
  'US ETF',
  'Thai Stock',
  'US Stock',
  'Crypto',
  'Commodity',
  'Forex',
]);

function loadReadAlertsForAccount(accountId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(getReadAlertsStorageKey(accountId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((x) => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [newsSubTab, setNewsSubTab] = useState<NewsSubTab>('global');
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Pure Local Multi-Account State (Zero Firebase, 100% isolated portfolios starting empty)
  const [accounts, setAccounts] = useState<LocalUserAccount[]>(() => loadLocalAccounts());
  const [activeAccountId, setActiveAccountId] = useState<string>(() =>
    loadActiveAccountId(loadLocalAccounts())
  );
  const [portfolio, setPortfolio] = useState<PortfolioAsset[]>(() =>
    loadPortfolioForAccount(loadActiveAccountId(loadLocalAccounts()))
  );
  const [readAlertIds, setReadAlertIds] = useState<Set<string>>(() =>
    loadReadAlertsForAccount(loadActiveAccountId(loadLocalAccounts()))
  );

  // Market data state
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(() =>
    buildInitialCalendarEvents()
  );
  const [newsItems, setNewsItems] = useState<NewsItem[]>(() => buildInitialNewsItems());
  const [fearGreed, setFearGreed] = useState<FearGreedData>(INITIAL_FEAR_GREED);
  const [syncSources, setSyncSources] = useState<SyncSource[]>([]);

  // Earnings & XD Tracker state (live synced overrides baseline)
  const [liveEarnings, setLiveEarnings] = useState<EarningsRecord[] | null>(null);
  const [liveDividends, setLiveDividends] = useState<DividendXDRecord[] | null>(null);
  const [earningsSources, setEarningsSources] = useState<SyncSource[]>([]);
  const [isSyncingEarnings, setIsSyncingEarnings] = useState(false);
  const [lastEarningsSyncAt, setLastEarningsSyncAt] = useState<string | null>(null);

  // Social Media Deep Insights state
  const [socialInsights, setSocialInsights] = useState<SocialInsightItem[]>(() =>
    buildInitialSocialInsights()
  );
  const [socialSources, setSocialSources] = useState<SyncSource[]>([]);
  const [isSyncingSocial, setIsSyncingSocial] = useState(false);
  const [lastSocialSyncAt, setLastSocialSyncAt] = useState<string | null>(null);

  // Shared cross-tab filter state
  const [calendarOnlyPortfolio, setCalendarOnlyPortfolio] = useState(false);
  const [newsOnlyPortfolio, setNewsOnlyPortfolio] = useState(false);
  const [newsSearchQuery, setNewsSearchQuery] = useState('');

  // Chrome Notification permission & session deduplication
  const [notificationPermission, setNotificationPermission] =
    useState<BrowserNotificationPermission>(() => getBrowserNotificationPermission());
  const pushedChromeAlertIdsRef = useRef<Set<string>>(new Set());

  // Global Sync & Notice state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Auto-sync first time when portfolio has assets (user preference)
  const autoSyncedSignatureRef = useRef<string | null>(null);

  // Reload portfolio & read alerts whenever activeAccountId switches
  useEffect(() => {
    setPortfolio(loadPortfolioForAccount(activeAccountId));
    setReadAlertIds(loadReadAlertsForAccount(activeAccountId));
    setLiveEarnings(null);
    setLiveDividends(null);
    autoSyncedSignatureRef.current = null;
  }, [activeAccountId]);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) ?? null,
    [accounts, activeAccountId]
  );

  const activeAccountLabel = activeAccount
    ? activeAccount.displayName
    : 'ผู้เยี่ยมชม (Guest)';

  const portfolioMap = useMemo(() => buildPortfolioSymbolMap(portfolio), [portfolio]);

  // Baseline Earnings & XD tailored strictly to current portfolio; replaced when live-synced
  const baselineEarningsXD = useMemo(
    () => buildBaselineEarningsXD(portfolio),
    [portfolio]
  );
  const earningsRecords = liveEarnings ?? baselineEarningsXD.earnings;
  const dividendRecords = liveDividends ?? baselineEarningsXD.dividends;

  // Compute all 4 categories of investor alerts (Macro/News, Earnings 1-3d, XD 1-7d, Risk Warning)
  const investorAlerts = useMemo(
    () =>
      buildInvestorAlerts({
        portfolio,
        portfolioMap,
        calendarEvents,
        newsItems,
        earningsRecords,
        dividendRecords,
        socialInsights,
        fearGreed,
      }),
    [
      portfolio,
      portfolioMap,
      calendarEvents,
      newsItems,
      earningsRecords,
      dividendRecords,
      socialInsights,
      fearGreed,
    ]
  );

  // Automatically trigger Chrome browser notifications when permitted on open / after sync
  useEffect(() => {
    if (notificationPermission !== 'granted') return;
    if (investorAlerts.length === 0) return;

    const candidates = investorAlerts.filter(
      (a) =>
        (a.severity === 'critical' || a.severity === 'high') &&
        !readAlertIds.has(a.id) &&
        !pushedChromeAlertIdsRef.current.has(a.id)
    );

    if (candidates.length === 0) return;

    // Dispatch up to 2 highest-priority Chrome alerts to stay helpful without spamming
    for (const alert of candidates.slice(0, 2)) {
      pushedChromeAlertIdsRef.current.add(alert.id);
      void fireChromeNotification({
        title: alert.title,
        body: alert.body,
        tag: alert.id,
      });
    }
  }, [investorAlerts, notificationPermission, readAlertIds]);

  const matchedCalendar14dCount = useMemo(() => {
    if (portfolio.length === 0) return 0;
    return calendarEvents.filter((ev) => {
      const diff = getDayDiffFromToday(ev.date);
      if (diff < 0 || diff > 14) return false;
      return (
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
        ).length > 0
      );
    }).length;
  }, [calendarEvents, portfolio, portfolioMap]);

  const matchedNewsCount = useMemo(() => {
    if (portfolio.length === 0) return 0;
    return newsItems.filter(
      (n) =>
        analyzePortfolioImpacts(
          {
            title: n.headline,
            description: n.impactSummary,
            category: 'news',
            relatedAssets: n.relatedAssets,
            macroTags: n.macroTags,
            aiImpacts: n.aiImpacts,
          },
          portfolio,
          portfolioMap
        ).length > 0
    ).length;
  }, [newsItems, portfolio, portfolioMap]);

  const urgentEarningsXDCount = useMemo(() => {
    const eSoon = earningsRecords.filter(
      (e) =>
        e.status !== 'not_applicable' &&
        typeof e.daysUntil === 'number' &&
        e.daysUntil >= 0 &&
        e.daysUntil <= 3
    ).length;
    const xSoon = dividendRecords.filter(
      (d) =>
        d.applicable &&
        typeof d.daysUntilXD === 'number' &&
        d.daysUntilXD >= 0 &&
        d.daysUntilXD <= 7
    ).length;
    return eSoon + xSoon;
  }, [earningsRecords, dividendRecords]);

  function handleAddAsset(assetInput: Omit<PortfolioAsset, 'id' | 'addedAt'>) {
    setPortfolio((prev) => {
      if (prev.some((p) => p.symbol.toUpperCase() === assetInput.symbol.toUpperCase())) {
        return prev;
      }
      const next: PortfolioAsset[] = [
        {
          ...assetInput,
          id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          addedAt: new Date().toISOString(),
        },
        ...prev,
      ];
      savePortfolioForAccount(activeAccountId, next);
      return next;
    });
    // Reset live earnings cache so baseline immediately reflects newly added asset until next sync
    setLiveEarnings(null);
    setLiveDividends(null);
  }

  function handleRemoveAsset(id: string) {
    setPortfolio((prev) => {
      const next = prev.filter((item) => item.id !== id);
      savePortfolioForAccount(activeAccountId, next);
      return next;
    });
    setLiveEarnings(null);
    setLiveDividends(null);
  }

  function handleAuthChange(
    nextAccounts: LocalUserAccount[],
    nextActiveId: string,
    message?: string
  ) {
    setAccounts(nextAccounts);
    setActiveAccountId(nextActiveId);
    if (message) {
      setNotice({ type: 'success', message });
    }
  }

  function handleExportJson() {
    const payload = {
      app: 'InvestCal',
      version: 3,
      exportedAt: new Date().toISOString(),
      account: activeAccount ? `@${activeAccount.username}` : 'guest',
      portfolio,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `investcal-portfolio-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setNotice({
      type: 'success',
      message: `ส่งออกไฟล์พอร์ตโฟลิโอ JSON (${portfolio.length} สินทรัพย์) เรียบร้อยแล้ว`,
    });
  }

  function handleImportJsonFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const rawList: unknown[] | null = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.portfolio)
          ? parsed.portfolio
          : null;

        if (!rawList) {
          throw new Error('รูปแบบไฟล์ JSON ไม่ถูกต้อง (ไม่พบรายการ portfolio)');
        }

        const sanitized: Array<Omit<PortfolioAsset, 'id' | 'addedAt'>> = rawList
          .filter(
            (item: unknown): item is Record<string, unknown> =>
              Boolean(item) &&
              typeof item === 'object' &&
              typeof (item as Record<string, unknown>).symbol === 'string'
          )
          .slice(0, 100)
          .map((item: Record<string, unknown>) => {
            const sym = String(item.symbol)
              .trim()
              .toUpperCase()
              .replace(/[^A-Z0-9./-]/g, '')
              .slice(0, 20);
            const rawCat = String(item.category || 'US Stock') as AssetCategory;
            const category: AssetCategory = VALID_CATEGORIES.has(rawCat)
              ? rawCat
              : sym.endsWith('.BK')
              ? 'Thai Stock'
              : 'US Stock';
            return {
              symbol: sym,
              name:
                typeof item.name === 'string' && item.name.trim()
                  ? item.name.slice(0, 140)
                  : sym,
              category,
              market:
                typeof item.market === 'string' && item.market.trim()
                  ? item.market.slice(0, 40)
                  : 'Global',
              flag:
                typeof item.flag === 'string' && item.flag.trim()
                  ? item.flag.slice(0, 12)
                  : '🌐',
              currency:
                typeof item.currency === 'string' && item.currency.trim()
                  ? item.currency.slice(0, 12)
                  : 'USD',
              sector:
                typeof item.sector === 'string' && item.sector.trim()
                  ? item.sector.slice(0, 80)
                  : 'ทั่วไป (General)',
              themes: Array.isArray(item.themes)
                ? item.themes.filter((t: unknown): t is string => typeof t === 'string').slice(0, 8)
                : [],
              topHoldings: Array.isArray(item.topHoldings)
                ? item.topHoldings.filter((t: unknown): t is string => typeof t === 'string').slice(0, 5)
                : undefined,
            };
          })
          .filter((a: Omit<PortfolioAsset, 'id' | 'addedAt'>) => a.symbol.length > 0);

        if (sanitized.length === 0) {
          throw new Error('ไม่พบสินทรัพย์ที่ถูกต้องในไฟล์ JSON');
        }

        setPortfolio((prev) => {
          const existingMap = new Map(prev.map((p) => [p.symbol.toUpperCase(), p]));
          for (const item of sanitized) {
            if (!existingMap.has(item.symbol)) {
              existingMap.set(item.symbol, {
                ...item,
                id: `imp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                addedAt: new Date().toISOString(),
              });
            }
          }
          const merged = Array.from(existingMap.values());
          savePortfolioForAccount(activeAccountId, merged);
          return merged;
        });

        setLiveEarnings(null);
        setLiveDividends(null);
        setNotice({
          type: 'success',
          message: `นำเข้าสินทรัพย์จากไฟล์ JSON จำนวน ${sanitized.length} รายการเรียบร้อยแล้ว`,
        });
      } catch (err) {
        setNotice({
          type: 'error',
          message:
            err instanceof Error
              ? `นำเข้า JSON ไม่สำเร็จ: ${err.message}`
              : 'ไฟล์ JSON ไม่ถูกต้อง',
        });
      }
    };
    reader.readAsText(file);
  }

  function handleNavigate(
    tab: NavTab,
    options?: { onlyPortfolio?: boolean; searchQuery?: string; newsSubTab?: NewsSubTab }
  ) {
    if (tab === 'calendar' && typeof options?.onlyPortfolio === 'boolean') {
      setCalendarOnlyPortfolio(options.onlyPortfolio);
    }
    if (tab === 'news') {
      if (options?.newsSubTab) {
        setNewsSubTab(options.newsSubTab);
      }
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

  function persistReadAlerts(next: Set<string>) {
    setReadAlertIds(next);
    try {
      window.localStorage.setItem(
        getReadAlertsStorageKey(activeAccountId),
        JSON.stringify(Array.from(next))
      );
    } catch {
      // ignore
    }
  }

  function handleMarkAlertRead(id: string) {
    const next = new Set(readAlertIds);
    next.add(id);
    persistReadAlerts(next);
  }

  function handleMarkAllAlertsRead() {
    const next = new Set(readAlertIds);
    for (const a of investorAlerts) next.add(a.id);
    persistReadAlerts(next);
  }

  async function handleRequestChromePermission() {
    const perm = await requestChromeNotificationPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      setNotice({
        type: 'success',
        message: 'เปิดรับการแจ้งเตือนผ่าน Chrome เรียบร้อยแล้ว ระบบจะแจ้งเตือนอัตโนมัติเมื่อพบความเสี่ยง งบ หรือวัน XD',
      });
      await sendTestChromeNotification(portfolio.map((p) => p.symbol));
    } else if (perm === 'denied') {
      setNotice({
        type: 'error',
        message: 'เบราว์เซอร์ปฏิเสธสิทธิ์การแจ้งเตือน กรุณาอนุญาต Notifications ที่ไอคอนตั้งค่าข้างแถบ URL ของ Chrome',
      });
    }
  }

  async function handleSendTestNotification() {
    const sent = await sendTestChromeNotification(portfolio.map((p) => p.symbol));
    setNotice({
      type: 'success',
      message: sent
        ? 'ส่งการแจ้งเตือนทดสอบไปยัง Chrome สำเร็จแล้ว'
        : 'ทดสอบการแจ้งเตือนในแอปสำเร็จ (กดปุ่ม "เปิดรับแจ้งเตือน Chrome" เพื่อรับแจ้งเตือนนอกเบราว์เซอร์)',
    });
  }

  const syncEarningsXDLive = useCallback(
    async (silent = false) => {
      if (portfolio.length === 0 || isSyncingEarnings) return;
      setIsSyncingEarnings(true);
      try {
        const res = await fetch('/api/earnings-xd', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            portfolio: portfolio.map((p) => ({
              symbol: p.symbol,
              name: p.name,
              category: p.category,
              sector: p.sector,
              topHoldings: p.topHoldings,
            })),
          }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error('ไม่สามารถเชื่อมต่อ API งบการเงินได้');
        }
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || 'Sync earnings failed');

        const data = payload as EarningsXDResponse;
        if (Array.isArray(data.earnings) && data.earnings.length > 0) {
          setLiveEarnings(data.earnings);
        }
        if (Array.isArray(data.dividends) && data.dividends.length > 0) {
          setLiveDividends(data.dividends);
        }
        if (Array.isArray(data.sources)) {
          setEarningsSources(data.sources);
        }
        const nowTime = new Date().toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
        });
        setLastEarningsSyncAt(nowTime);
        if (!silent) {
          setNotice({
            type: 'success',
            message: `อัปเดตข้อมูลงบการเงิน (${data.earnings.length}) และวัน XD (${data.dividends.length}) สดผ่าน Google Search เวลา ${nowTime} น.`,
          });
        }
      } catch (err) {
        if (!silent) {
          setNotice({
            type: 'error',
            message:
              err instanceof Error ? err.message : 'ไม่สามารถอัปเดตงบและวัน XD ได้',
          });
        }
      } finally {
        setIsSyncingEarnings(false);
      }
    },
    [portfolio, isSyncingEarnings]
  );

  const syncSocialInsightsLive = useCallback(
    async (silent = false) => {
      if (isSyncingSocial) return;
      setIsSyncingSocial(true);
      try {
        const res = await fetch('/api/social-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            portfolio: portfolio.map((p) => ({
              symbol: p.symbol,
              name: p.name,
              category: p.category,
              sector: p.sector,
            })),
          }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error('ไม่สามารถเชื่อมต่อ API ฟีดโซเชียลได้');
        }
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || 'Sync social failed');

        const data = payload as SocialInsightsResponse;
        if (Array.isArray(data.items) && data.items.length > 0) {
          setSocialInsights(data.items);
        }
        if (Array.isArray(data.sources)) {
          setSocialSources(data.sources);
        }
        const nowTime = new Date().toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
        });
        setLastSocialSyncAt(nowTime);
        if (!silent) {
          setNotice({
            type: 'success',
            message: `อัปเดตฟีดโซเชียล X.com / Facebook / YouTube สดจำนวน ${data.items.length} ประเด็น เวลา ${nowTime} น.`,
          });
        }
      } catch (err) {
        if (!silent) {
          setNotice({
            type: 'error',
            message:
              err instanceof Error ? err.message : 'ไม่สามารถอัปเดตฟีดโซเชียลได้',
          });
        }
      } finally {
        setIsSyncingSocial(false);
      }
    },
    [portfolio, isSyncingSocial]
  );

  const handleLiveSyncAll = useCallback(
    async (silent = false) => {
      if (isSyncing) return;
      setIsSyncing(true);
      if (!silent) setNotice(null);

      try {
        const portfolioPayload = portfolio.map((p) => ({
          symbol: p.symbol,
          name: p.name,
          category: p.category,
          sector: p.sector,
          themes: p.themes,
          topHoldings: p.topHoldings,
        }));

        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ portfolio: portfolioPayload }),
        });

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error('เซิร์ฟเวอร์ซิงค์ข้อมูลสดไม่พร้อมใช้งาน');
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
            updatedLabel: 'อัปเดตสดจาก Google Search',
          }));
        }

        if (Array.isArray(data.sources)) {
          setSyncSources(data.sources);
        }

        // Kick off Earnings/XD & Social Insights sync in background concurrently
        if (portfolio.length > 0) {
          void syncEarningsXDLive(true);
        }
        void syncSocialInsightsLive(true);

        const nowTime = new Date().toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
        });
        setLastSyncedAt(nowTime);
        if (!silent) {
          setNotice({
            type: 'success',
            message: `อัปเดตข้อมูลสดด้วย Google Search สำเร็จ เวลา ${nowTime} น. — ปฏิทิน ${data.calendarEvents.length} รายการ และข่าว ${data.newsItems.length} รายการ`,
          });
        }
      } catch (err) {
        if (!silent) {
          const msg =
            err instanceof Error
              ? err.message
              : 'ไม่สามารถเชื่อมต่อระบบอัปเดตข้อมูลสดได้ในขณะนี้';
          setNotice({ type: 'error', message: msg });
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [isSyncing, portfolio, syncEarningsXDLive, syncSocialInsightsLive]
  );

  // Auto-sync once automatically when the user has assets in their portfolio
  useEffect(() => {
    if (portfolio.length === 0) return;
    const sig = `${activeAccountId}:${portfolio.map((p) => p.symbol).sort().join(',')}`;
    if (autoSyncedSignatureRef.current === null) {
      autoSyncedSignatureRef.current = sig;
      void handleLiveSyncAll(true);
    }
  }, [portfolio, activeAccountId, handleLiveSyncAll]);

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

        {/* Navigation Links (5 Main Tabs) */}
        <nav className="flex-1 px-3 py-5 space-y-1" aria-label="เมนูหลัก">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            const badgeCount =
              item.id === 'calendar'
                ? matchedCalendar14dCount
                : item.id === 'news'
                ? matchedNewsCount
                : item.id === 'earnings'
                ? urgentEarningsXDCount
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
                {badgeCount !== null && badgeCount > 0 && (
                  <span
                    className={`font-mono tabular-nums text-[11px] px-1.5 py-0.5 rounded ${
                      active
                        ? 'text-amber-300 bg-amber-500/15'
                        : item.id === 'earnings'
                        ? 'text-emerald-300 bg-emerald-500/12'
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

        {/* Sidebar Account Profile, PWA Install & Sync Status */}
        <div className="p-3.5 border-t border-[#1B2230] space-y-2.5">
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="w-full p-2.5 rounded-lg bg-[#101621] border border-[#1F293A] hover:border-amber-500/45 transition-colors flex items-center gap-2.5 text-left cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-[#192334] border border-[#29374E] flex items-center justify-center text-amber-300 text-xs font-bold shrink-0">
              {activeAccount ? (
                activeAccount.displayName.slice(0, 2).toUpperCase()
              ) : (
                <UserIcon className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-100 truncate">
                {activeAccountLabel}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {activeAccount ? `@${activeAccount.username} · สลับบัญชี` : 'เข้าสู่ระบบ / สมัครสมาชิก'}
              </div>
            </div>
          </button>

          <PWAInstallButton />

          <div className="px-1 text-[11px] space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span>สินทรัพย์ในพอร์ต</span>
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
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <OfflineIndicator />

        {/* Sticky Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-[#090C11]/90 backdrop-blur-md border-b border-[#1B2230] px-4 sm:px-6 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 lg:hidden shrink-0">
              <InvestCalLogoMark />
              <span className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap">
                InvestCal
              </span>
            </div>

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

          {/* Top-Right Controls: Alerts Bell + PWA Install + Local Account + Live Sync */}
          <div className="flex items-center gap-2 shrink-0">
            <NotificationCenter
              alerts={investorAlerts}
              readAlertIds={readAlertIds}
              permission={notificationPermission}
              onRequestChromePermission={handleRequestChromePermission}
              onSendTestNotification={handleSendTestNotification}
              onMarkRead={handleMarkAlertRead}
              onMarkAllRead={handleMarkAllAlertsRead}
              onSelectAlert={(tab, sub) => handleNavigate(tab, { newsSubTab: sub })}
            />

            <div className="lg:hidden">
              <PWAInstallButton compact />
            </div>

            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="px-2.5 sm:px-3 py-2 text-xs font-medium rounded-lg bg-[#121926] border border-[#253042] text-slate-200 hover:border-amber-500/50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {activeAccount ? (
                <>
                  <UserIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="max-w-[96px] truncate hidden sm:inline">
                    @{activeAccount.username}
                  </span>
                  <span className="sm:hidden">บัญชี</span>
                </>
              ) : (
                <>
                  <LogIn className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="hidden sm:inline">เข้าสู่ระบบ / สมัครสมาชิก</span>
                  <span className="sm:hidden">บัญชี</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => void handleLiveSyncAll(false)}
              disabled={isSyncing}
              className="px-3 sm:px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-70 disabled:cursor-wait transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">
                {isSyncing ? 'กำลังอัปเดตสด...' : 'อัปเดตข้อมูลล่าสุด'}
              </span>
              <span className="sm:hidden">{isSyncing ? 'ซิงค์...' : 'อัปเดต'}</span>
            </button>
          </div>
        </header>

        {/* Sync / Action Notice Banner */}
        {notice && (
          <div className="px-4 sm:px-6 pt-4">
            <div
              className={`rounded-lg px-4 py-2.5 text-xs flex items-center justify-between gap-3 border ${
                notice.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-200'
                  : 'bg-rose-500/10 border-rose-500/35 text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {notice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span className="leading-snug">{notice.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setNotice(null)}
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
              earningsRecords={earningsRecords}
              dividendRecords={dividendRecords}
              alerts={investorAlerts}
              fearGreed={fearGreed}
              onNavigate={handleNavigate}
            />
          )}

          {activeTab === 'portfolio' && (
            <PortfolioView
              portfolio={portfolio}
              calendarEvents={calendarEvents}
              newsItems={newsItems}
              isSignedInLocal={activeAccountId !== GUEST_ACCOUNT_ID}
              accountLabel={activeAccountLabel}
              onAddAsset={handleAddAsset}
              onRemoveAsset={handleRemoveAsset}
              onExportJson={handleExportJson}
              onImportJsonFile={handleImportJsonFile}
              onOpenAuth={() => setAuthModalOpen(true)}
              onNavigate={handleNavigate}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarView
              events={calendarEvents}
              portfolio={portfolio}
              portfolioMap={portfolioMap}
              onlyPortfolio={calendarOnlyPortfolio}
              onToggleOnlyPortfolio={setCalendarOnlyPortfolio}
              onAssetTagClick={(symbol) =>
                handleNavigate('news', { searchQuery: symbol, newsSubTab: 'global' })
              }
              onGoToPortfolio={() => handleNavigate('portfolio')}
            />
          )}

          {activeTab === 'earnings' && (
            <EarningsXDView
              portfolio={portfolio}
              earnings={earningsRecords}
              dividends={dividendRecords}
              sources={earningsSources}
              isSyncing={isSyncingEarnings}
              lastSyncedAt={lastEarningsSyncAt}
              onSyncLive={() => void syncEarningsXDLive(false)}
              onGoToPortfolio={() => handleNavigate('portfolio')}
            />
          )}

          {activeTab === 'news' && (
            <NewsView
              subTab={newsSubTab}
              onSubTabChange={setNewsSubTab}
              newsItems={newsItems}
              socialInsights={socialInsights}
              portfolio={portfolio}
              portfolioMap={portfolioMap}
              onlyPortfolio={newsOnlyPortfolio}
              onToggleOnlyPortfolio={setNewsOnlyPortfolio}
              searchQuery={newsSearchQuery}
              onSearchQueryChange={setNewsSearchQuery}
              sources={syncSources}
              socialSources={socialSources}
              isSyncingSocial={isSyncingSocial}
              lastSocialSyncAt={lastSocialSyncAt}
              onSyncSocialLive={() => void syncSocialInsightsLive(false)}
              onGoToPortfolio={() => handleNavigate('portfolio')}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (5 Main Tabs) */}
      <nav
        aria-label="แถบนำทางมือถือ"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-[#0C1017]/95 backdrop-blur-md border-t border-[#1E2634] grid grid-cols-5"
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
              <span className="text-[10px] font-medium whitespace-nowrap">
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Local Multi-Account Auth & JSON Backup Modal */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        accounts={accounts}
        activeAccountId={activeAccountId}
        onAuthChange={handleAuthChange}
        onExportJson={handleExportJson}
        onImportJsonFile={handleImportJsonFile}
      />
    </div>
  );
}
