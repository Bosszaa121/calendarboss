export type AssetCategory = 'Stock' | 'ETF' | 'Crypto' | 'Forex';

export type NavTab = 'dashboard' | 'portfolio' | 'calendar' | 'news';

export type DateTabKey = 'yesterday' | 'today' | 'tomorrow' | 'this_week' | 'next_week';

export type ImpactLevel = 1 | 2 | 3;

export type EventCategory = 'economic' | 'earnings' | 'dividend';

export type Sentiment = 'bullish' | 'bearish' | 'neutral';

export type ActualOutcome = 'better' | 'worse' | 'inline' | 'pending';

export interface CatalogAsset {
  symbol: string;
  name: string;
  category: AssetCategory;
  market: string;
  flag: string;
  currency: string;
  aliases?: string[];
}

export interface PortfolioAsset {
  id: string;
  symbol: string;
  name: string;
  category: AssetCategory;
  market: string;
  flag: string;
  currency: string;
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
  descriptionTh: string;
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
  countryFlag?: string;
  isLiveSynced?: boolean;
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
