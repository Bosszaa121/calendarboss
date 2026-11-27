import React, { useEffect, useState } from 'react';
import { Clock, KeyRound, ShieldAlert, Zap } from 'lucide-react';
import { QuotaSnapshot } from '../types';
import { getQuotaSnapshot, subscribeQuotaChange } from '../utils/quotaTracker';

export function useQuotaSnapshot(): QuotaSnapshot {
  const [snapshot, setSnapshot] = useState<QuotaSnapshot>(() => getQuotaSnapshot());

  useEffect(() => {
    const unsub = subscribeQuotaChange((next) => setSnapshot(next));
    return unsub;
  }, []);

  useEffect(() => {
    const intervalMs = snapshot.isCoolingDown || snapshot.minuteUsed > 0 ? 1000 : 30_000;
    const timer = window.setInterval(() => {
      setSnapshot(getQuotaSnapshot());
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [snapshot.isCoolingDown, snapshot.minuteUsed]);

  return snapshot;
}

function getToneClasses(tone: QuotaSnapshot['tone']) {
  if (tone === 'danger') {
    return {
      bar: 'bg-rose-500',
      dot: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.75)]',
      text: 'text-rose-400',
      border: 'border-rose-500/35',
      bg: 'bg-rose-500/10',
      label: 'เต็มชั่วคราว',
    };
  }
  if (tone === 'warning') {
    return {
      bar: 'bg-amber-400',
      dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]',
      text: 'text-amber-300',
      border: 'border-amber-500/35',
      bg: 'bg-amber-500/10',
      label: 'ใกล้เต็ม',
    };
  }
  return {
    bar: 'bg-emerald-500',
    dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]',
    text: 'text-emerald-400',
    border: 'border-[#253042]',
    bg: 'bg-[#121926]',
    label: 'ปกติ',
  };
}

/**
 * Tiny status dot for the single-row Mobile Top Header (🟢/🟡/🔴).
 * Tapping opens Account / Settings modal where the full AI Quota Gauge lives.
 */
export function HeaderQuotaDot({
  quota,
  onClick,
}: {
  quota: QuotaSnapshot;
  onClick: () => void;
}) {
  const tone = getToneClasses(quota.tone);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 w-9 rounded-lg border ${tone.border} ${tone.bg} flex items-center justify-center shrink-0 cursor-pointer transition-colors hover:border-amber-500/50`}
      aria-label={`สถานะโควตา AI: ${tone.label} (${quota.dailyUsed}/${quota.dailyLimit})`}
      title={`โควตา AI วันนี้: ${quota.dailyUsed}/${quota.dailyLimit} (${quota.dailyPercent}%) · แตะเพื่อดูรายละเอียด`}
    >
      <span className={`w-2.5 h-2.5 rounded-full ${tone.dot}`} />
    </button>
  );
}

/**
 * Full Detailed API Quota Card inside Account / Settings Modal.
 */
export function SidebarQuotaCard({ quota }: { quota: QuotaSnapshot }) {
  const tone = getToneClasses(quota.tone);

  return (
    <div
      className={`p-3.5 rounded-xl border ${
        quota.tone === 'danger'
          ? 'bg-rose-500/[0.08] border-rose-500/35'
          : quota.tone === 'warning'
          ? 'bg-amber-500/[0.07] border-amber-500/35'
          : 'bg-[#090C11] border-[#1F293A]'
      } space-y-2.5`}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-200">โควตา AI วันนี้</span>
        <span className={`font-mono tabular-nums font-semibold ${tone.text}`}>
          {quota.dailyUsed} / {quota.dailyLimit} ({quota.dailyPercent}%)
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-[#1C2536] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-200 ${tone.bar}`}
          style={{ width: `${Math.max(quota.dailyPercent, quota.dailyUsed > 0 ? 3 : 0)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>สถานะ: {tone.label}</span>
        <span className="font-mono tabular-nums text-slate-300">
          RPM {quota.minuteUsed}/{quota.minuteLimit}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-[#1B2331] text-[11px]">
        <span className="inline-flex items-center gap-1 text-slate-300">
          <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>คีย์กลางระบบ (Server-side)</span>
        </span>
        {quota.lastSourceMode === 'cache' ? (
          <span className="inline-flex items-center gap-1 text-sky-300 font-medium">
            <Zap className="w-3.5 h-3.5 shrink-0" />
            <span>โหมดประหยัด (Cache)</span>
          </span>
        ) : (
          <span className="text-emerald-400 font-medium">อัปเดตสด</span>
        )}
      </div>

      <div className="text-[11px] text-slate-500 leading-snug">
        {quota.resetCountdownLabel}
      </div>

      {quota.isCoolingDown && (
        <div className="px-2.5 py-2 rounded-lg bg-rose-500/15 border border-rose-500/35 text-xs text-rose-200 flex items-center justify-between gap-1.5">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>ติดลิมิตต่อนาที (429)</span>
          </span>
          <span className="font-mono tabular-nums font-bold">
            {quota.cooldownSecondsLeft}s
          </span>
        </div>
      )}

      {quota.dailyExhausted && !quota.isCoolingDown && (
        <div className="px-2.5 py-2 rounded-lg bg-rose-500/15 border border-rose-500/35 text-[11px] text-rose-200 leading-relaxed flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            โควตา AI รายวันเต็มชั่วคราว — ข่าว RSS ราคาสด และวิเคราะห์เทรน/Fibonacci ยังใช้งานได้ฟรี 100%
          </span>
        </div>
      )}
    </div>
  );
}
