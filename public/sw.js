const CACHE_NAME = 'investcal-shell-v4';
const SW_STATE_CACHE = 'investcal-sw-state-v1';
const SW_PORTFOLIO_KEY = '/__investcal_sw_portfolio__.json';
const SW_NOTIFIED_KEY = '/__investcal_sw_notified__.json';
const PERIODIC_SYNC_TAG = 'investcal-2hourly-sync';

const CORE_ASSETS = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
];

function getBangkokTodayIsoInSw() {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // fallback
  }
  const shifted = new Date(Date.now() + 7 * 3600 * 1000);
  return shifted.toISOString().slice(0, 10);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== SW_STATE_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache live API responses — always fetch fresh from network
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Network-first for HTML navigations with cached shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Stale-while-revalidate for static icons, manifest, JS, CSS
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Receive non-sensitive portfolio ticker context from the app
self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'INVESTCAL_SYNC_PORTFOLIO' && Array.isArray(msg.portfolio)) {
    event.waitUntil(
      caches
        .open(SW_STATE_CACHE)
        .then((cache) =>
          cache.put(
            SW_PORTFOLIO_KEY,
            new Response(
              JSON.stringify({
                portfolio: msg.portfolio.slice(0, 25),
                updatedAt: new Date().toISOString(),
              }),
              { headers: { 'Content-Type': 'application/json' } }
            )
          )
        )
        .catch(() => undefined)
    );
  }
});

async function readSwJson(key, fallback) {
  try {
    const cache = await caches.open(SW_STATE_CACHE);
    const res = await cache.match(key);
    if (!res) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

async function writeSwJson(key, value) {
  try {
    const cache = await caches.open(SW_STATE_CACHE);
    await cache.put(
      key,
      new Response(JSON.stringify(value), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
  } catch {
    // ignore
  }
}

async function runTwoHourlyBackgroundAlertCheck() {
  try {
    const state = await readSwJson(SW_PORTFOLIO_KEY, { portfolio: [] });
    const portfolio = Array.isArray(state.portfolio) ? state.portfolio : [];
    const heldSymbols = portfolio
      .map((p) => (p && typeof p.symbol === 'string' ? p.symbol.toUpperCase() : ''))
      .filter(Boolean);

    const res = await fetch('/api/batched-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portfolio,
        todayIso: getBangkokTodayIsoInSw(),
        force: false,
      }),
    });

    if (!res.ok) return;
    const data = await res.json();
    const newsItems = Array.isArray(data.newsItems) ? data.newsItems : [];
    const calendarEvents = Array.isArray(data.calendarEvents) ? data.calendarEvents : [];

    const notifiedMap = await readSwJson(SW_NOTIFIED_KEY, {});
    const nowMs = Date.now();

    // Prune entries older than 48h
    for (const k of Object.keys(notifiedMap)) {
      if (typeof notifiedMap[k] !== 'number' || nowMs - notifiedMap[k] > 48 * 3600 * 1000) {
        delete notifiedMap[k];
      }
    }

    let fired = 0;

    // 1. Check High Risk Alert: severe bearish news hitting user's held portfolio
    for (const item of newsItems) {
      if (fired >= 2) break;
      if (!item || item.sentiment !== 'bearish') continue;

      const aiHighMatch = Array.isArray(item.aiImpacts)
        ? item.aiImpacts.filter(
            (imp) =>
              imp &&
              (imp.severity === 'high' || imp.relation === 'direct') &&
              (heldSymbols.length === 0 ||
                heldSymbols.includes(String(imp.symbol || '').toUpperCase()))
          )
        : [];

      const directTagMatch =
        heldSymbols.length > 0 &&
        Array.isArray(item.relatedAssets) &&
        item.relatedAssets.some((sym) => heldSymbols.includes(String(sym || '').toUpperCase()));

      if (aiHighMatch.length === 0 && !directTagMatch) continue;

      const dedupId = `bg-risk-${String(item.headline || '').slice(0, 48)}`;
      if (notifiedMap[dedupId]) continue;

      const symbols =
        aiHighMatch.length > 0
          ? aiHighMatch.map((x) => x.symbol).slice(0, 4)
          : (item.relatedAssets || []).slice(0, 4);

      notifiedMap[dedupId] = nowMs;
      fired += 1;

      await self.registration.showNotification(
        `🚨 High Risk Alert${symbols.length ? ` (${symbols.join(', ')})` : ''}`,
        {
          body: `${item.headline || 'พบข่าวเชิงลบรุนแรงกระทบพอร์ต'} · ${item.timeLabel || ''}`,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: dedupId,
        }
      );
    }

    // 2. Check upcoming High Impact economic calendar events within 15 minutes
    for (const ev of calendarEvents) {
      if (fired >= 3) break;
      if (!ev || ev.category !== 'economic' || !ev.eventTimestampIso) continue;
      const evMs = Date.parse(ev.eventTimestampIso);
      if (!Number.isFinite(evMs)) continue;
      const msUntil = evMs - nowMs;
      if (msUntil <= 0 || msUntil > 15 * 60 * 1000) continue;

      const hasPortfolioHit =
        heldSymbols.length > 0 &&
        ((Array.isArray(ev.aiImpacts) && ev.aiImpacts.length > 0) ||
          (Array.isArray(ev.relatedAssets) &&
            ev.relatedAssets.some((s) => heldSymbols.includes(String(s || '').toUpperCase()))));

      if (ev.impact < 3 && !hasPortfolioHit) continue;

      const dedupId = `bg-cal-${ev.date}-${ev.time}-${ev.currency}-${String(ev.title || '').slice(0, 32)}`;
      if (notifiedMap[dedupId]) continue;

      const minsLeft = Math.max(1, Math.round(msUntil / 60000));
      notifiedMap[dedupId] = nowMs;
      fired += 1;

      await self.registration.showNotification(
        `⏰ อีก ${minsLeft} นาที: ${ev.flag || '🌐'} ${ev.title}`,
        {
          body: `ประกาศเวลาไทย ${ev.time} (${ev.currency}) · คาดการณ์ ${ev.forecast || '—'} (ครั้งก่อน ${ev.previous || '—'})`,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: dedupId,
        }
      );
    }

    if (fired > 0) {
      await writeSwJson(SW_NOTIFIED_KEY, notifiedMap);
    }
  } catch {
    // Silent resilience during background sync
  }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === PERIODIC_SYNC_TAG) {
    event.waitUntil(runTwoHourlyBackgroundAlertCheck());
  }
});

// Focus or open InvestCal when a notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
      return undefined;
    })
  );
});
