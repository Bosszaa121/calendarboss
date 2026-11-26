import {
  AppAlert,
  CalendarEvent,
  DividendXDRecord,
  EarningsRecord,
  FearGreedData,
  NewsItem,
  PortfolioAsset,
  SocialInsightItem,
} from '../types';
import {
  analyzePortfolioImpacts,
  formatThaiShortDate,
  getDayDiffFromToday,
} from './portfolioMatcher';

export type BrowserNotificationPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestChromeNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

export async function fireChromeNotification(params: {
  title: string;
  body: string;
  tag?: string;
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(params.title, {
          body: params.body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: params.tag || `investcal-${Date.now()}`,
        });
        return true;
      }
    }
    new Notification(params.title, {
      body: params.body,
      icon: '/pwa-192x192.png',
      tag: params.tag,
    });
    return true;
  } catch {
    try {
      new Notification(params.title, {
        body: params.body,
        icon: '/pwa-192x192.png',
      });
      return true;
    } catch {
      return false;
    }
  }
}

export async function sendTestChromeNotification(portfolioSymbols: string[]): Promise<boolean> {
  const sampleAssets =
    portfolioSymbols.length > 0 ? portfolioSymbols.slice(0, 4).join(', ') : 'พอร์ตโฟลิโอของคุณ';
  return fireChromeNotification({
    title: 'InvestCal · ทดสอบการแจ้งเตือนสำเร็จ',
    body: `ระบบแจ้งเตือน Chrome พร้อมติดตามข่าวสำคัญ งบการเงิน วัน XD และคำเตือนความเสี่ยงสำหรับ ${sampleAssets} แล้ว`,
    tag: `investcal-test-${Date.now()}`,
  });
}

/**
 * Evaluates all 4 critical investor alert scenarios:
 * 1. ⚠️ ใกล้มีข่าวสำคัญกระทบพอร์ต (macro_news)
 * 2. 📊 ใกล้ประกาศงบการเงิน ล่วงหน้า 1-3 วัน (earnings)
 * 3. 💰 ใกล้ขึ้นเครื่องหมาย XD ล่วงหน้า 1-7 วัน (xd)
 * 4. 🚨 คำเตือนความเสี่ยงให้ระวัง (risk_warning)
 */
