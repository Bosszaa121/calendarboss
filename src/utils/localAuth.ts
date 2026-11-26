import { LocalUserAccount, PortfolioAsset } from '../types';

const ACCOUNTS_KEY = 'investcal_local_accounts_v3';
const ACTIVE_SESSION_KEY = 'investcal_active_account_id_v3';
const GUEST_ID = 'guest-local';

export const GUEST_ACCOUNT_ID = GUEST_ID;

export function getPortfolioStorageKey(accountId: string): string {
  return `investcal_portfolio_v3_${accountId}`;
}

export function getReadAlertsStorageKey(accountId: string): string {
  return `investcal_read_alerts_v3_${accountId}`;
}

function generateSalt(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(input);
    const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hashBuf), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback hash for non-secure contexts
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}::investcal::${password}`);
}

export function loadLocalAccounts(): LocalUserAccount[] {
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is LocalUserAccount =>
        Boolean(a) &&
        typeof a.id === 'string' &&
        typeof a.username === 'string' &&
        typeof a.passwordHash === 'string'
    );
  } catch {
    return [];
  }
}

export function saveLocalAccounts(accounts: LocalUserAccount[]): void {
  try {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // ignore quota errors
  }
}

export function loadActiveAccountId(accounts: LocalUserAccount[]): string {
  try {
    const saved = window.localStorage.getItem(ACTIVE_SESSION_KEY);
    if (saved === GUEST_ID) return GUEST_ID;
    if (saved && accounts.some((a) => a.id === saved)) {
      return saved;
    }
  } catch {
    // ignore
  }
  return GUEST_ID;
}

export function saveActiveAccountId(accountId: string): void {
  try {
    window.localStorage.setItem(ACTIVE_SESSION_KEY, accountId);
  } catch {
    // ignore
  }
}

export function loadPortfolioForAccount(accountId: string): PortfolioAsset[] {
  try {
    const raw = window.localStorage.getItem(getPortfolioStorageKey(accountId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePortfolioForAccount(accountId: string, assets: PortfolioAsset[]): void {
  try {
    window.localStorage.setItem(getPortfolioStorageKey(accountId), JSON.stringify(assets));
  } catch {
    // ignore quota errors
  }
}

export function getAccountPortfolioCount(accountId: string): number {
  return loadPortfolioForAccount(accountId).length;
}

export async function registerLocalAccount(params: {
  username: string;
  password: string;
  displayName?: string;
}): Promise<{ ok: true; account: LocalUserAccount; accounts: LocalUserAccount[] } | { ok: false; error: string }> {
  const cleanedUsername = params.username.trim().replace(/\s+/g, '');
  if (cleanedUsername.length < 3 || cleanedUsername.length > 32) {
    return { ok: false, error: 'ชื่อผู้ใช้ (Username) ต้องมีความยาว 3–32 ตัวอักษรและไม่มีเว้นวรรค' };
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(cleanedUsername)) {
    return {
      ok: false,
      error: 'ชื่อผู้ใช้ใช้ได้เฉพาะตัวอักษรภาษาอังกฤษ ตัวเลข และสัญลักษณ์ . _ - เท่านั้น',
    };
  }
  if (params.password.length < 4) {
    return { ok: false, error: 'รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร' };
  }

  const existing = loadLocalAccounts();
  if (existing.some((a) => a.username.toLowerCase() === cleanedUsername.toLowerCase())) {
    return {
      ok: false,
      error: `ชื่อผู้ใช้ "@${cleanedUsername}" ถูกสมัครไว้แล้วในเครื่องนี้ กรุณาเข้าสู่ระบบหรือใช้ชื่ออื่น`,
    };
  }

  const salt = generateSalt();
  const passwordHash = await hashPassword(params.password, salt);
  const account: LocalUserAccount = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    username: cleanedUsername,
    displayName: (params.displayName?.trim() || cleanedUsername).slice(0, 48),
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
  };

  const nextAccounts = [...existing, account];
  saveLocalAccounts(nextAccounts);
  // Guarantee brand-new account starts with 0 assets (100% clean portfolio)
  savePortfolioForAccount(account.id, []);
  saveActiveAccountId(account.id);

  return { ok: true, account, accounts: nextAccounts };
}

export async function authenticateLocalAccount(params: {
  username: string;
  password: string;
}): Promise<{ ok: true; account: LocalUserAccount } | { ok: false; error: string }> {
  const cleaned = params.username.trim().toLowerCase();
  const accounts = loadLocalAccounts();
  const found = accounts.find((a) => a.username.toLowerCase() === cleaned);
  if (!found) {
    return {
      ok: false,
      error: 'ไม่พบบัญชีผู้ใช้นี้ในเบราว์เซอร์ กรุณาตรวจสอบ Username หรือสมัครสมาชิกใหม่',
    };
  }
  const computed = await hashPassword(params.password, found.salt);
  if (computed !== found.passwordHash) {
    return { ok: false, error: 'รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' };
  }
  saveActiveAccountId(found.id);
  return { ok: true, account: found };
}

export function deleteLocalAccount(accountId: string): LocalUserAccount[] {
  const existing = loadLocalAccounts();
  const next = existing.filter((a) => a.id !== accountId);
  saveLocalAccounts(next);
  try {
    window.localStorage.removeItem(getPortfolioStorageKey(accountId));
    window.localStorage.removeItem(getReadAlertsStorageKey(accountId));
  } catch {
    // ignore
  }
  if (loadActiveAccountId(next) === accountId) {
    saveActiveAccountId(GUEST_ID);
  }
  return next;
}
