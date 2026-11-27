export type AssetCategory =
  | 'US ETF'
  | 'Thai Stock'
  | 'US Stock'
  | 'Crypto'
  | 'Commodity'
  | 'Forex';

export type NavTab = 'dashboard' | 'portfolio' | 'calendar' | 'earnings' | 'news';

export type NewsSubTab = 'global' | 'social';

export type DateTabKey = 'yesterday' | 'today' | 'tomorrow' | 'this_week' | 'next_week';

export type ImpactLevel = 1 | 2 | 3;

export type EventCategory = 'economic' | 'earnings' | 'dividend';

export type Sentiment = 'bullish' | 'bearish' | 'neutral';

export type AssetDirection = 'bullish' | 'bearish' | 'neutral';

export type ActualOutcome = 'better' | 'worse' | 'inline' | 'pending';

export type ImpactRelation = 'direct' | 'indirect';

export type ImpactSeverity = 'high' | 'medium' | 'low';

export interface AssetDirectionForecast {
  symbol: string;
  direction: AssetDirection;
  reasonTh: string;
  scenarioNoteTh?: string;
  isPortfolioHeld?: boolean;
}

export interface PortfolioImpactDetail {
  symbol: string;
  relation: ImpactRelation;
  severity: ImpactSeverity;
  direction?: AssetDirection;
  reasonTh: string;
  scenarioNoteTh?: string;
}

export interface CatalogAsset {
  symbol: string;
  name: string;
  category: AssetCategory;
  market: string;
  flag: string;
  currency: string;
  sector: string;
  themes: string[];
  aliases?: string[];
  topHoldings?: string[];
  hasDividends?: boolean;
  hasEarnings?: boolean;
}

export interface PortfolioAsset {
  id: string;
  symbol: string;
  name: string;
  category: AssetCategory;
  market: string;
  flag: string;
  currency: string;
  sector: string;
  themes: string[];
  topHoldings?: string[];
  hasDividends?: boolean;
  hasEarnings?: boolean;
  averageCost?: number;
  quantity?: number;
  addedAt: string;
}

export interface CalendarEvent {
  id: string;
  /** ISO date string YYYY-MM-DD in Asia/Bangkok (UTC+7) */
  date: string;
  /** Time in Asia/Bangkok 24h format (e.g. "20:30 น.", "01:00 น.") */
  time: string;
  /** Exact UTC ISO timestamp of the announcement for accurate 15-min pre-event notifications */
  eventTimestampIso?: string;
  /** Original English title from ForexFactory feed */
  originalTitle?: string;
  /** Feed source tag (e.g. "ForexFactory") */
  sourceProvider?: string;
  countryCode: string;
  flag: string;
  currency: string;
  countryNameTh: string;
  impact: ImpactLevel;
  category: EventCategory;
  title: string;
  subtitle?: string;
  actual: string;
  forecast: string;
  previous: string;
  actualOutcome: ActualOutcome;
  relatedAssets: string[];
  macroTags: string[];
  descriptionTh: string;
  aiImpacts?: PortfolioImpactDetail[];
  assetForecasts?: AssetDirectionForecast[];
  isLiveSynced?: boolean;
}

export interface NewsItem {
  id: string;
  publishedAt: string;
  timeLabel: string;
  source: string;
  sourceUrl?: string;
  headline: string;
  impactSummary: string;
  sentiment: Sentiment;
  relatedAssets: string[];
  macroTags: string[];
  countryCode?: string;
  countryFlag?: string;
  aiImpacts?: PortfolioImpactDetail[];
  isLiveSynced?: boolean;
}

export type EarningsStatus = 'beat' | 'inline' | 'miss' | 'upcoming' | 'not_applicable';

export interface EarningsRecord {
  id: string;
  portfolioSymbol: string;
  reportedSymbol: string;
  reportedName: string;
  isTopHolding: boolean;
  holdingWeight?: string;
  flag: string;
  reportDate: string;
  periodLabel: string;
  revenueSummary: string;
  profitSummary: string;
  yoyChange?: string;
  status: EarningsStatus;
  trendSummaryTh: string;
  daysUntil?: number | null;
  sourceUrl?: string;
  isLiveSynced?: boolean;
}

export type XDStatus = 'announced' | 'unannounced' | 'not_applicable';

export interface DividendXDRecord {
  id: string;
  symbol: string;
  name: string;
  flag: string;
  applicable: boolean;
  xdStatus: XDStatus;
  notApplicableReasonTh?: string;
  /** Official upcoming XD date (YYYY-MM-DD) ONLY when xdStatus === 'announced'; otherwise '—' */
  xdDate: string;
  /** Strictly computed from today -> xdDate ONLY when xdStatus === 'announced'; otherwise null */
  daysUntilXD: number | null;
  dps: string;
  dividendYield: string;
  payDate: string;
  /** Most recent historical paid dividend info (shown when next XD is unannounced) */
  lastPaidXdDate?: string;
  lastPaidDps?: string;
  lastPaidPayDate?: string;
  frequency?: string;
  noteTh?: string;
  sourceUrl?: string;
  isLiveSynced?: boolean;
}

