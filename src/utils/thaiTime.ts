export const THAI_TIMEZONE = 'Asia/Bangkok';

export interface BangkokDateParts {
  dateIso: string;
  time24: string;
  timeLabelTh: string;
  timestampMs: number;
  isoUtc: string;
}

const bkkDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: THAI_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const bkkShortThaiDateFormatter = new Intl.DateTimeFormat('th-TH', {
  timeZone: THAI_TIMEZONE,
  day: 'numeric',
  month: 'short',
});

export function getBangkokTodayIso(referenceMs: number = Date.now()): string {
  const parts = bkkDateTimeFormatter.formatToParts(new Date(referenceMs));
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  if (y && m && d) {
    return `${y}-${m}-${d}`;
  }
  const fallback = new Date(referenceMs + 7 * 3600 * 1000);
  return fallback.toISOString().slice(0, 10);
}

export function formatBangkokClockNow(referenceMs: number = Date.now()): string {
  const parts = bkkDateTimeFormatter.formatToParts(new Date(referenceMs));
  const rawHour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const hour = rawHour === '24' ? '00' : rawHour.padStart(2, '0');
  const minute = (parts.find((p) => p.type === 'minute')?.value ?? '00').padStart(2, '0');
  return `${hour}:${minute}`;
}

export function toBangkokDateParts(rawDate: string | number | Date): BangkokDateParts | null {
  let ms: number;
  if (typeof rawDate === 'number') {
    ms = rawDate;
  } else if (rawDate instanceof Date) {
    ms = rawDate.getTime();
  } else if (typeof rawDate === 'string' && rawDate.trim()) {
    ms = Date.parse(rawDate.trim());
  } else {
    return null;
  }

  if (!Number.isFinite(ms)) return null;

  const d = new Date(ms);
  const parts = bkkDateTimeFormatter.formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  const rawHour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;

  if (!y || !m || !day || !rawHour || !minute) return null;

  const hour = rawHour === '24' ? '00' : rawHour.padStart(2, '0');
  const min = minute.padStart(2, '0');
  const time24 = `${hour}:${min}`;

  return {
    dateIso: `${y}-${m}-${day}`,
    time24,
    timeLabelTh: `${time24} น.`,
    timestampMs: ms,
    isoUtc: d.toISOString(),
  };
}

export function ensureThaiClockSuffix(rawTime: string): string {
  const trimmed = (rawTime || '').trim();
  if (!trimmed || trimmed === '—' || trimmed === '-') return '—';
  const match = /^(\d{1,2}):(\d{2})/.exec(trimmed);
  if (match) {
    const h = match[1].padStart(2, '0');
    const m = match[2];
    return `${h}:${m} น.`;
  }
  return trimmed.endsWith('น.') ? trimmed : trimmed;
}

/**
 * Formats a news pubDate / ISO timestamp into Thailand time (UTC+7) paired with
 * relative time, e.g. "เมื่อ 25 นาทีที่แล้ว • 22:15 น."
 */
export function formatThaiNewsTimestamp(
  rawDate: string | number | Date,
  nowMs: number = Date.now()
): { publishedAt: string; timeLabel: string; timestampMs: number } {
  const parts = toBangkokDateParts(rawDate);
  if (!parts) {
    const fallbackNow = toBangkokDateParts(nowMs)!;
    return {
      publishedAt: fallbackNow.isoUtc,
      timeLabel: `ล่าสุด • ${fallbackNow.timeLabelTh}`,
      timestampMs: fallbackNow.timestampMs,
    };
  }

  const diffMs = Math.max(0, nowMs - parts.timestampMs);
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  let relativePart: string;
  if (diffMin < 1) {
    relativePart = 'เมื่อสักครู่';
  } else if (diffMin < 60) {
    relativePart = `เมื่อ ${diffMin} นาทีที่แล้ว`;
  } else if (diffHours < 24) {
    relativePart = `เมื่อ ${diffHours} ชม. ที่แล้ว`;
  } else if (diffDays === 1) {
    relativePart = 'เมื่อวาน';
  } else if (diffDays < 7) {
    relativePart = `เมื่อ ${diffDays} วันที่แล้ว`;
  } else {
    relativePart = bkkShortThaiDateFormatter.format(new Date(parts.timestampMs));
  }

  return {
    publishedAt: parts.isoUtc,
    timeLabel: `${relativePart} • ${parts.timeLabelTh}`,
    timestampMs: parts.timestampMs,
  };
}

/**
 * Resolves the exact UTC epoch milliseconds of a CalendarEvent scheduled in Bangkok time.
 */
export function parseBangkokEventTimestampMs(
  dateIso: string,
  timeStr: string,
  eventTimestampIso?: string
): number | null {
  if (eventTimestampIso) {
    const parsed = Date.parse(eventTimestampIso);
    if (Number.isFinite(parsed)) return parsed;
  }
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dateIso || '').trim());
  const timeMatch = /(\d{1,2}):(\d{2})/.exec((timeStr || '').trim());
  if (!dateMatch || !timeMatch) return null;

  const hh = timeMatch[1].padStart(2, '0');
  const mm = timeMatch[2];
  const parsed = Date.parse(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${hh}:${mm}:00+07:00`);
  return Number.isFinite(parsed) ? parsed : null;
}
