import crypto from 'node:crypto';
import type { AssetCategory, PortfolioAsset } from '../../src/types.ts';

export interface CloudUserSettings {
  notificationsEnabled?: boolean;
  preEventAlertMinutes?: number;
  updatedFrom?: string;
}

interface StoredCloudUserRecord {
  username: string;
  displayName: string;
  passwordHash: string;
  salt: string;
  portfolio: PortfolioAsset[];
  settings: CloudUserSettings;
  createdAt: string;
  updatedAt: string;
}

export interface PublicCloudUserPayload {
  username: string;
  displayName: string;
  portfolio: PortfolioAsset[];
  settings: CloudUserSettings;
  createdAt: string;
  updatedAt: string;
}

export interface UserSyncHandlerResult {
  status: number;
  payload: Record<string, unknown>;
}

const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,32}$/;
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const REDIS_TIMEOUT_MS = 8500;

const VALID_CATEGORIES = new Set<AssetCategory>([
  'US ETF',
  'Thai Stock',
  'US Stock',
  'Crypto',
  'Commodity',
  'Forex',
]);

// Ephemeral fallback secret only if Redis token is absent (never exposed to client)
const EPHEMERAL_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

function getRedisCredentials(): { url: string; token: string } | null {
  const url = (
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    ''
  )
    .trim()
    .replace(/\/+$/, '');
  const token = (
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    ''
  ).trim();

  if (!url || !token || !url.startsWith('https://')) {
    return null;
  }
  return { url, token };
}

function getSigningSecret(): string {
  const fromEnv = (
    process.env.USER_SYNC_TOKEN_SECRET ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    ''
  ).trim();
  return fromEnv || EPHEMERAL_FALLBACK_SECRET;
}

function redisKeyForUser(normalizedUsername: string): string {
  return `investcal:user:${normalizedUsername}`;
}

async function runUpstashCommand<T = unknown>(
  creds: { url: string; token: string },
  command: Array<string | number>
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REDIS_TIMEOUT_MS);
  try {
    const res = await fetch(creds.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      signal: controller.signal,
    });

    const data = (await res.json().catch(() => ({}))) as {
      result?: T;
      error?: string;
    };

    if (!res.ok || data.error) {
      throw new Error(data.error || `Upstash Redis HTTP ${res.status}`);
    }
    return data.result as T;
  } finally {
    clearTimeout(timer);
  }
}

function hashPasswordScrypt(password: string, salt: string): string {
  return crypto.scryptSync(password, `investcal::${salt}`, 64).toString('hex');
}