export function buildInvestorAlerts(params: {
  portfolio: PortfolioAsset[];
  portfolioMap: Map<string, string>;
  calendarEvents: CalendarEvent[];
  newsItems: NewsItem[];
  earningsRecords: EarningsRecord[];
  dividendRecords: DividendXDRecord[];
  socialInsights: SocialInsightItem[];
  fearGreed: FearGreedData;
}): AppAlert[] {
  const {
    portfolio,
    portfolioMap,
    calendarEvents,
    newsItems,
    earningsRecords,
    dividendRecords,
    socialInsights,
    fearGreed,
  } = params;

  const alerts: AppAlert[] = [];
  const nowIso = new Date().toISOString();

  // ------------------------------------------------------------------
  // 4. 🚨 Risk Warning Alerts (works globally + intensifies for portfolio)
  // ------------------------------------------------------------------
  if (fearGreed.value <= 25) {
    alerts.push({
      id: `risk-fg-fear-${fearGreed.value}`,
      category: 'risk_warning',
      severity: 'critical',
      title: `🚨 ระวังความผันผวนสูง: Fear & Greed อยู่ในโซนกลัวสุดขีด (${fearGreed.value}/100)`,
      body: 'ตลาดอยู่ในภาวะตื่นตระหนกสูง ควรระมัดระวังแรงเทขายระยะสั้นและบริหารสัดส่วนเงินสดอย่างรัดกุม',
      symbols: portfolio.slice(0, 4).map((p) => p.symbol),
      targetTab: 'dashboard',
      badgeLabel: 'คำเตือนความเสี่ยง',
      createdAt: nowIso,
    });
  } else if (fearGreed.value >= 75) {
    alerts.push({
      id: `risk-fg-greed-${fearGreed.value}`,
      category: 'risk_warning',
      severity: 'high',
      title: `🚨 ระวังแรงขายทำกำไร: Fear & Greed อยู่ในโซนโลภสุดขีด (${fearGreed.value}/100)`,
      body: 'ตลาดร้อนแรงเกินค่าเฉลี่ย มีความเสี่ยงเกิดแรงพักฐานฉับพลันเมื่อตัวเลขเศรษฐกิจออกมาผิดคาด',
      symbols: portfolio.slice(0, 4).map((p) => p.symbol),
      targetTab: 'dashboard',
      badgeLabel: 'คำเตือนความเสี่ยง',
      createdAt: nowIso,
    });
  }

  // Bearish high-impact news hitting user's portfolio
  if (portfolio.length > 0) {
    const bearishPortfolioNews: Array<{ news: NewsItem; symbols: string[] }> = [];
    for (const item of newsItems) {
      if (item.sentiment !== 'bearish') continue;
      const impacts = analyzePortfolioImpacts(
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
      );
      if (impacts.some((i) => i.relation === 'direct' || i.severity === 'high')) {
        bearishPortfolioNews.push({
          news: item,
          symbols: impacts.map((i) => i.symbol),
        });
      }
    }

    if (bearishPortfolioNews.length > 0) {
      const top = bearishPortfolioNews[0];
      const uniqueSyms = Array.from(
        new Set(bearishPortfolioNews.flatMap((x) => x.symbols))
      ).slice(0, 5);
      alerts.push({
        id: `risk-bearish-news-${top.news.id}`,
        category: 'risk_warning',
        severity: 'critical',
        title: `🚨 คำเตือนความเสี่ยง: พบ ${bearishPortfolioNews.length} ข่าวเชิงลบแรงกระทบ ${uniqueSyms.join(', ')}`,
        body: `${top.news.headline} — ${top.news.impactSummary}`,
        symbols: uniqueSyms,
        targetTab: 'news',
        targetNewsSubTab: 'global',
        badgeLabel: 'คำเตือนความเสี่ยง',
        createdAt: nowIso,
      });
    }

    // Bearish / Watch social insights warning
    const riskySocial = socialInsights.filter(
      (s) =>
        s.sentiment === 'bearish' &&
        s.relatedAssets.some((t) => portfolioMap.has(t.toUpperCase().replace(/\.BK$/, '')))
    );
    if (riskySocial.length >= 2) {
      const syms = Array.from(
        new Set(
          riskySocial
            .flatMap((s) => s.relatedAssets)
            .filter((t) => portfolioMap.has(t.toUpperCase().replace(/\.BK$/, '')))
        )
      ).slice(0, 4);
      alerts.push({
        id: `risk-social-cluster-${syms.join('-')}`,
        category: 'risk_warning',
        severity: 'high',
        title: `🚨 กระแสโซเชียลเตือนความเสี่ยงต่อ ${syms.join(', ')} (${riskySocial.length} ประเด็น)`,
        body: riskySocial[0].title,
        symbols: syms,
        targetTab: 'news',
        targetNewsSubTab: 'social',
        badgeLabel: 'เตือนจากโซเชียล',
        createdAt: nowIso,
      });
    }
  }

  // ------------------------------------------------------------------
  // 1. ⚠️ ใกล้มีข่าวสำคัญกระทบพอร์ต (High-impact events today/tomorrow)
  // ------------------------------------------------------------------
  for (const ev of calendarEvents) {
    const diff = getDayDiffFromToday(ev.date);
    if (diff < 0 || diff > 2 || ev.category !== 'economic' || ev.impact < 3) continue;
    const impacts =
      portfolio.length > 0
        ? analyzePortfolioImpacts(
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
          )
        : [];

    if (portfolio.length > 0 && impacts.length === 0) continue;

    const syms =
      impacts.length > 0
        ? impacts.slice(0, 5).map((i) => i.symbol)
        : ev.relatedAssets.slice(0, 4);
    const whenText = diff === 0 ? `วันนี้ เวลา ${ev.time} น.` : diff === 1 ? `พรุ่งนี้ เวลา ${ev.time} น.` : formatThaiShortDate(ev.date);

    alerts.push({
      id: `macro-${ev.id}`,
      category: 'macro_news',
      severity: 'high',
      title: `⚠️ ใกล้มีข่าวสำคัญกระทบพอร์ต: ${ev.flag} ${ev.title}`,
      body: `${whenText} · คาดการณ์ ${ev.forecast} (ครั้งก่อน ${ev.previous}) · กระทบ ${syms.join(', ')}`,
      symbols: syms,
      targetTab: 'calendar',
      badgeLabel: 'ข่าวสำคัญ',
      createdAt: nowIso,
    });
  }

  // ------------------------------------------------------------------
  // 2. 📊 ใกล้ประกาศงบการเงิน (ล่วงหน้า 1-3 วัน)
  // ------------------------------------------------------------------
  const seenEarningsKeys = new Set<string>();
  for (const rec of earningsRecords) {
    if (rec.status === 'not_applicable') continue;
    const diff =
      typeof rec.daysUntil === 'number'
        ? rec.daysUntil
        : getDayDiffFromToday(rec.reportDate);
    if (diff >= 0 && diff <= 3) {
      const key = `${rec.portfolioSymbol}-${rec.reportedSymbol}`;
      if (seenEarningsKeys.has(key)) continue;
      seenEarningsKeys.add(key);
      const dayLabel = diff === 0 ? 'วันนี้' : `อีก ${diff} วัน`;
      alerts.push({
        id: `earn-${rec.id}`,
        category: 'earnings',
        severity: 'high',
        title: `📊 ใกล้ประกาศงบ (${dayLabel}): ${rec.reportedSymbol}${rec.isTopHolding ? ` (Top Holding ของ ${rec.portfolioSymbol})` : ''}`,
        body: `${rec.reportedName} · กำหนด ${formatThaiShortDate(rec.reportDate)} · ${rec.trendSummaryTh}`,
        symbols: rec.isTopHolding
          ? [rec.portfolioSymbol, rec.reportedSymbol]
          : [rec.portfolioSymbol],
        targetTab: 'earnings',
        badgeLabel: `งบใน ${dayLabel}`,
        createdAt: nowIso,
      });
    }
  }

  // Also check calendar earnings events within 0-3 days matching portfolio
  if (portfolio.length > 0) {
    for (const ev of calendarEvents) {
      if (ev.category !== 'earnings') continue;
      const diff = getDayDiffFromToday(ev.date);
      if (diff < 0 || diff > 3) continue;
      const impacts = analyzePortfolioImpacts(
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
      );
      if (impacts.length === 0) continue;
      const primarySym = impacts[0].symbol;
      if (seenEarningsKeys.has(`${primarySym}-${primarySym}`)) continue;
      const dayLabel = diff === 0 ? 'วันนี้' : `อีก ${diff} วัน`;
      alerts.push({
        id: `cal-earn-${ev.id}`,
        category: 'earnings',
        severity: 'high',
        title: `📊 ใกล้ประกาศงบ (${dayLabel}): ${ev.title}`,
        body: `${formatThaiShortDate(ev.date)} เวลา ${ev.time} น. · กระทบ ${impacts.map((i) => i.symbol).join(', ')}`,
        symbols: impacts.map((i) => i.symbol),
        targetTab: 'earnings',
        badgeLabel: `งบใน ${dayLabel}`,
        createdAt: nowIso,
      });
    }
  }

  // ------------------------------------------------------------------
  // 3. 💰 ใกล้ขึ้นเครื่องหมาย XD (ล่วงหน้า 1-7 วัน)
  // ------------------------------------------------------------------
  const seenXdSymbols = new Set<string>();
  for (const div of dividendRecords) {
    if (!div.applicable) continue;
    const diff =
      typeof div.daysUntilXD === 'number'
        ? div.daysUntilXD
        : getDayDiffFromToday(div.xdDate);
    if (diff >= 0 && diff <= 7) {
      seenXdSymbols.add(div.symbol.toUpperCase());
      const dayLabel = diff === 0 ? 'วันนี้ XD' : `อีก ${diff} วัน XD`;
      alerts.push({
        id: `xd-${div.id}`,
        category: 'xd',
        severity: diff <= 2 ? 'critical' : 'high',
        title: `💰 ${dayLabel}: ${div.flag} ${div.symbol} ปันผล ${div.dps} (${div.dividendYield})`,
        body: `วันขึ้นเครื่องหมาย XD ${formatThaiShortDate(div.xdDate)} · จ่ายปันผล ${div.payDate}`,
        symbols: [div.symbol],
        targetTab: 'earnings',
        badgeLabel: dayLabel,
        createdAt: nowIso,
      });
    }
  }

  if (portfolio.length > 0) {
    for (const ev of calendarEvents) {
      if (ev.category !== 'dividend') continue;
      const diff = getDayDiffFromToday(ev.date);
      if (diff < 0 || diff > 7) continue;
      const impacts = analyzePortfolioImpacts(
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
      );
      if (impacts.length === 0) continue;
      const sym = impacts[0].symbol;
      if (seenXdSymbols.has(sym.toUpperCase())) continue;
      const dayLabel = diff === 0 ? 'วันนี้ XD' : `อีก ${diff} วัน XD`;
      alerts.push({
        id: `cal-xd-${ev.id}`,
        category: 'xd',
        severity: diff <= 2 ? 'critical' : 'high',
        title: `💰 ${dayLabel}: ${ev.title}`,
        body: `วันที่ ${formatThaiShortDate(ev.date)} · คาดปันผล ${ev.forecast} · ${ev.descriptionTh}`,
        symbols: impacts.map((i) => i.symbol),
        targetTab: 'earnings',
        badgeLabel: dayLabel,
        createdAt: nowIso,
      });
    }
  }

  const severityRank: Record<AppAlert['severity'], number> = {
    critical: 3,
    high: 2,
    medium: 1,
  };

  return alerts.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);
}
