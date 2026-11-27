import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  LogIn,
  LogOut,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { LocalUserAccount, QuotaSnapshot } from '../types';
import {
  authenticateLocalAccount,
  deleteLocalAccount,
  GUEST_ACCOUNT_ID,
  loadLocalAccounts,
  registerLocalAccount,
  saveActiveAccountId,
} from '../utils/localAuth';
import { SidebarQuotaCard } from './ApiQuotaGauge';
import { PWAInstallButton } from './PWAInstallButton';

interface AuthModalProps {
  open: boolean;
  accounts: LocalUserAccount[];
  activeAccountId: string;
  portfolioCount: number;
  quota: QuotaSnapshot;
  onExportJson: () => void;
  onImportJsonFile: (file: File) => void;
  onClose: () => void;
  onAuthChange: (
    accounts: LocalUserAccount[],
    activeAccountId: string,
    noticeMessage?: string
  ) => void;
}

type ModalSection = 'settings' | 'login' | 'register';

export function AuthModal({
  open,
  accounts,
  activeAccountId,
  portfolioCount,
  quota,
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

  if (!open) return null;

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'register') {
        const result = await registerLocalAccount({
          username,
          displayName,
          password,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onAuthChange(
          result.accounts,
          result.account.id,
          `สมัครสมาชิก "${result.account.displayName}" สำเร็จแล้ว (พอร์ตส่วนตัวแยกเฉพาะบัญชีนี้)`
        );
        setUsername('');
        setDisplayName('');
        setPassword('');
        setMode('settings');
      } else if (mode === 'login') {
        const result = await authenticateLocalAccount({ username, password });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onAuthChange(
          loadLocalAccounts(),
          result.account.id,
          `เข้าสู่ระบบบัญชี "${result.account.displayName}" เรียบร้อยแล้ว`
        );
        setUsername('');
        setPassword('');
        setMode('settings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถดำเนินการได้');
    } finally {
      setSubmitting(false);
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
    saveActiveAccountId(GUEST_ACCOUNT_ID);
    onAuthChange(accounts, GUEST_ACCOUNT_ID, 'ออกจากระบบแล้ว (กลับมาใช้โหมดผู้เยี่ยมชม)');
  }

  function handleDeleteAccount(id: string) {
    const target = accounts.find((a) => a.id === id);
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
              {/* 1. Full AI Quota Gauge */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">
                  หลอดแสดงโควตา AI (Free Tier Protection)
                </div>
                <SidebarQuotaCard quota={quota} />
              </div>

              {/* 2. PWA Install & JSON Backup Utilities */}
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

              {/* 3. Active Account & Local Account Switcher */}
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
                  ? 'สร้างบัญชีส่วนตัวในเครื่อง'
                  : 'เข้าสู่ระบบ'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