function verifyPasswordScrypt(password: string, salt: string, storedHash: string): boolean {
  try {
    const computed = hashPasswordScrypt(password, salt);
    const a = Buffer.from(computed, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function signSessionToken(normalizedUsername: string): string {
  const payload = {
    u: normalizedUsername,
    iat: Date.now(),
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token: string | null): string | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      u?: string;
      exp?: number;
    };
    if (
      typeof parsed.u !== 'string' ||
      !USERNAME_REGEX.test(parsed.u) ||
      typeof parsed.exp !== 'number' ||
      Date.now() > parsed.exp
    ) {
      return null;
    }
    return parsed.u.toLowerCase();
  } catch {
    return null;
  }
}

export function extractBearerToken(req?: {
  headers?: Record<string, string | string[] | undefined>;
}): string | null {
  const raw = req?.headers?.authorization ?? req?.headers?.Authorization;
  const headerVal = Array.isArray(raw) ? raw[0] : raw;
  if (typeof headerVal !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(headerVal.trim());
  return match && match[1] ? match[1].trim() : null;
}

/**
 * Strict CORS handler for authenticated /api/user-sync endpoint.
 * Never returns wildcard '*' on authenticated requests — reflects explicit valid Origin only.
 */
export function applyAuthenticatedCorsAndPreflight(
  req: { method?: string; headers?: Record<string, string | string[] | undefined> },
  res: {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => { json: (body: unknown) => void; end: () => void };
  }
): boolean {
  const originHeader = req.headers?.origin;
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;

  if (
    origin &&
    (origin.startsWith('https://') ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1'))
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  const method = (req.method || '').toUpperCase();
  if (method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }

  if (method !== 'POST') {
    res.status(405).json({
      error: `Method ${method || 'UNKNOWN'} Not Allowed. Supported: POST, OPTIONS`,
    });
    return true;
  }

  return false;
}

function sanitizePortfolioAssets(raw: unknown): PortfolioAsset[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const sanitized: PortfolioAsset[] = [];

  for (const item of raw) {
    if (sanitized.length >= 100) break;
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const rawSym = typeof obj.symbol === 'string' ? obj.symbol : '';
    const symbol = rawSym
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9./-]/g, '')
      .slice(0, 20);
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);

    const rawCat = String(obj.category || 'US Stock') as AssetCategory;
    const category: AssetCategory = VALID_CATEGORIES.has(rawCat)
      ? rawCat
      : symbol.endsWith('.BK')
      ? 'Thai Stock'
      : 'US Stock';

    const avgCost =
      typeof obj.averageCost === 'number' &&
      Number.isFinite(obj.averageCost) &&
      obj.averageCost > 0
        ? obj.averageCost
        : undefined;
    const qty =
      typeof obj.quantity === 'number' && Number.isFinite(obj.quantity) && obj.quantity > 0
        ? obj.quantity
        : undefined;

    sanitized.push({
      id:
        typeof obj.id === 'string' && obj.id.trim()
          ? obj.id.trim().slice(0, 64)
          : `asset-${symbol}-${Date.now()}`,
      symbol,
      name:
        typeof obj.name === 'string' && obj.name.trim()
          ? obj.name.trim().slice(0, 140)
          : symbol,
      category,
      market:
        typeof obj.market === 'string' && obj.market.trim()
          ? obj.market.trim().slice(0, 40)
          : category === 'Thai Stock'
          ? 'SET'
          : 'Global',
      flag:
        typeof obj.flag === 'string' && obj.flag.trim()
          ? obj.flag.trim().slice(0, 12)
          : category === 'Thai Stock'
          ? '🇹🇭'
          : '🌐',
      currency:
        typeof obj.currency === 'string' && obj.currency.trim()
          ? obj.currency.trim().toUpperCase().slice(0, 12)
          : category === 'Thai Stock'
          ? 'THB'
          : 'USD',
      sector:
        typeof obj.sector === 'string' && obj.sector.trim()
          ? obj.sector.trim().slice(0, 100)
          : 'ทั่วไป (General)',
      themes: Array.isArray(obj.themes)
        ? obj.themes
            .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
            .map((t) => t.trim().slice(0, 40))
            .slice(0, 8)
        : [],
      topHoldings: Array.isArray(obj.topHoldings)
        ? obj.topHoldings
            .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
            .map((t) => t.trim().toUpperCase().slice(0, 16))
            .slice(0, 6)
        : undefined,
      hasDividends: typeof obj.hasDividends === 'boolean' ? obj.hasDividends : undefined,
      hasEarnings: typeof obj.hasEarnings === 'boolean' ? obj.hasEarnings : undefined,
      averageCost: avgCost,
      quantity: qty,
      addedAt:
        typeof obj.addedAt === 'string' && !Number.isNaN(Date.parse(obj.addedAt))
          ? obj.addedAt
          : new Date().toISOString(),
    });
  }

  return sanitized;
}

function sanitizeSettings(raw: unknown): CloudUserSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const out: CloudUserSettings = {};
  if (typeof obj.notificationsEnabled === 'boolean') {
    out.notificationsEnabled = obj.notificationsEnabled;
  }
  if (
    typeof obj.preEventAlertMinutes === 'number' &&
    Number.isFinite(obj.preEventAlertMinutes) &&
    obj.preEventAlertMinutes >= 5 &&
    obj.preEventAlertMinutes <= 60
  ) {
    out.preEventAlertMinutes = Math.round(obj.preEventAlertMinutes);
  }
  if (typeof obj.updatedFrom === 'string' && obj.updatedFrom.trim()) {
    out.updatedFrom = obj.updatedFrom.trim().slice(0, 40);
  }
  return out;
}

