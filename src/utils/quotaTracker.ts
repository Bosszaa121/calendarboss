import { QuotaSnapshot } from '../types';

const QUOTA_STORAGE_KEY = 'investcal_ai_quota_ledger_v1';

export const AI_RPM_LIMIT = 15;
export const AI_RPD_LIMIT = 250;
const COOLDOWN_DURATION_MS = 60_000;

interface StoredQuotaLedger {
  pacificDateKey: string;
  dailyUsed: number;
  minuteTimestamps: number[];
  cooldownUntilMs: number;
  dailyExhausted: boolean;
  lastSourceMode: 'cache' | 'live';
}

type QuotaListener = (snapshot: QuotaSnapshot) => void;
const listeners = new Set<QuotaListener>();

export function getPacificDateKey(now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    // Safe fallback using UTC-8 approximation
    const shifted = new Date(now.getTime() - 8 * 3600 * 1000);
    return shifted.toISOString().slice(0, 10);
  }
}

export function getPacificResetCountdownLabel(now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(now);

    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    const remainingTotalMins = Math.max(1, 24 * 60 - (hour * 60 + minute));
    const hrs = Math.floor(remainingTotalMins / 60);
    const mins = remainingTotalMins % 60;
    return `รีเซ็ตในอีก ${hrs} ชม. ${mins} นาที (00:00 PST)`;
  } catch {
    return 'รีเซ็ตทุก 00:00 น. เวลาแปซิฟิก (~14:00–15:00 น. เวลาไทย)';
  }
}

function createFreshLedger(dateKey: string): StoredQuotaLedger {
  return {
    pacificDateKey: dateKey,
    dailyUsed: 0,
    minuteTimestamps: [],
    cooldownUntilMs: 0,
    dailyExhausted: false,
    lastSourceMode: 'cache',
  };
}

function readLedger(): StoredQuotaLedger {
  const todayPacific = getPacificDateKey();
  const nowMs = Date.now();
  try {
    const raw = window.localStorage.getItem(QUOTA_STORAGE_KEY);
    if (!raw) return createFreshLedger(todayPacific);
    const parsed = JSON.parse(raw) as Partial<StoredQuotaLedger>;
    if (!parsed || parsed.pacificDateKey !== todayPacific) {
      const fresh = createFreshLedger(todayPacific);
      window.localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }

    const activeMinute = Array.isArray(parsed.minuteTimestamps)
      ? parsed.minuteTimestamps.filter((ts) => typeof ts === 'number' && nowMs - ts < 60_000)
      : [];

    return {
      pacificDateKey: todayPacific,
      dailyUsed: typeof parsed.dailyUsed === 'number' && parsed.dailyUsed >= 0 ? parsed.dailyUsed : 0,
      minuteTimestamps: activeMinute,
      cooldownUntilMs:
        typeof parsed.cooldownUntilMs === 'number' && parsed.cooldownUntilMs > nowMs
          ? parsed.cooldownUntilMs
          : 0,
      dailyExhausted: Boolean(parsed.dailyExhausted),
      lastSourceMode: parsed.lastSourceMode === 'live' ? 'live' : 'cache',
    };
  } catch {
    return createFreshLedger(todayPacific);
  }
}

function writeLedger(ledger: StoredQuotaLedger): void {
  try {
    window.localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(ledger));
  } catch {
    // Ignore storage quota errors
  }
}

function toSnapshot(ledger: StoredQuotaLedger): QuotaSnapshot {
  const nowMs = Date.now();
  const minuteUsed = ledger.minuteTimestamps.filter((ts) => nowMs - ts < 60_000).length;
  const dailyUsed = Math.min(AI_RPD_LIMIT, ledger.dailyUsed);
  const dailyPercent = Math.min(100, Math.round((dailyUsed / AI_RPD_LIMIT) * 100));
  const cooldownSecondsLeft =
    ledger.cooldownUntilMs > nowMs ? Math.ceil((ledger.cooldownUntilMs - nowMs) / 1000) : 0;
  const isCoolingDown = cooldownSecondsLeft > 0;
  const dailyExhausted = ledger.dailyExhausted || dailyUsed >= AI_RPD_LIMIT;

  let tone: QuotaSnapshot['tone'] = 'normal';
  if (dailyExhausted || isCoolingDown || dailyPercent >= 91) {
    tone = 'danger';
  } else if (dailyPercent >= 71 || minuteUsed >= AI_RPM_LIMIT - 2) {
    tone = 'warning';
  }

  return {
    pacificDateKey: ledger.pacificDateKey,
    dailyUsed,
    dailyLimit: AI_RPD_LIMIT,
    dailyPercent,
    minuteUsed,
    minuteLimit: AI_RPM_LIMIT,
    cooldownSecondsLeft,
    isCoolingDown,
    dailyExhausted,
    tone,
    lastSourceMode: ledger.lastSourceMode,
    resetCountdownLabel: getPacificResetCountdownLabel(),
  };
}

function emitQuotaChange(ledger: StoredQuotaLedger): QuotaSnapshot {
  const snap = toSnapshot(ledger);
  for (const listener of listeners) {
    listener(snap);
  }
  return snap;
}

export function getQuotaSnapshot(): QuotaSnapshot {
  return toSnapshot(readLedger());
}

/**
 * Records 1 REAL Gemini API request (never called for Cache hits or 0%-AI feeds).
 */
export function recordGeminiApiCall(): QuotaSnapshot {
  const ledger = readLedger();
  const nowMs = Date.now();
  ledger.dailyUsed += 1;
  ledger.minuteTimestamps = [
    ...ledger.minuteTimestamps.filter((ts) => nowMs - ts < 60_000),
    nowMs,
  ];
  ledger.lastSourceMode = 'live';

  if (ledger.minuteTimestamps.length >= AI_RPM_LIMIT) {
    ledger.cooldownUntilMs = Math.max(ledger.cooldownUntilMs, nowMs + COOLDOWN_DURATION_MS);
  }
  if (ledger.dailyUsed >= AI_RPD_LIMIT) {
    ledger.dailyExhausted = true;
  }

  writeLedger(ledger);
  return emitQuotaChange(ledger);
}

/**
 * Marks that data was served from LocalStorage Cache (0% AI quota used).
 */
export function markServedFromCache(): QuotaSnapshot {
  const ledger = readLedger();
  ledger.lastSourceMode = 'cache';
  writeLedger(ledger);
  return emitQuotaChange(ledger);
}

/**
 * Triggers a 60-second RPM cooldown or marks daily RPD exhausted on HTTP 429.
 */
export function recordRateLimitHit(isDailyLimit = false): QuotaSnapshot {
  const ledger = readLedger();
  const nowMs = Date.now();
  ledger.lastSourceMode = 'live';
  if (isDailyLimit) {
    ledger.dailyExhausted = true;
  } else {
    ledger.cooldownUntilMs = nowMs + COOLDOWN_DURATION_MS;
  }
  writeLedger(ledger);
  return emitQuotaChange(ledger);
}

export function subscribeQuotaChange(listener: QuotaListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
