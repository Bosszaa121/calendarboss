import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  KeyRound,
  LogIn,
  LogOut,
  Trash2,
  Upload,
  User as UserIcon,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { LocalUserAccount } from '../types';
import {
  authenticateLocalAccount,
  deleteLocalAccount,
  getAccountPortfolioCount,
  GUEST_ACCOUNT_ID,
  registerLocalAccount,
  saveActiveAccountId,
} from '../utils/localAuth';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  accounts: LocalUserAccount[];
  activeAccountId: string;
  onAuthChange: (nextAccounts: LocalUserAccount[], nextActiveId: string, message?: string) => void;
  onExportJson: () => void;
  onImportJsonFile: (file: File) => void;
}

export function AuthModal({
  open,
  onClose,
  accounts,
  activeAccountId,
  onAuthChange,
  onExportJson,
  onImportJsonFile,
}: AuthModalProps) {
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  if (!open) return null;

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      if (authTab === 'login') {
        const res = await authenticateLocalAccount({ username, password });
        if (!res.ok) {
          setErrorMsg(res.error);
          return;
        }
        setUsername('');
        setPassword('');
        onAuthChange(
          accounts,
          res.account.id,
          `เข้าสู่ระบบบัญชี @${res.account.username} เรียบร้อยแล้ว`
        );
        onClose();
      } else {
        const res = await registerLocalAccount({
          username,
          password,
          displayName,
        });
        if (!res.ok) {
          setErrorMsg(res.error);
          return;
        }
        setUsername('');
        setPassword('');
        setDisplayName('');
        onAuthChange(
          res.accounts,
          res.account.id,
          `สมัครสมาชิก @${res.account.username} สำเร็จ — พอร์ตเริ่มต้นว่าง 0 รายการพร้อมใช้งาน`
        );
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  function handleSwitchAccount(targetId: string) {
    saveActiveAccountId(targetId);
    const target = accounts.find((a) => a.id === targetId);
    const label = target ? `@${target.username}` : 'โหมดผู้เยี่ยมชม (Guest)';
    onAuthChange(accounts, targetId, `สลับไปยังบัญชี ${label} แล้ว`);
    onClose();
  }

  function handleLogoutToGuest() {
    saveActiveAccountId(GUEST_ACCOUNT_ID);
    onAuthChange(accounts, GUEST_ACCOUNT_ID, 'ออกจากระบบแล้ว — กลับมาใช้งานโหมดผู้เยี่ยมชม');
    onClose();
  }

  function handleDeleteAccount(accountId: string, uname: string) {
    const nextAccounts = deleteLocalAccount(accountId);
    const nextActiveId = activeAccountId === accountId ? GUEST_ACCOUNT_ID : activeAccountId;
    onAuthChange(nextAccounts, nextActiveId, `ลบบัญชี @${uname} ออกจากเบราว์เซอร์แล้ว`);
    setInfoMsg(`ลบบัญชี @${uname} เรียบร้อยแล้ว`);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="จัดการบัญชีผู้ใช้งาน InvestCal"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#10151E] border border-[#253042] rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1E2634] flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              {activeAccount
                ? `โปรไฟล์ผู้ใช้: ${activeAccount.displayName}`
                : 'เข้าสู่ระบบ / สมัครสมาชิก InvestCal'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              บันทึกข้อมูลพอร์ตแยกตามบัญชีในเบราว์เซอร์ (Local Multi-Profile) พร้อม Export / Import JSON
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#1A2332] transition-colors cursor-pointer"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {errorMsg && (
            <div className="rounded-lg px-3.5 py-2.5 text-xs bg-rose-500/10 border border-rose-500/35 text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div className="rounded-lg px-3.5 py-2.5 text-xs bg-emerald-500/10 border border-emerald-500/35 text-emerald-200 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{infoMsg}</span>
            </div>
          )}

          {/* Active Account Status Card */}
          {activeAccount && (
            <div className="p-4 rounded-xl bg-[#0B0F16] border border-[#1E2634] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-300 font-bold text-sm shrink-0">
                  {activeAccount.displayName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-100 truncate">
                    {activeAccount.displayName}
                  </div>
                  <div className="text-xs text-slate-400 font-mono truncate">
                    @{activeAccount.username} · {getAccountPortfolioCount(activeAccount.id)} สินทรัพย์
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogoutToGuest}
                className="px-3 py-1.5 rounded-lg bg-[#161E2B] border border-[#283549] text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/35 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>ออกจากระบบ</span>
              </button>
            </div>
          )}

          {/* Login / Register Tabs & Form */}
          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#090C11] border border-[#1E2634] rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('login');
                  setErrorMsg(null);
                }}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  authTab === 'login'
                    ? 'bg-[#1C2536] text-amber-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                เข้าสู่ระบบ
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('register');
                  setErrorMsg(null);
                }}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  authTab === 'register'
                    ? 'bg-[#1C2536] text-amber-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                สมัครสมาชิกใหม่
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {authTab === 'register' && (
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    ชื่อที่แสดง (Display Name)
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="เช่น ต้น / พอร์ตออมหุ้น"
                    className="w-full bg-[#090C11] border border-[#253042] rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  ชื่อผู้ใช้ (Username)
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="เช่น somchai_inv (ภาษาอังกฤษ/ตัวเลข)"
                    required
                    minLength={3}
                    className="w-full bg-[#090C11] border border-[#253042] rounded-lg pl-9 pr-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  รหัสผ่าน (อย่างน้อย 4 ตัวอักษร)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={4}
                    className="w-full bg-[#090C11] border border-[#253042] rounded-lg pl-9 pr-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 px-4 rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-60 font-semibold text-xs transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {authTab === 'login' ? (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>{busy ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>{busy ? 'กำลังสร้างบัญชี...' : 'สมัครสมาชิกใหม่ (พอร์ตว่าง 0 รายการ)'}</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Switch Account Section */}
          <div className="pt-4 border-t border-[#1E2634] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Users className="w-4 h-4 text-amber-400" />
                <span>สลับบัญชีผู้ใช้งานในเครื่องนี้ (Switch Account)</span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {accounts.length + 1} โปรไฟล์
              </span>
            </div>

            <div className="space-y-1.5">
              {/* Guest Profile */}
              <div
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs ${
                  activeAccountId === GUEST_ACCOUNT_ID
                    ? 'bg-amber-500/12 border-amber-500/45 text-amber-200'
                    : 'bg-[#090C11] border-[#1F293A] text-slate-300'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSwitchAccount(GUEST_ACCOUNT_ID)}
                  className="flex-1 text-left flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span className="font-medium">โหมดผู้เยี่ยมชม (Guest)</span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {getAccountPortfolioCount(GUEST_ACCOUNT_ID)} สินทรัพย์
                  </span>
                </button>
                {activeAccountId === GUEST_ACCOUNT_ID && (
                  <span className="text-[10px] font-semibold text-amber-300">กำลังใช้งาน</span>
                )}
              </div>

              {/* Registered Local Accounts */}
              {accounts.map((acc) => {
                const isActive = acc.id === activeAccountId;
                return (
                  <div
                    key={acc.id}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs ${
                      isActive
                        ? 'bg-amber-500/12 border-amber-500/45 text-amber-200'
                        : 'bg-[#090C11] border-[#1F293A] text-slate-300 hover:border-[#2E3C54]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSwitchAccount(acc.id)}
                      className="flex-1 text-left flex items-center justify-between gap-2 min-w-0 cursor-pointer"
                    >
                      <span className="truncate">
                        <strong className="font-medium">{acc.displayName}</strong>{' '}
                        <span className="font-mono text-[11px] text-slate-400">
                          (@{acc.username})
                        </span>
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 shrink-0">
                        {getAccountPortfolioCount(acc.id)} สินทรัพย์
                      </span>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isActive && (
                        <span className="text-[10px] font-semibold text-amber-300">
                          กำลังใช้งาน
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteAccount(acc.id, acc.username)}
                        title={`ลบบัญชี @${acc.username}`}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Export / Import Portfolio JSON */}
          <div className="pt-4 border-t border-[#1E2634] space-y-2.5">
            <div>
              <div className="text-xs font-semibold text-slate-200">
                ย้ายข้อมูลพอร์ตข้ามเครื่อง / มือถือ (Export &amp; Import JSON)
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                ส่งออกไฟล์พอร์ตของบัญชีปัจจุบันเพื่อนำไปเปิดใช้งานต่อบนมือถือหรือคอมพิวเตอร์เครื่องอื่นได้ทันที
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onExportJson}
                className="py-2 px-3 rounded-lg bg-[#161E2B] border border-[#253042] hover:border-amber-500/50 text-xs font-medium text-slate-200 inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>ส่งออกพอร์ต (Export JSON)</span>
              </button>
              <label className="py-2 px-3 rounded-lg bg-[#161E2B] border border-[#253042] hover:border-sky-500/50 text-xs font-medium text-slate-200 inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-sky-400" />
                <span>นำเข้าพอร์ต (Import JSON)</span>
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onImportJsonFile(file);
                      e.target.value = '';
                      setInfoMsg('นำเข้าข้อมูลพอร์ตจากไฟล์ JSON เรียบร้อยแล้ว');
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