function toPublicUser(record: StoredCloudUserRecord): PublicCloudUserPayload {
  return {
    username: record.username,
    displayName: record.displayName,
    portfolio: Array.isArray(record.portfolio) ? record.portfolio : [],
    settings: record.settings && typeof record.settings === 'object' ? record.settings : {},
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function validateUsername(raw: unknown): { ok: true; clean: string; normalized: string } | { ok: false; error: string } {
  const clean = typeof raw === 'string' ? raw.trim().replace(/\s+/g, '') : '';
  if (!USERNAME_REGEX.test(clean)) {
    return {
      ok: false,
      error: 'ชื่อผู้ใช้ (Username) ต้องมีความยาว 3–32 ตัวอักษร ใช้ได้เฉพาะ a-z, 0-9 และ . _ -',
    };
  }
  return { ok: true, clean, normalized: clean.toLowerCase() };
}

function validatePassword(raw: unknown): { ok: true; password: string } | { ok: false; error: string } {
  if (typeof raw !== 'string' || raw.length < 4 || raw.length > 128) {
    return { ok: false, error: 'รหัสผ่านต้องมีความยาวระหว่าง 4–128 ตัวอักษร' };
  }
  return { ok: true, password: raw };
}

export async function handleUserSync(
  body: Record<string, unknown>,
  bearerToken: string | null
): Promise<UserSyncHandlerResult> {
  const action = typeof body.action === 'string' ? body.action.trim().toLowerCase() : '';

  if (action === 'status') {
    const creds = getRedisCredentials();
    return {
      status: 200,
      payload: {
        ok: true,
        cloudConfigured: Boolean(creds),
      },
    };
  }

  if (action !== 'register' && action !== 'login' && action !== 'save' && action !== 'pull') {
    return {
      status: 400,
      payload: {
        error: 'ระบุ action ไม่ถูกต้อง (รองรับ register, login, save, pull)',
      },
    };
  }

  const creds = getRedisCredentials();
  if (!creds) {
    return {
      status: 503,
      payload: {
        error:
          'ยังไม่ได้เชื่อมต่อ Upstash Redis (KV_REST_API_URL / KV_REST_API_TOKEN) บนเซิร์ฟเวอร์',
        cloudConfigured: false,
      },
    };
  }

  const usernameCheck = validateUsername(body.username);
  if (!usernameCheck.ok) {
    return { status: 400, payload: { error: usernameCheck.error, cloudConfigured: true } };
  }

  const key = redisKeyForUser(usernameCheck.normalized);

  try {
    // ------------------------------------------------------------------
    // ACTION 1: REGISTER
    // ------------------------------------------------------------------
    if (action === 'register') {
      const passwordCheck = validatePassword(body.password);
      if (!passwordCheck.ok) {
        return { status: 400, payload: { error: passwordCheck.error, cloudConfigured: true } };
      }

      const existingRaw = await runUpstashCommand<string | null>(creds, ['GET', key]);
      if (existingRaw) {
        return {
          status: 409,
          payload: {
            error: `ชื่อผู้ใช้ "@${usernameCheck.clean}" ถูกสมัครไว้บนคลาวด์แล้ว กรุณาเข้าสู่ระบบหรือใช้ชื่ออื่น`,
            cloudConfigured: true,
          },
        };
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPasswordScrypt(passwordCheck.password, salt);
      const nowIso = new Date().toISOString();
      const displayName =
        typeof body.displayName === 'string' && body.displayName.trim()
          ? body.displayName.trim().slice(0, 48)
          : usernameCheck.clean;

      const record: StoredCloudUserRecord = {
        username: usernameCheck.clean,
        displayName,
        passwordHash,
        salt,
        portfolio: sanitizePortfolioAssets(body.portfolio),
        settings: sanitizeSettings(body.settings),
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await runUpstashCommand(creds, ['SET', key, JSON.stringify(record)]);
      const token = signSessionToken(usernameCheck.normalized);

      return {
        status: 200,
        payload: {
          ok: true,
          cloudConfigured: true,
          cloudSynced: true,
          token,
          user: toPublicUser(record),
        },
      };
    }

    // ------------------------------------------------------------------
    // ACTION 2: LOGIN
    // ------------------------------------------------------------------
    if (action === 'login') {
      const passwordCheck = validatePassword(body.password);
      if (!passwordCheck.ok) {
        return { status: 400, payload: { error: passwordCheck.error, cloudConfigured: true } };
      }

      const existingRaw = await runUpstashCommand<string | null>(creds, ['GET', key]);
      if (!existingRaw) {
        return {
          status: 404,
          payload: {
            error: `ไม่พบบัญชี "@${usernameCheck.clean}" บนคลาวด์ กรุณาตรวจสอบชื่อผู้ใช้หรือสมัครสมาชิกใหม่`,
            cloudConfigured: true,
          },
        };
      }

      const record = JSON.parse(existingRaw) as StoredCloudUserRecord;
      if (
        !record ||
        typeof record.passwordHash !== 'string' ||
        typeof record.salt !== 'string' ||
        !verifyPasswordScrypt(passwordCheck.password, record.salt, record.passwordHash)
      ) {
        return {
          status: 401,
          payload: {
            error: 'รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง',
            cloudConfigured: true,
          },
        };
      }

      const token = signSessionToken(usernameCheck.normalized);
      return {
        status: 200,
        payload: {
          ok: true,
          cloudConfigured: true,
          cloudSynced: true,
          token,
          user: toPublicUser(record),
        },
      };
    }

    // ------------------------------------------------------------------
    // AUTH CHECK FOR SAVE & PULL
    // ------------------------------------------------------------------
    const tokenUser = verifySessionToken(bearerToken);
    if (!tokenUser || tokenUser !== usernameCheck.normalized) {
      return {
        status: 401,
        payload: {
          error: 'เซสชันคลาวด์หมดอายุหรือไม่ได้ยืนยันตัวตน กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
          cloudConfigured: true,
          authRequired: true,
        },
      };
    }

    const existingRaw = await runUpstashCommand<string | null>(creds, ['GET', key]);
    if (!existingRaw) {
      return {
        status: 404,
        payload: {
          error: 'ไม่พบข้อมูลบัญชีบนคลาวด์',
          cloudConfigured: true,
        },
      };
    }

    const existing = JSON.parse(existingRaw) as StoredCloudUserRecord;

    // ------------------------------------------------------------------
    // ACTION 3: PULL LATEST FROM CLOUD
    // ------------------------------------------------------------------
    if (action === 'pull') {
      return {
        status: 200,
        payload: {
          ok: true,
          cloudConfigured: true,
          cloudSynced: true,
          user: toPublicUser(existing),
        },
      };
    }

    // ------------------------------------------------------------------
    // ACTION 4: SAVE LATEST PORTFOLIO & SETTINGS
    // ------------------------------------------------------------------
    const nowIso = new Date().toISOString();
    const updatedRecord: StoredCloudUserRecord = {
      ...existing,
      displayName:
        typeof body.displayName === 'string' && body.displayName.trim()
          ? body.displayName.trim().slice(0, 48)
          : existing.displayName,
      portfolio:
        body.portfolio !== undefined
          ? sanitizePortfolioAssets(body.portfolio)
          : existing.portfolio,
      settings:
        body.settings !== undefined
          ? { ...existing.settings, ...sanitizeSettings(body.settings) }
          : existing.settings,
      updatedAt: nowIso,
    };

    await runUpstashCommand(creds, ['SET', key, JSON.stringify(updatedRecord)]);

    return {
      status: 200,
      payload: {
        ok: true,
        cloudConfigured: true,
        cloudSynced: true,
        updatedAt: nowIso,
        portfolioCount: updatedRecord.portfolio.length,
      },
    };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : 'ไม่สามารถเชื่อมต่อฐานข้อมูลคลาวด์ Upstash Redis ได้ในขณะนี้';
    return {
      status: 502,
      payload: {
        error: `เชื่อมต่อคลาวด์ไม่สำเร็จ: ${msg}`,
        cloudConfigured: true,
      },
    };
  }
}
