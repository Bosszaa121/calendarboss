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
  addedAt: string;
}

export interface CalendarEvent {
  id: string;
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** Time in Bangkok ICT (HH:mm) */
  time: string;
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

export interface DividendXDRecord {
  id: string;
  symbol: string;
  name: string;
  flag: string;
  applicable: boolean;
  notApplicableReasonTh?: string;
  xdDate: string;
  daysUntilXD: number | null;
  dps: string;
  dividendYield: string;
  payDate: string;
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
