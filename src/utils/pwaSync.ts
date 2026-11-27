import { PortfolioAsset } from '../types';

export const PERIODIC_SYNC_TAG = 'investcal-2hourly-sync';
export const PERIODIC_SYNC_MIN_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
const SW_STATE_CACHE_NAME = 'investcal-sw-state-v1';
const SW_PORTFOLIO_KEY = '/__investcal_sw_portfolio__.json';

interface PeriodicSyncManagerLike {
  register: (tag: string, options?: { minInterval?: number }) => Promise<void>;
  getTags?: () => Promise<string[]>;
}

interface RegistrationWithPeriodicSync extends ServiceWorkerRegistration {
  periodicSync?: PeriodicSyncManagerLike;
}

/**
 * Registers the PWA Service Worker and Periodic Background Sync ("investcal-2hourly-sync", 2h interval).
 * Gracefully degrades on browsers that do not support Periodic Background Sync (e.g. Safari/Firefox).
 */
export async function registerInvestCalServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = (await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })) as RegistrationWithPeriodicSync;

    await tryRegisterPeriodicSync(registration);
    return registration;
  } catch {
    return null;
  }
}

export async function tryRegisterPeriodicSync(
  existingReg?: RegistrationWithPeriodicSync | null
): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const reg =
      existingReg ||
      ((await navigator.serviceWorker.ready) as RegistrationWithPeriodicSync);

    if (!reg || !reg.periodicSync || typeof reg.periodicSync.register !== 'function') {
      return false;
    }

    // Check permission when supported by Chromium
    if ('permissions' in navigator && typeof navigator.permissions.query === 'function') {
      try {
        const status = await navigator.permissions.query({
          name: 'periodic-background-sync' as PermissionName,
        });
        if (status.state === 'denied') {
          return false;
        }
      } catch {
        // Some browsers throw for unknown permission names — attempt register directly
      }
    }

    await reg.periodicSync.register(PERIODIC_SYNC_TAG, {
      minInterval: PERIODIC_SYNC_MIN_INTERVAL_MS,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Syncs a lightweight non-sensitive portfolio summary to Service Worker Cache Storage
 * so background periodicsync can check High Risk Alerts against the user's held assets.
 */
export async function syncPortfolioToServiceWorker(portfolio: PortfolioAsset[]): Promise<void> {
  if (typeof window === 'undefined') return;

  const lightweight = portfolio.slice(0, 25).map((p) => ({
    symbol: p.symbol,
    name: p.name,
    category: p.category,
    flag: p.flag,
    sector: p.sector,
    topHoldings: p.topHoldings,
  }));

  try {
    if ('caches' in window) {
      const cache = await window.caches.open(SW_STATE_CACHE_NAME);
      await cache.put(
        SW_PORTFOLIO_KEY,
        new Response(
          JSON.stringify({
            portfolio: lightweight,
            updatedAt: new Date().toISOString(),
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );
    }
  } catch {
    // Ignore cache storage unavailability
  }

  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'INVESTCAL_SYNC_PORTFOLIO',
        portfolio: lightweight,
      });
    }
  } catch {
    // Ignore messaging failure
  }
}
