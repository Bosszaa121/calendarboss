import React, { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BellRing,
  CheckCheck,
  Coins,
  Send,
  ShieldAlert,
  X,
} from 'lucide-react';
import { AlertCategory, AppAlert, NavTab, NewsSubTab } from '../types';
import { BrowserNotificationPermission } from '../utils/alertEngine';

interface NotificationCenterProps {
  alerts: AppAlert[];
  readAlertIds: Set<string>;
  permission: BrowserNotificationPermission;
  onRequestChromePermission: () => Promise<void>;
  onSendTestNotification: () => Promise<void>;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onSelectAlert: (tab: NavTab, newsSubTab?: NewsSubTab) => void;
}

const CATEGORY_META: Record<
  AlertCategory,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    chipCls: string;
    borderCls: string;
  }
> = {
  risk_warning: {
    label: 'คำเตือนความเสี่ยง',
    icon: ShieldAlert,
    chipCls: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    borderCls: 'border-l-rose-500',
  },
  macro_news: {
    label: 'ข่าวสำคัญกระทบพอร์ต',
    icon: AlertTriangle,
    chipCls: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    borderCls: 'border-l-amber-400',
  },
  earnings: {
    label: 'ใกล้ประกาศงบ (1–3 วัน)',
    icon: BarChart3,
    chipCls: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
    borderCls: 'border-l-sky-400',
  },
  xd: {
    label: 'ใกล้ขึ้น XD (1–7 วัน)',
    icon: Coins,
    chipCls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    borderCls: 'border-l-emerald-400',
  },
};

