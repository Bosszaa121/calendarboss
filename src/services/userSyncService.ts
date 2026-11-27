import { PortfolioAsset } from '../types';

export type CloudSyncState = 'idle' | 'syncing' | 'synced' | 'needs_auth' | 'local_only' | 'error';

export interface CloudUserSettings {
  notificationsEnabled?: boolean;
  preEventAlertMinutes?: number;
  updatedFrom?: string;
}

export interface CloudUserProfile {
  username: string;
  displayName: string;
  portfolio: PortfolioAsset[];
  settings: CloudUserSettings;
  createdAt: string;
  updatedAt: string;
}

// Strict in-memory Bearer token store (NEVER written to localStorage/sessionStorage)
const memorySessionTokens = new Map<string, string>();

function normUser(username: string): string {
  return username.trim().toLowerCase();
}

export function hasCloudSessionToken(username: string | undefined | null): boolean {
  if (!username) return false;
  return memorySessionTokens.has(normUser(username));
}

export function clearCloudSessionToken(username?: string): void {
  if (username) {
    memorySessionTokens.delete(normUser(username));
  } else {
    memorySessionTokens.clear();
  }
}

/**
 * Auto-merges local device portfolio into cloud portfolio on login without losing unique assets.
 * Cloud items are primary; unique local items are appended, and missing cost/quantity fields are filled.
 */
export function mergeCloudAndLocalPortfolios(
  cloudPortfolio: PortfolioAsset[],
  localPortfolio: PortfolioAsset[]
): { merged: PortfolioAsset[]; addedFromLocal: number; updatedFromLocal: number } {
  const bySymbol = new Map<string, PortfolioAsset>();
  for (const item of cloudPortfolio) {
    bySymbol.set(item.symbol.trim().toUpperCase(), item);
  }

  let addedFromLocal = 0;
  let updatedFromLocal = 0;

  for (const localItem of localPortfolio) {
    const sym = localItem.symbol.trim().toUpperCase();
    if (!sym) continue;
    const existing = bySymbol.get(sym);
    if (!existing) {
      bySymbol.set(sym, localItem);
      addedFromLocal += 1;
    } else {
      const needsCost =
        (existing.averageCost === undefined || existing.averageCost <= 0) &&
        typeof localItem.averageCost === 'number' &&
        localItem.averageCost > 0;
      const needsQty =
        (existing.quantity === undefined || existing.quantity <= 0) &&
        typeof localItem.quantity === 'number' &&
        localItem.quantity > 0;
      if (needsCost || needsQty) {
        bySymbol.set(sym, {
          ...existing,
          averageCost: needsCost ? localItem.averageCost : existing.averageCost,
          quantity: needsQty ? localItem.quantity : existing.quantity,
        });
        updatedFromLocal += 1;
      }
    }
  }

  return {
    merged: Array.from(bySymbol.values()).slice(0, 100),
    addedFromLocal,
    updatedFromLocal,
  };
}

interface RawUserSyncResponse {
  ok?: boolean;
  cloudConfigured?: boolean;
  cloudSynced?: boolean;
  authRequired?: boolean;
  token?: string;
  user?: CloudUserProfile;
  updatedAt?: string;
  error?: string;
}

async function postUserSync(
  body: Record<string, unknown>,
  token?: string | null
): Promise<{ status: number; data: RawUserSyncResponse }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch('/api/user-sync', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as RawUserSyncResponse;
  return { status: res.status, data };
}

export async function checkCloudSyncConfigured(): Promise<boolean> {
  try {
    const { status, data } = await postUserSync({ action: 'status' });
    return status === 200 && Boolean(data.cloudConfigured);
  } catch {
    return false;
  }
}

export async function registerCloudAccount(params: {
  username: string;
  password: string;
  displayName?: string;
  portfolio?: PortfolioAsset[];
  settings?: CloudUserSettings;
}): Promise<
  | { ok: true; cloudConfigured: true; user: CloudUserProfile }
  | { ok: false; cloudConfigured: boolean; error: string }
> {
  try {
    const { status, data } = await postUserSync({
      action: 'register',
      username: params.username,
      password: params.password,
      displayName: params.displayName,
      portfolio: params.portfolio ?? [],
      settings: params.settings ?? {},
    });

    if (status === 503 || data.cloudConfigured === false) {
      return {
        ok: false,
        cloudConfigured: false,
        error: data.error || 'ยังไม่ได้เชื่อมต่อ Upstash Redis บนเซิร์ฟเวอร์',
      };
    }

    if (status !== 200 || !data.ok || !data.user || !data.token) {
      return {
        ok: false,
        cloudConfigured: true,
        error: data.error || 'ไม่สามารถสมัครบัญชีคลาวด์ได้',
      };
    }

    memorySessionTokens.set(normUser(data.user.username), data.token);
    return { ok: true, cloudConfigured: true, user: data.user };
  } catch (err) {
    return {
      ok: false,
      cloudConfigured: false,
      error: err instanceof Error ? err.message : 'เชื่อมต่อเซิร์ฟเวอร์คลาวด์ไม่สำเร็จ',
    };
  }
}

