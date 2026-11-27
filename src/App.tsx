import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Briefcase,
  CalendarRange,
  CheckCircle2,
  LayoutDashboard,
  Newspaper,
  RefreshCw,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  AssetCategory,
  CalendarEvent,
  ChartTargetAsset,
  DividendXDRecord,
  EarningsRecord,
  FearGreedData,
  LiveAssetQuote,
  LocalUserAccount,
  NavTab,
  NewsItem,
  NewsSubTab,
  PortfolioAsset,
  SocialInsightItem,
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
import {
  BATCHED_CACHE_TTL_MS,
  buildPortfolioSignature,
  getLocalTodayIso,
  isCacheFresh,
  loadCachedBatchedData,
  saveCachedBatchedData,
} from './utils/liveDataCache';
import { markServedFromCache } from './utils/quotaTracker';
import { syncBatchedInvestCalLive } from './services/geminiService';
import { DashboardView } from './components/DashboardView';
import { PortfolioView } from './components/PortfolioView';
import { CalendarView } from './components/CalendarView';
import { EarningsXDView } from './components/EarningsXDView';
import { NewsView } from './components/NewsView';
import { AuthModal } from './components/AuthModal';
import { NotificationCenter } from './components/NotificationCenter';
import { OfflineIndicator } from './components/OfflineIndicator';
import { HeaderQuotaDot, useQuotaSnapshot } from './components/ApiQuotaGauge';
import { TrendFibonacciSheet } from './components/TrendFibonacciSheet';

function InvestCalLogoMark() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="w-7 h-7 shrink-0"
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
        d="M9 19H23M9 23.5H17"
        stroke="#FBBF24"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <circle cx="23" cy="23.5" r="2" fill="#10B981" />
    </svg>
  );
}

const NAV_ITEMS: Array<{
  id: NavTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'ภาพรวมการลงทุน', shortLabel: 'ภาพรวม', icon: LayoutDashboard },
  { id: 'portfolio', label: 'พอร์ตของฉัน', shortLabel: 'พอร์ตฉัน', icon: Briefcase },
  { id: 'calendar', label: 'ปฏิทินเศรษฐกิจ', shortLabel: 'ปฏิทิน', icon: CalendarRange },
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