export function NotificationCenter({
  alerts,
  readAlertIds,
  permission,
  onRequestChromePermission,
  onSendTestNotification,
  onMarkRead,
  onMarkAllRead,
  onSelectAlert,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [filterCat, setFilterCat] = useState<'ALL' | AlertCategory>('ALL');
  const [testFeedback, setTestFeedback] = useState<string | null>(null);

  const unreadCount = alerts.filter((a) => !readAlertIds.has(a.id)).length;
  const visibleAlerts =
    filterCat === 'ALL' ? alerts : alerts.filter((a) => a.category === filterCat);

  async function handleEnableChrome() {
    await onRequestChromePermission();
  }

  async function handleTest() {
    setTestFeedback(null);
    await onSendTestNotification();
    setTestFeedback(
      permission === 'granted'
        ? 'ส่งการแจ้งเตือนทดสอบไปยัง Chrome แล้ว'
        : 'แสดงการแจ้งเตือนทดสอบในแอปแล้ว (เปิดสิทธิ์ Chrome เพื่อรับแจ้งเตือนนอกหน้าเว็บ)'
    );
    window.setTimeout(() => setTestFeedback(null), 4000);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`ศูนย์แจ้งเตือนและคำเตือนความเสี่ยง (${unreadCount} รายการยังไม่อ่าน)`}
        className="relative p-2 rounded-lg bg-[#121926] border border-[#253042] text-slate-200 hover:border-amber-500/50 hover:text-amber-200 transition-colors cursor-pointer shrink-0"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-4 h-4 text-amber-400" />
        ) : (
          <Bell className="w-4 h-4 text-slate-400" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white font-mono text-[10px] font-bold flex items-center justify-center shadow">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="ศูนย์แจ้งเตือนการลงทุนและคำเตือนความเสี่ยง"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[#0E131B] border-l border-[#232D3F] h-full flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#1E2634] flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-amber-400" />
                  <span>ศูนย์แจ้งเตือน InvestCal</span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  ตรวจจับข่าวสำคัญ · งบ 1–3 วัน · วัน XD 1–7 วัน · คำเตือนความเสี่ยง
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#1A2332] cursor-pointer"
                aria-label="ปิดศูนย์แจ้งเตือน"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chrome Notification Controls */}
            <div className="px-5 py-3.5 bg-[#121824] border-b border-[#1E2634] space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-300 font-medium">การแจ้งเตือนผ่าน Chrome</span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                    permission === 'granted'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                      : permission === 'denied'
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                  }`}
                >
                  {permission === 'granted'
                    ? 'เปิดใช้งานแล้ว'
                    : permission === 'denied'
                    ? 'ถูกบล็อกในเบราว์เซอร์'
                    : permission === 'unsupported'
                    ? 'แจ้งเตือนในแอป'
                    : 'ยังไม่เปิดสิทธิ์'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void handleEnableChrome()}
                  disabled={permission === 'granted' || permission === 'unsupported'}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-55 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <BellRing className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {permission === 'granted'
                      ? 'เปิด Chrome แล้ว'
                      : 'เปิดรับแจ้งเตือน Chrome'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleTest()}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-[#182130] border border-[#2B374D] text-slate-200 hover:border-amber-500/50 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="truncate">ทดสอบการแจ้งเตือน</span>
                </button>
              </div>

              {permission === 'denied' && (
                <p className="text-[11px] text-rose-300 leading-relaxed">
                  เบราว์เซอร์บล็อกสิทธิ์แจ้งเตือนไว้ กรุณากดไอคอนแม่กุญแจข้างแถบ URL ของ Chrome แล้วอนุญาต Notifications
                </p>
              )}
              {testFeedback && (
                <p className="text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-2.5 py-1.5">
                  {testFeedback}
                </p>
              )}
            </div>

            {/* Category Filter Chips + Mark All Read */}
            <div className="px-5 py-3 border-b border-[#1E2634] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 overflow-x-auto">
                {(
                  [
                    { key: 'ALL', label: `ทั้งหมด (${alerts.length})` },
                    { key: 'risk_warning', label: 'ความเสี่ยง' },
                    { key: 'macro_news', label: 'ข่าวสำคัญ' },
                    { key: 'earnings', label: 'งบ' },
                    { key: 'xd', label: 'วัน XD' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setFilterCat(opt.key)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      filterCat === opt.key
                        ? 'bg-[#1D2738] text-amber-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="text-[11px] text-slate-400 hover:text-amber-300 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>อ่านทั้งหมด</span>
                </button>
              )}
            </div>

            {/* Alert List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#1A2230]">
              {visibleAlerts.length === 0 ? (
                <div className="py-12 px-6 text-center space-y-2">
                  <p className="text-sm text-slate-300 font-medium">
                    ไม่มีรายการแจ้งเตือนในหมวดนี้
                  </p>
                  <p className="text-xs text-slate-500">
                    เพิ่มสินทรัพย์ในพอร์ตหรือกด &quot;อัปเดตข้อมูลล่าสุด&quot; เพื่อให้ระบบตรวจสอบข่าวสำคัญ งบการเงิน วัน XD และความเสี่ยงอัตโนมัติ
                  </p>
                </div>
              ) : (
                visibleAlerts.map((alert) => {
                  const meta = CATEGORY_META[alert.category];
                  const Icon = meta.icon;
                  const isUnread = !readAlertIds.has(alert.id);
                  return (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => {
                        onMarkRead(alert.id);
                        onSelectAlert(alert.targetTab, alert.targetNewsSubTab);
                        setOpen(false);
                      }}
                      className={`w-full text-left px-5 py-3.5 border-l-4 transition-colors cursor-pointer ${
                        meta.borderCls
                      } ${
                        isUnread
                          ? 'bg-[#141B27] hover:bg-[#192233]'
                          : 'bg-[#0E131B] hover:bg-[#131A25] opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border ${meta.chipCls}`}
                        >
                          <Icon className="w-3 h-3" />
                          <span>{alert.badgeLabel}</span>
                        </span>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                        )}
                      </div>
                      <div className="text-xs font-semibold text-slate-100 leading-snug">
                        {alert.title}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        {alert.body}
                      </p>
                      {alert.symbols.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {alert.symbols.map((sym) => (
                            <span
                              key={sym}
                              className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#0B0F16] border border-[#253042] text-amber-300"
                            >
                              {sym}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