export async function loginCloudAccount(params: {
  username: string;
  password: string;
}): Promise<
  | { ok: true; cloudConfigured: true; user: CloudUserProfile }
  | { ok: false; cloudConfigured: boolean; error: string; notFound?: boolean }
> {
  try {
    const { status, data } = await postUserSync({
      action: 'login',
      username: params.username,
      password: params.password,
    });

    if (status === 503 || data.cloudConfigured === false) {
      return {
        ok: false,
        cloudConfigured: false,
        error: data.error || 'ยังไม่ได้เชื่อมต่อ Upstash Redis บนเซิร์ฟเวอร์',
      };
    }

    if (status !== 200 || !data.ok || !data.user || !data.token) {
      return {
        ok: false,
        cloudConfigured: true,
        notFound: status === 404,
        error: data.error || 'เข้าสู่ระบบคลาวด์ไม่สำเร็จ',
      };
    }

    memorySessionTokens.set(normUser(data.user.username), data.token);
    return { ok: true, cloudConfigured: true, user: data.user };
  } catch (err) {
    return {
      ok: false,
      cloudConfigured: false,
      error: err instanceof Error ? err.message : 'เชื่อมต่อเซิร์ฟเวอร์คลาวด์ไม่สำเร็จ',
    };
  }
}

export async function pullCloudAccountData(username: string): Promise<
  | { ok: true; user: CloudUserProfile }
  | { ok: false; cloudConfigured: boolean; authRequired?: boolean; error: string }
> {
  const token = memorySessionTokens.get(normUser(username));
  if (!token) {
    return {
      ok: false,
      cloudConfigured: true,
      authRequired: true,
      error: 'กรุณาเข้าสู่ระบบด้วยรหัสผ่านอีกครั้งเพื่อยืนยันสิทธิ์ดึงข้อมูลจากคลาวด์',
    };
  }

  try {
    const { status, data } = await postUserSync(
      { action: 'pull', username },
      token
    );

    if (status === 503 || data.cloudConfigured === false) {
      return {
        ok: false,
        cloudConfigured: false,
        error: data.error || 'ยังไม่ได้เชื่อมต่อ Upstash Redis',
      };
    }

    if (status === 401 || data.authRequired) {
      memorySessionTokens.delete(normUser(username));
      return {
        ok: false,
        cloudConfigured: true,
        authRequired: true,
        error: data.error || 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง',
      };
    }

    if (status !== 200 || !data.ok || !data.user) {
      return {
        ok: false,
        cloudConfigured: true,
        error: data.error || 'ดึงข้อมูลล่าสุดจากคลาวด์ไม่สำเร็จ',
      };
    }

    return { ok: true, user: data.user };
  } catch (err) {
    return {
      ok: false,
      cloudConfigured: true,
      error: err instanceof Error ? err.message : 'เชื่อมต่อคลาวด์ไม่สำเร็จ',
    };
  }
}

export async function saveCloudAccountData(params: {
  username: string;
  displayName?: string;
  portfolio: PortfolioAsset[];
  settings?: CloudUserSettings;
}): Promise<
  | { ok: true; updatedAt: string }
  | { ok: false; cloudConfigured: boolean; authRequired?: boolean; error: string }
> {
  const token = memorySessionTokens.get(normUser(params.username));
  if (!token) {
    return {
      ok: false,
      cloudConfigured: true,
      authRequired: true,
      error: 'ต้องเข้าสู่ระบบเพื่อซิงก์ข้อมูลขึ้นคลาวด์',
    };
  }

  try {
    const { status, data } = await postUserSync(
      {
        action: 'save',
        username: params.username,
        displayName: params.displayName,
        portfolio: params.portfolio,
        settings: params.settings,
      },
      token
    );

    if (status === 503 || data.cloudConfigured === false) {
      return {
        ok: false,
        cloudConfigured: false,
        error: data.error || 'ยังไม่ได้เชื่อมต่อ Upstash Redis',
      };
    }

    if (status === 401 || data.authRequired) {
      memorySessionTokens.delete(normUser(params.username));
      return {
        ok: false,
        cloudConfigured: true,
        authRequired: true,
        error: data.error || 'เซสชันคลาวด์หมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง',
      };
    }

    if (status !== 200 || !data.ok) {
      return {
        ok: false,
        cloudConfigured: true,
        error: data.error || 'บันทึกข้อมูลขึ้นคลาวด์ไม่สำเร็จ',
      };
    }

    return { ok: true, updatedAt: data.updatedAt || new Date().toISOString() };
  } catch (err) {
    return {
      ok: false,
      cloudConfigured: true,
      error: err instanceof Error ? err.message : 'บันทึกขึ้นคลาวด์ไม่สำเร็จ',
    };
  }
}
