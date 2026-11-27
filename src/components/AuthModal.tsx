import React, { useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  CloudOff,
  Download,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { LocalUserAccount, PortfolioAsset, QuotaSnapshot } from '../types';
import {
  authenticateLocalAccount,
  deleteLocalAccount,
  GUEST_ACCOUNT_ID,
  loadLocalAccounts,
  loadPortfolioForAccount,
  registerLocalAccount,
  saveActiveAccountId,
  upsertCloudAccountLocally,
} from '../utils/localAuth';
import {
  clearCloudSessionToken,
  CloudSyncState,
  hasCloudSessionToken,
  loginCloudAccount,
  mergeCloudAndLocalPortfolios,
  registerCloudAccount,
  saveCloudAccountData,
} from '../services/userSyncService';
import { SidebarQuotaCard } from './ApiQuotaGauge';
import { PWAInstallButton } from './PWAInstallButton';

interface AuthModalProps {
  open: boolean;
  accounts: LocalUserAccount[];
  activeAccountId: string;
  currentPortfolio: PortfolioAsset[];
  portfolioCount: number;
  quota: QuotaSnapshot;
  cloudConfigured: boolean;
  cloudSyncState: CloudSyncState;
  cloudLastSyncedAt: string | null;
  onPullCloudLatest: () => Promise<void>;
  onExportJson: () => void;
  onImportJsonFile: (file: File) => void;
  onClose: () => void;
  onAuthChange: (
    accounts: LocalUserAccount[],
    activeAccountId: string,
    noticeMessage?: string,
    options?: {
      portfolioOverride?: PortfolioAsset[];
      cloudSynced?: boolean;
      cloudConfigured?: boolean;
    }
  ) => void;
}

type ModalSection = 'settings' | 'login' | 'register';

export function AuthModal({
  open,
  accounts,
  activeAccountId,
  currentPortfolio,
  portfolioCount,
  quota,
  cloudConfigured,
  cloudSyncState,
  cloudLastSyncedAt,
  onPullCloudLatest,
  onExportJson,
  onImportJsonFile,
  onClose,
  onAuthChange,
}: AuthModalProps) {
  const [mode, setMode] = useState<ModalSection>('settings');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pulling, setPulling] = useState(false);

  if (!open) return null;

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? null;
  const hasActiveCloudToken = activeAccount
    ? hasCloudSessionToken(activeAccount.username)
    : false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'register') {
        const initialPortfolio =
          activeAccountId === GUEST_ACCOUNT_ID ? currentPortfolio : [];

        const cloudRes = await registerCloudAccount({
          username,
          displayName,
          password,
          portfolio: initialPortfolio,
          settings: { preEventAlertMinutes: 15 },
        });

        if (cloudRes.ok) {
          const localLinked = await upsertCloudAccountLocally({
            username: cloudRes.user.username,
            displayName: cloudRes.user.displayName,
            password,
            portfolio: cloudRes.user.portfolio,
          });
          onAuthChange(
            localLinked.accounts,
            localLinked.account.id,
            `สมัครสมาชิกคลาวด์ "${cloudRes.user.displayName}" สำเร็จแล้ว (☁️ ซิงก์ข้ามอุปกรณ์อัตโนมัติ)`,
            {
              portfolioOverride: cloudRes.user.portfolio,
              cloudSynced: true,
              cloudConfigured: true,
            }
          );
          setUsername('');
          setDisplayName('');
          setPassword('');
          setMode('settings');
          return;
        }

        // If Redis is not yet configured on server, gracefully fall back to local account
        if (!cloudRes.cloudConfigured) {
          const localRes = await registerLocalAccount({
            username,
            displayName,
            password,
          });
          if (!localRes.ok) {
            setError(localRes.error);
            return;
          }
          onAuthChange(
            localRes.accounts,
            localRes.account.id,
            `สมัครสมาชิก "${localRes.account.displayName}" สำเร็จ (โหมดเก็บในเครื่อง — ยังไม่ได้ตั้งค่า Upstash Redis)`,
            { cloudSynced: false, cloudConfigured: false }
          );
          setUsername('');
          setDisplayName('');
          setPassword('');
          setMode('settings');
          return;
        }

        setError(cloudRes.error);
        return;
      } else if (mode === 'login') {
        const cloudRes = await loginCloudAccount({ username, password });

        if (cloudRes.ok) {
          // Auto-merge local portfolio (Guest or cached local account portfolio) with Cloud portfolio
          const existingLocalAccount = accounts.find(
            (a) => a.username.toLowerCase() === cloudRes.user.username.toLowerCase()
          );
          const cachedAcctPortfolio = existingLocalAccount
            ? loadPortfolioForAccount(existingLocalAccount.id)
            : [];
          const guestPortfolio =
            activeAccountId === GUEST_ACCOUNT_ID ? currentPortfolio : [];

          const localCandidates = [...cachedAcctPortfolio, ...guestPortfolio];
          const { merged, addedFromLocal, updatedFromLocal } = mergeCloudAndLocalPortfolios(
            cloudRes.user.portfolio,
            localCandidates
          );

          if (addedFromLocal > 0 || updatedFromLocal > 0) {
            await saveCloudAccountData({
              username: cloudRes.user.username,
              displayName: cloudRes.user.displayName,
              portfolio: merged,
            });
          }

          const localLinked = await upsertCloudAccountLocally({
            username: cloudRes.user.username,
            displayName: cloudRes.user.displayName,
            password,
            portfolio: merged,
          });

          const mergeNote =
            addedFromLocal > 0
              ? ` (รวมพอร์ตในเครื่องเพิ่ม ${addedFromLocal} ตัวและซิงก์ขึ้นคลาวด์แล้ว)`
              : ` (ดึงข้อมูลพอร์ต ${merged.length} ตัวจากคลาวด์แล้ว)`;

          onAuthChange(
            localLinked.accounts,
            localLinked.account.id,
            `เข้าสู่ระบบ "${cloudRes.user.displayName}" สำเร็จ${mergeNote}`,
            {
              portfolioOverride: merged,
              cloudSynced: true,
              cloudConfigured: true,
            }
          );
          setUsername('');
          setPassword('');
          setMode('settings');
          return;
        }

        // Fallback to local auth ONLY if Redis is not configured on the server
        if (!cloudRes.cloudConfigured) {
          const localRes = await authenticateLocalAccount({ username, password });
          if (!localRes.ok) {
            setError(localRes.error);
            return;
          }
          onAuthChange(
            loadLocalAccounts(),
            localRes.account.id,
            `เข้าสู่ระบบบัญชี "${localRes.account.displayName}" เรียบร้อยแล้ว (โหมดในเครื่อง)`,
            { cloudSynced: false, cloudConfigured: false }
          );
          setUsername('');
          setPassword('');
          setMode('settings');
          return;
        }

        setError(cloudRes.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถดำเนินการได้');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleManualPull() {
    if (!activeAccount) return;
    if (!hasActiveCloudToken) {
      setUsername(activeAccount.username);
      setError('กรุณากรอกรหัสผ่านเพื่อยืนยันตัวตนและดึงข้อมูลล่าสุดจากคลาวด์');
      setMode('login');
      return;
    }
    setPulling(true);
    try {
      await onPullCloudLatest();
    } finally {
      setPulling(false);
    }
  }

  function handleSwitchAccount(id: string) {
    saveActiveAccountId(id);
    const target = accounts.find((a) => a.id === id);
    onAuthChange(
      accounts,
      id,
      target ? `สลับไปยังบัญชี "${target.displayName}" แล้ว` : 'สลับไปยังโหมดผู้เยี่ยมชมแล้ว'
    );
  }

  function handleLogoutToGuest() {
    if (activeAccount) {
      clearCloudSessionToken(activeAccount.username);
    }
    saveActiveAccountId(GUEST_ACCOUNT_ID);
    onAuthChange(accounts, GUEST_ACCOUNT_ID, 'ออกจากระบบแล้ว (กลับมาใช้โหมดผู้เยี่ยมชม)');
  }

  function handleDeleteAccount(id: string) {
    const target = accounts.find((a) => a.id === id);
    if (target) {
      clearCloudSessionToken(target.username);
    }
    const nextAccounts = deleteLocalAccount(id);
    const nextActiveId = activeAccountId === id ? GUEST_ACCOUNT_ID : activeAccountId;
    onAuthChange(
      nextAccounts,
      nextActiveId,
      target ? `ลบบัญชี "${target.displayName}" ออกจากเครื่องนี้แล้ว` : 'ลบบัญชีเรียบร้อยแล้ว'
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#0D121A] border-t sm:border border-[#253042] rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle on mobile */}
        <div className="pt-2.5 pb-1 flex justify-center sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-700" aria-hidden="true" />
        </div>

        {/* Header */}
        <div className="px-4 py-3 border-b border-[#1E2634] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h2 id="auth-modal-title" className="text-sm font-bold text-slate-100 truncate">
                บัญชี &amp; ตั้งค่าระบบ
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                {activeAccount
                  ? `${activeAccount.displayName} (@${activeAccount.username})`
                  : 'โหมดผู้เยี่ยมชม (Guest)'}{' '}
                · {portfolioCount} สินทรัพย์
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-[#141C28] border border-[#253042] text-slate-300 hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Switcher */}
        <div className="px-4 pt-3 pb-2 shrink-0">
          <div className="grid grid-cols-3 gap-1 p-1 bg-[#090C11] border border-[#1E2634] rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMode('settings');
                setError(null);
              }}
              className={`min-h-[38px] text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                mode === 'settings'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ตั้งค่า &amp; โควตา
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`min-h-[38px] text-xs font-semibold rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center gap-1 ${
                mode === 'login'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>เข้าสู่ระบบ</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`min-h-[38px] text-xs font-semibold rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center gap-1 ${
                mode === 'register'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>สมัครใหม่</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 pt-2 space-y-4 overflow-y-auto flex-1">
          {mode === 'settings' ? (
            <>
              {/* 1. Cross-Device Cloud Sync Status & Manual Pull Card */}
              <div className="bg-[#10151E] border border-[#1E2634] rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5">
                    {cloudConfigured ? (
                      <Cloud className="w-4 h-4 text-sky-400 shrink-0" />
                    ) : (
                      <CloudOff className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <span>ซิงก์พอร์ตข้ามอุปกรณ์ (Cloud Sync)</span>
                  </span>
                  {cloudLastSyncedAt && cloudSyncState === 'synced' && (
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">
                      {cloudLastSyncedAt} น.
                    </span>
                  )}
                </div>

                {/* Status Badge */}
                {activeAccount ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 ${
                        cloudSyncState === 'synced' && hasActiveCloudToken
                          ? 'bg-emerald-500/12 border-emerald-500/35 text-emerald-300'
                          : cloudSyncState === 'syncing'
                          ? 'bg-amber-500/12 border-amber-500/35 text-amber-200'
                          : !cloudConfigured || cloudSyncState === 'local_only'
                          ? 'bg-slate-800/70 border-slate-700 text-slate-300'
                          : 'bg-sky-500/12 border-sky-500/35 text-sky-200'
                      }`}
                    >
                      <span>
                        {cloudSyncState === 'syncing'
                          ? '☁️ กำลังซิงก์ข้อมูลคลาวด์...'
                          : cloudSyncState === 'synced' && hasActiveCloudToken
                          ? '☁️ ซิงก์ข้อมูลคลาวด์แล้ว'
                          : !cloudConfigured || cloudSyncState === 'local_only'
                          ? '💾 โหมดเก็บในเครื่อง (รอเชื่อม Upstash Redis)'
                          : '☁️ เข้าสู่ระบบอีกครั้งเพื่อเชื่อมคลาวด์'}
                      </span>
                    </div>

                    {cloudConfigured && (
                      <button
                        type="button"
                        onClick={() => void handleManualPull()}
                        disabled={pulling || cloudSyncState === 'syncing'}
                        className="min-h-[38px] px-3 rounded-xl bg-[#090C11] border border-[#253042] hover:border-amber-500/50 disabled:opacity-50 text-xs font-semibold text-amber-300 inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${
                            pulling || cloudSyncState === 'syncing' ? 'animate-spin' : ''
                          }`}
                        />
                        <span>🔄 ดึงข้อมูลล่าสุด</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                    <span>เข้าสู่ระบบเพื่อซิงก์พอร์ตและราคาทุนระหว่างมือถือกับคอมพิวเตอร์</span>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setError(null);
                      }}
                      className="min-h-[34px] px-3 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-300 font-semibold shrink-0 cursor-pointer"
                    >
                      เข้าสู่ระบบ
                    </button>
                  </div>
                )}
              </div>

              {/* 2. Full AI Quota Gauge */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">
                  หลอดแสดงโควตา AI (Free Tier Protection · แคช 2 ชม.)
                </div>
                <SidebarQuotaCard quota={quota} />
              </div>

              {/* 3. PWA Install & JSON Backup Utilities */}
              <div className="bg-[#10151E] border border-[#1E2634] rounded-xl p-3.5 space-y-3">
                <div className="text-xs font-semibold text-slate-300">
                  ติดตั้งแอป &amp; สำรองพอร์ต (JSON)
                </div>

                <PWAInstallButton />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onExportJson}
                    disabled={portfolioCount === 0}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-[#090C11] border border-[#253042] hover:border-amber-500/50 disabled:opacity-45 disabled:cursor-not-allowed text-xs font-medium text-slate-200 inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Export JSON</span>
                  </button>

                  <label className="min-h-[44px] px-3 py-2 rounded-xl bg-[#090C11] border border-[#253042] hover:border-sky-500/50 text-xs font-medium text-slate-200 inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
                    <Upload className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>Import JSON</span>
                    <input
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          onImportJsonFile(file);
                          e.target.value = '';
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* 4. Active Account & Local Account Switcher */}
              <div className="bg-[#10151E] border border-[#1E2634] rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-300 inline-flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-400" />
                    <span>บัญชีในเครื่องนี้ ({accounts.length})</span>
                  </span>
                  {activeAccount && (
                    <button
                      type="button"
                      onClick={handleLogoutToGuest}
                      className="text-xs text-slate-400 hover:text-rose-300 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>ออกเป็น Guest</span>
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => handleSwitchAccount(GUEST_ACCOUNT_ID)}
                    className={`w-full min-h-[44px] px-3 py-2 rounded-xl border text-left flex items-center justify-between text-xs cursor-pointer transition-colors ${
                      activeAccountId === GUEST_ACCOUNT_ID
                        ? 'bg-amber-500/12 border-amber-500/40 text-amber-200'
                        : 'bg-[#090C11] border-[#1E2634] text-slate-300 hover:border-[#2F3C52]'
                    }`}
                  >
                    <span>ผู้เยี่ยมชม (Guest)</span>
                    {activeAccountId === GUEST_ACCOUNT_ID && (
                      <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                  </button>

                  {accounts.map((acct) => {
                    const isActive = acct.id === activeAccountId;
                    return (
                      <div
                        key={acct.id}
                        className={`min-h-[44px] px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                          isActive
                            ? 'bg-amber-500/12 border-amber-500/40 text-amber-200'
                            : 'bg-[#090C11] border-[#1E2634] text-slate-300'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSwitchAccount(acct.id)}
                          className="flex-1 text-left min-w-0 cursor-pointer"
                        >
                          <div className="font-semibold truncate">{acct.displayName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            @{acct.username}
                          </div>
                        </button>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isActive && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                          <button
                            type="button"
                            onClick={() => handleDeleteAccount(acct.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 cursor-pointer"
                            aria-label={`ลบบัญชี ${acct.displayName}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="px-3 py-2 rounded-xl bg-[#10151E] border border-[#1E2634] text-[11px] text-slate-400 leading-relaxed">
                {cloudConfigured
                  ? mode === 'register'
                    ? '☁️ บัญชีใหม่จะบันทึกบนคลาวด์ (Upstash Redis) ทันที สามารถใช้ Username/Password เดิมเข้าสู่ระบบได้ทั้งมือถือและคอมพิวเตอร์'
                    : '☁️ เมื่อเข้าสู่ระบบ พอร์ตและราคาทุนเฉลี่ยจากคลาวด์จะถูกดึงและรวมกับหุ้นที่มีอยู่ในเครื่องนี้ให้อัตโนมัติ'
                  : '💾 ขณะนี้เซิร์ฟเวอร์ยังไม่ได้เชื่อมต่อ Upstash Redis ระบบจะเก็บบัญชีและพอร์ตไว้ในเครื่องนี้ก่อน'}
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1.5">
                  ชื่อผู้ใช้ (Username)
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="เช่น somchai_inv"
                  className="w-full min-h-[44px] bg-[#090C11] border border-[#253042] rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70"
                />
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-xs text-slate-300 mb-1.5">
                    ชื่อที่แสดงในพอร์ต
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="เช่น พอร์ตระยะยาว 2026"
                    className="w-full min-h-[44px] bg-[#090C11] border border-[#253042] rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-300 mb-1.5">
                  รหัสผ่าน (อย่างน้อย 4 ตัวอักษร)
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full min-h-[44px] bg-[#090C11] border border-[#253042] rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70"
                />
              </div>

              {error && (
                <div className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[44px] py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 text-sm font-bold transition-colors cursor-pointer"
              >
                {submitting
                  ? 'กำลังดำเนินการ...'
                  : mode === 'register'
                  ? cloudConfigured
                    ? 'สมัครสมาชิก & ซิงก์คลาวด์'
                    : 'สร้างบัญชีส่วนตัวในเครื่อง'
                  : cloudConfigured
                  ? 'เข้าสู่ระบบ & ดึงพอร์ตจากคลาวด์'
                  : 'เข้าสู่ระบบ'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