function formatThaiTimeNow(): string {
  return new Date().toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [newsSubTab, setNewsSubTab] = useState<NewsSubTab>('global');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [trendTargetAsset, setTrendTargetAsset] = useState<ChartTargetAsset | null>(null);
  const quota = useQuotaSnapshot();

  // Pure Local Multi-Account State (100% isolated portfolios starting empty)
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

  const portfolioSignature = useMemo(
    () => buildPortfolioSignature(portfolio.map((p) => p.symbol)),
    [portfolio]
  );

  // Hydrate strictly from 6-hour unified batched cache (Zero Mock Data)
  const initialBundle = useMemo(() => {
    const acct = loadActiveAccountId(loadLocalAccounts());
    const initPort = loadPortfolioForAccount(acct);
    const initSig = buildPortfolioSignature(initPort.map((p) => p.symbol));
    return loadCachedBatchedData(acct, initSig);
  }, []);

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(
    () => initialBundle?.calendarEvents ?? []
  );
  const [newsItems, setNewsItems] = useState<NewsItem[]>(() => initialBundle?.newsItems ?? []);
  const [fearGreed, setFearGreed] = useState<FearGreedData | null>(
    () => initialBundle?.fearGreed ?? null
  );
  const [earningsRecords, setEarningsRecords] = useState<EarningsRecord[]>(
    () => initialBundle?.earnings ?? []
  );
  const [dividendRecords, setDividendRecords] = useState<DividendXDRecord[]>(
    () => initialBundle?.dividends ?? []
  );
  const [socialInsights, setSocialInsights] = useState<SocialInsightItem[]>(
    () => initialBundle?.socialInsights ?? []
  );
  const [liveQuotes, setLiveQuotes] = useState<Record<string, LiveAssetQuote>>(
    () => initialBundle?.quotes ?? {}
  );
  const [syncSources, setSyncSources] = useState<SyncSource[]>(
    () => initialBundle?.sources ?? []
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    () => initialBundle?.syncedTimeLabel ?? null
  );

  // Shared cross-tab filter state
  const [calendarOnlyPortfolio, setCalendarOnlyPortfolio] = useState(false);
  const [newsOnlyPortfolio, setNewsOnlyPortfolio] = useState(false);
  const [newsSearchQuery, setNewsSearchQuery] = useState('');

  // Chrome Notification permission & session deduplication
  const [notificationPermission, setNotificationPermission] =
    useState<BrowserNotificationPermission>(() => getBrowserNotificationPermission());
  const pushedChromeAlertIdsRef = useRef<Set<string>>(new Set());

  // Notice banner state
  const [notice, setNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const batchedReqIdRef = useRef(0);
  const portfolioRef = useRef<PortfolioAsset[]>(portfolio);
  portfolioRef.current = portfolio;

  const activeAccountIdRef = useRef<string>(activeAccountId);
  activeAccountIdRef.current = activeAccountId;

  // Reload isolated portfolio & 6-hour batched cache whenever activeAccountId switches
  useEffect(() => {
    const nextPortfolio = loadPortfolioForAccount(activeAccountId);
    const nextSig = buildPortfolioSignature(nextPortfolio.map((p) => p.symbol));
    setPortfolio(nextPortfolio);
    setReadAlertIds(loadReadAlertsForAccount(activeAccountId));

    const cached = loadCachedBatchedData(activeAccountId, nextSig);
    setCalendarEvents(cached?.calendarEvents ?? []);
    setNewsItems(cached?.newsItems ?? []);
    setFearGreed(cached?.fearGreed ?? null);
    setEarningsRecords(cached?.earnings ?? []);
    setDividendRecords(cached?.dividends ?? []);
    setSocialInsights(cached?.socialInsights ?? []);
    setLiveQuotes(cached?.quotes ?? {});
    setSyncSources(cached?.sources ?? []);
    setLastSyncedAt(cached?.syncedTimeLabel ?? null);
    setSyncError(null);
  }, [activeAccountId]);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) ?? null,
    [accounts, activeAccountId]
  );

  const activeAccountLabel = activeAccount
    ? activeAccount.displayName
    : 'ผู้เยี่ยมชม (Guest)';

  const portfolioMap = useMemo(() => buildPortfolioSymbolMap(portfolio), [portfolio]);

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
        d.xdStatus === 'announced' &&
        typeof d.daysUntilXD === 'number' &&
        d.daysUntilXD >= 0 &&
        d.daysUntilXD <= 7
    ).length;
    return eSoon + xSoon;
  }, [earningsRecords, dividendRecords]);

  // SINGLE BATCHED SYNC: Free Google News RSS + Yahoo Finance + 1 Gemini Call (Cached 6h)
  const syncBatchedAllLive = useCallback(
    async (targetPortfolio: PortfolioAsset[], targetAccountId: string, silent = false) => {
      const reqId = ++batchedReqIdRef.current;
      const targetSig = buildPortfolioSignature(targetPortfolio.map((p) => p.symbol));
      setIsSyncing(true);
      setSyncError(null);
      if (!silent) setNotice(null);

      try {
        const data = await syncBatchedInvestCalLive(targetPortfolio, { force: !silent });
        if (reqId !== batchedReqIdRef.current) return;

        const nowTime = formatThaiTimeNow();

        let nextFearGreed: FearGreedData | null = null;
        if (data.fearGreed && typeof data.fearGreed.value === 'number') {
          const val = data.fearGreed.value;
          nextFearGreed = {
            value: val,
            labelTh: data.fearGreed.labelTh || getFearGreedLabelTh(val),
            previousClose: data.fearGreed.previousClose ?? val,
            oneWeekAgo: data.fearGreed.oneWeekAgo ?? val,
            oneMonthAgo: data.fearGreed.oneMonthAgo ?? val,
            marketNote:
              data.fearGreed.marketNote ||
              'วิเคราะห์บรรยากาศตลาดล่าสุดจากข่าว RSS และ Yahoo Finance',
            updatedLabel: data.fearGreed.updatedLabel || `อัปเดตสด ${nowTime} น.`,
          };
        }

        setCalendarEvents(data.calendarEvents);
        setNewsItems(data.newsItems);
        setFearGreed((prev) => nextFearGreed ?? prev);
        setEarningsRecords(data.earnings);
        setDividendRecords(data.dividends);
        setSocialInsights(data.socialInsights);
        setLiveQuotes(data.quotes || {});
        setSyncSources(data.sources);
        setLastSyncedAt(nowTime);

        saveCachedBatchedData(targetAccountId, {
          portfolioSignature: targetSig,
          calendarEvents: data.calendarEvents,
          newsItems: data.newsItems,
          fearGreed: nextFearGreed,
          earnings: data.earnings,
          dividends: data.dividends,
          socialInsights: data.socialInsights,
          quotes: data.quotes || {},
          sources: data.sources,
          syncedAt: data.syncedAt,
          syncedDateIso: getLocalTodayIso(),
          syncedTimeLabel: nowTime,
        });

        if (data.aiWarning) {
          setSyncError(data.aiWarning);
          if (!silent) {
            setNotice({
              type: 'error',
              message: `${data.aiWarning} (ดึงข่าวสด ${data.newsItems.length} รายการ และราคาหุ้น ${Object.keys(data.quotes || {}).length} ตัวสำเร็จ)`,
            });
          }
        } else if (!silent) {
          setNotice({
            type: 'success',
            message: `อัปเดตสำเร็จ ${nowTime} น. — ปฏิทิน ${data.calendarEvents.length}, ข่าว ${data.newsItems.length}, ราคา ${Object.keys(data.quotes || {}).length} ตัว`,
          });
        }
      } catch (err) {
        if (reqId !== batchedReqIdRef.current) return;
        const msg =
          err instanceof Error
            ? err.message
            : 'ไม่สามารถอัปเดตข้อมูลตลาดสดได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง';
        setSyncError(msg);
        if (!silent) {
          setNotice({ type: 'error', message: msg });
        }
      } finally {
        if (reqId === batchedReqIdRef.current) {
          setIsSyncing(false);
        }
      }
    },
    []
  );

  const handleLiveSyncAll = useCallback(
    async (silent = false) => {
      await syncBatchedAllLive(portfolioRef.current, activeAccountIdRef.current, silent);
    },
    [syncBatchedAllLive]
  );

  // Automatic 6-Hour Cached Batched Sync Lifecycle
  const lastAutoSyncKeyRef = useRef<string>('');
  useEffect(() => {
    const syncKey = `${activeAccountId}::${portfolioSignature}`;
    if (lastAutoSyncKeyRef.current === syncKey) return;

    const cached = loadCachedBatchedData(activeAccountId, portfolioSignature);
    const hasFreshCache =
      cached &&
      (cached.calendarEvents.length > 0 || cached.newsItems.length > 0) &&
      isCacheFresh(cached.syncedAt, cached.syncedDateIso, BATCHED_CACHE_TTL_MS);

    if (hasFreshCache) {
      lastAutoSyncKeyRef.current = syncKey;
      markServedFromCache();
      return;
    }

    const delayMs = lastAutoSyncKeyRef.current === '' ? 150 : 1200;
    const timer = window.setTimeout(() => {
      lastAutoSyncKeyRef.current = syncKey;
      void syncBatchedAllLive(portfolioRef.current, activeAccountId, true);
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [activeAccountId, portfolioSignature, syncBatchedAllLive]);

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
    setSyncError(null);
  }

  function handleRemoveAsset(id: string) {
    setPortfolio((prev) => {
      const next = prev.filter((item) => item.id !== id);
      savePortfolioForAccount(activeAccountId, next);
      return next;
    });
    setSyncError(null);
  }

  function handleUpdateAssetCost(id: string, averageCost?: number, quantity?: number) {
    setPortfolio((prev) => {
      const next = prev.map((item) =>
        item.id === id ? { ...item, averageCost, quantity } : item
      );
      savePortfolioForAccount(activeAccountId, next);
      return next;
    });
    setTrendTargetAsset((prev) =>
      prev && prev.portfolioId === id ? { ...prev, averageCost, quantity } : prev
    );
  }

  function handleAuthChange(
    nextAccounts: LocalUserAccount[],
    nextActiveId: string,
    message?: string
  ) {
    setAccounts(nextAccounts);
    setActiveAccountId(nextActiveId);
    lastAutoSyncKeyRef.current = '';
    if (message) {
      setNotice({ type: 'success', message });
    }
  }

  function handleExportJson() {
    const payload = {
      app: 'InvestCal',
      version: 5,
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
                ? item.topHoldings
                    .filter((t: unknown): t is string => typeof t === 'string')
                    .slice(0, 5)
                : undefined,
              averageCost:
                typeof item.averageCost === 'number' &&
                Number.isFinite(item.averageCost) &&
                item.averageCost > 0
                  ? item.averageCost
                  : undefined,
              quantity:
                typeof item.quantity === 'number' &&
                Number.isFinite(item.quantity) &&
                item.quantity > 0
                  ? item.quantity
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

        setAuthModalOpen(false);
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
        message: 'เปิดรับการแจ้งเตือนผ่าน Chrome เรียบร้อยแล้ว',
      });
      await sendTestChromeNotification(portfolio.map((p) => p.symbol));
    } else if (perm === 'denied') {
      setNotice({
        type: 'error',
        message: 'เบราว์เซอร์ปฏิเสธสิทธิ์การแจ้งเตือน กรุณาอนุญาตในการตั้งค่า Chrome',
      });
    }
  }

  async function handleSendTestNotification() {
    const sent = await sendTestChromeNotification(portfolio.map((p) => p.symbol));
    setNotice({
      type: 'success',
      message: sent
        ? 'ส่งการแจ้งเตือนทดสอบไปยัง Chrome สำเร็จแล้ว'
        : 'ทดสอบการแจ้งเตือนในแอปสำเร็จ',
    });
  }

  const todayShortTh = useMemo(() => {
    return new Date().toLocaleDateString('th-TH', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#090C11] text-[#E6EDF3] overflow-x-hidden">
      <OfflineIndicator />

      {/* Centered Mobile-First App Shell */}
      <div className="max-w-xl mx-auto min-h-screen flex flex-col pb-24">
        {/* Clean Single-Row Sticky Top Header (h-14) */}
        <header className="sticky top-0 z-30 h-14 bg-[#090C11]/95 backdrop-blur-md border-b border-[#1B2230] px-4 flex items-center justify-between gap-2">
          {/* Left: Full InvestCal Logo & Brand (never clipped) */}
          <button
            type="button"
            onClick={() => handleNavigate('dashboard')}
            className="flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <InvestCalLogoMark />
            <span className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap">
              InvestCal
            </span>
          </button>

          {/* Right: ONLY Quota Dot + Bell + Account + Update */}
          <div className="flex items-center gap-1.5 shrink-0">
            <HeaderQuotaDot quota={quota} onClick={() => setAuthModalOpen(true)} />

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

            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="h-9 px-2.5 text-xs font-medium rounded-lg bg-[#121926] border border-[#253042] text-slate-200 hover:border-amber-500/50 transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UserIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>บัญชี</span>
            </button>

            <button
              type="button"
              onClick={() => void handleLiveSyncAll(false)}
              disabled={isSyncing || quota.isCoolingDown}
              className="h-9 px-2.5 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-65 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`}
              />
              <span>
                {isSyncing
                  ? 'อัปเดต...'
                  : quota.isCoolingDown
                  ? `${quota.cooldownSecondsLeft}s`
                  : 'อัปเดต'}
              </span>
            </button>
          </div>
        </header>

        {/* Compact Status Meta Strip */}
        <div className="px-4 pt-3 pb-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <span className="truncate">{todayShortTh} · {activeAccountLabel}</span>
          <span className="font-mono tabular-nums shrink-0">
            {isSyncing ? 'กำลังซิงค์...' : lastSyncedAt ? `อัปเดต ${lastSyncedAt} น.` : 'รออัปเดต'}
          </span>
        </div>

        {/* Notice Toast Banner */}
        {notice && (
          <div className="px-4 pt-2">
            <div
              className={`rounded-xl px-3.5 py-2.5 text-xs flex items-center justify-between gap-2.5 border ${
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
                className="text-slate-400 hover:text-slate-100 shrink-0 cursor-pointer p-1"
                aria-label="ปิดการแจ้งเตือน"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Active View Content */}
        <main className="flex-1 p-4 space-y-3">
          {activeTab === 'dashboard' && (
            <DashboardView
              portfolio={portfolio}
              portfolioMap={portfolioMap}
              liveQuotes={liveQuotes}
              calendarEvents={calendarEvents}
              newsItems={newsItems}
              earningsRecords={earningsRecords}
              dividendRecords={dividendRecords}
              alerts={investorAlerts}
              fearGreed={fearGreed}
              isLoadingMarket={isSyncing}
              marketError={syncError}
              onRetryMarket={() => void handleLiveSyncAll(false)}
              onOpenTrendSheet={setTrendTargetAsset}
              onNavigate={handleNavigate}
            />
          )}

          {activeTab === 'portfolio' && (
            <PortfolioView
              portfolio={portfolio}
              calendarEvents={calendarEvents}
              newsItems={newsItems}
              liveQuotes={liveQuotes}
              isSignedInLocal={activeAccountId !== GUEST_ACCOUNT_ID}
              accountLabel={activeAccountLabel}
              onAddAsset={handleAddAsset}
              onRemoveAsset={handleRemoveAsset}
              onUpdateAssetCost={handleUpdateAssetCost}
              onOpenTrendSheet={setTrendTargetAsset}
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
              isLoading={isSyncing}
              error={syncError}
              sources={syncSources}
              onRetrySync={() => void handleLiveSyncAll(false)}
            />
          )}

          {activeTab === 'earnings' && (
            <EarningsXDView
              portfolio={portfolio}
              earnings={earningsRecords}
              dividends={dividendRecords}
              liveQuotes={liveQuotes}
              sources={syncSources}
              isSyncing={isSyncing}
              error={syncError}
              lastSyncedAt={lastSyncedAt}
              onSyncLive={() => void handleLiveSyncAll(false)}
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
              socialSources={syncSources}
              isLoadingNews={isSyncing}
              newsError={syncError}
              onRetryMarket={() => void handleLiveSyncAll(false)}
              isSyncingSocial={isSyncing}
              socialError={syncError}
              lastSocialSyncAt={lastSyncedAt}
              onSyncSocialLive={() => void handleLiveSyncAll(false)}
              onGoToPortfolio={() => handleNavigate('portfolio')}
            />
          )}
        </main>
      </div>

      {/* Fixed Thumb-Friendly 5-Tab Bottom Navigation Bar */}
      <nav
        aria-label="แถบนำทางหลัก"
        className="fixed bottom-0 inset-x-0 z-40 bg-[#0C1017]/95 backdrop-blur-md border-t border-[#1E2634]"
      >
        <div className="max-w-xl mx-auto h-16 grid grid-cols-5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            const badge =
              item.id === 'calendar'
                ? matchedCalendar14dCount
                : item.id === 'earnings'
                ? urgentEarningsXDCount
                : 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`relative flex flex-col items-center justify-center gap-1 min-h-[44px] transition-colors cursor-pointer ${
                  active ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-1 rounded-full bg-amber-500 text-slate-950 font-mono text-[9px] font-bold flex items-center justify-center">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium whitespace-nowrap">
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Unified Account, Settings, Quota Gauge, PWA Install & JSON Backup Modal */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        accounts={accounts}
        activeAccountId={activeAccountId}
        portfolioCount={portfolio.length}
        quota={quota}
        onAuthChange={handleAuthChange}
        onExportJson={handleExportJson}
        onImportJsonFile={handleImportJsonFile}
      />

      {/* Trend, Support/Resistance & Fibonacci Mobile Bottom Sheet (Zero Charts) */}
      <TrendFibonacciSheet
        asset={trendTargetAsset}
        quota={quota}
        onClose={() => setTrendTargetAsset(null)}
        onUpdateAssetCost={handleUpdateAssetCost}
      />
    </div>
  );
}