export interface EarningsXDResponse {
  earnings: EarningsRecord[];
  dividends: DividendXDRecord[];
  sources: SyncSource[];
  syncedAt: string;
}

export type SocialPlatform = 'x' | 'facebook' | 'youtube';
export type SocialSentiment = 'bullish' | 'bearish' | 'watch';

export interface SocialInsightItem {
  id: string;
  platform: SocialPlatform;
  channelName: string;
  handleOrPage: string;
  timeLabel: string;
  title: string;
  deepSummaryTh: string;
  analystViewTh: string;
  sentiment: SocialSentiment;
  relatedAssets: string[];
  countryFlag?: string;
  sourceUrl?: string;
  searchQuery?: string;
  isLiveSynced?: boolean;
}

export interface SocialInsightsResponse {
  items: SocialInsightItem[];
  sources: SyncSource[];
  syncedAt: string;
}

export interface FearGreedData {
  value: number;
  labelTh: string;
  previousClose: number;
  oneWeekAgo: number;
  oneMonthAgo: number;
  updatedLabel: string;
  marketNote: string;
}

export interface LiveAssetQuote {
  symbol: string;
  yahooSymbol: string;
  name?: string;
  price: number | null;
  previousClose?: number | null;
  changePercent: number | null;
  currency: string;
  dividendYield?: string;
  lastPaidXdDate?: string;
  lastPaidDps?: string;
  upcomingXdDate?: string;
  earningsDate?: string;
  updatedAt: string;
}

export interface SyncSource {
  title: string;
  uri: string;
}

export interface SyncResponse {
  calendarEvents: CalendarEvent[];
  newsItems: NewsItem[];
  fearGreed?: Partial<FearGreedData>;
  sources: SyncSource[];
  syncedAt: string;
}

export interface BatchedSyncResponse {
  calendarEvents: CalendarEvent[];
  newsItems: NewsItem[];
  fearGreed?: Partial<FearGreedData>;
  earnings: EarningsRecord[];
  dividends: DividendXDRecord[];
  socialInsights: SocialInsightItem[];
  quotes: Record<string, LiveAssetQuote>;
  sources: SyncSource[];
  syncedAt: string;
  rssCount?: number;
  aiWarning?: string;
  aiCalled?: boolean;
  rateLimited?: boolean;
}

export interface LocalUserAccount {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export type AlertCategory = 'macro_news' | 'earnings' | 'xd' | 'risk_warning';
export type AlertSeverity = 'critical' | 'high' | 'medium';

export interface AppAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  body: string;
  symbols: string[];
  targetTab: NavTab;
  targetNewsSubTab?: NewsSubTab;
  badgeLabel: string;
  createdAt: string;
}

export type ChartTimeframe = '1D' | '4H' | '1H';

export interface ChartCandle {
  timestamp: number;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartHistoryResponse {
  symbol: string;
  yahooSymbol: string;
  timeframe: ChartTimeframe;
  currency: string;
  latestPrice: number | null;
  previousClose: number | null;
  changePercent: number | null;
  candles: ChartCandle[];
  fetchedAt: string;
}

export type ChartTrendDirection = 'Uptrend' | 'Downtrend' | 'Sideway';

export interface FibonacciRetracementLevels {
  fib382: number;
  fib500: number;
  fib618: number;
}

export interface FibonacciExtensionLevels {
  fib1272: number;
  fib1618: number;
}

export interface TrendFibonacciResult {
  latestPrice: number;
  ema20: number | null;
  ema50: number | null;
  trend: ChartTrendDirection;
  trendTh: string;
  support1: number;
  support2: number;
  resistance1: number;
  resistance2: number;
  swingHigh: number;
  swingLow: number;
  fibRetracement: FibonacciRetracementLevels;
  fibExtension: FibonacciExtensionLevels;
  breakevenDeltaAbs: number | null;
  breakevenDeltaPct: number | null;
  nextFibTargetLabel: string;
  nextFibTargetPrice: number;
  distanceToNextFibPct: number;
}

export interface ChartAiAnalysisResponse {
  symbol: string;
  timeframe: ChartTimeframe;
  trend: ChartTrendDirection;
  trendTh: string;
  shortPlanLinesTh: string[];
  summaryTh: string;
  analyzedAt: string;
  fromCache?: boolean;
  aiCalled?: boolean;
  rateLimited?: boolean;
}

export interface ChartTargetAsset {
  symbol: string;
  name: string;
  category: AssetCategory;
  market: string;
  flag: string;
  currency: string;
  sector?: string;
  averageCost?: number;
  quantity?: number;
  portfolioId?: string;
}

export interface QuotaSnapshot {
  pacificDateKey: string;
  dailyUsed: number;
  dailyLimit: number;
  dailyPercent: number;
  minuteUsed: number;
  minuteLimit: number;
  cooldownSecondsLeft: number;
  isCoolingDown: boolean;
  dailyExhausted: boolean;
  tone: 'normal' | 'warning' | 'danger';
  lastSourceMode: 'cache' | 'live';
  resetCountdownLabel: string;
}
