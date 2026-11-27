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
    // Tick every 1s during active 60s 429 cooldown or when RPM > 0; otherwise refresh every 30s
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
      text: 'text-rose-400',
      border: 'border-rose-500/35',
      bg: 'bg-rose-500/10',
      label: 'เต็มชั่วคราว',
    };
  }
  if (tone === 'warning') {
    return {
      bar: 'bg-amber-400',
      text: 'text-amber-300',
      border: 'border-amber-500/35',
      bg: 'bg-amber-500/10',
      label: 'ใกล้เต็ม',
    };
  }
  return {
    bar: 'bg-emerald-500',
    text: 'text-emerald-400',
    border: 'border-[#253042]',
    bg: 'bg-[#121926]',
    label: 'ปกติ',
  };
}

/**
 * Compact API Quota Progress Bar for the sticky top Header.
 * Always visible across all accounts on desktop/tablet without crowding controls.
 */
export function HeaderQuotaGauge({ quota }: { quota: QuotaSnapshot }) {
  const tone = getToneClasses(quota.tone);

  return (
    <div
      className={`hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-lg border ${tone.border} ${tone.bg} whitespace-nowrap shrink-0`}
      title={`โควตา AI วันนี้: ${quota.dailyUsed}/${quota.dailyLimit} ครั้ง (${quota.dailyPercent}%) · รายนาที: ${quota.minuteUsed}/${quota.minuteLimit} · ${quota.resetCountdownLabel}`}
    >
      <div className="flex flex-col gap-1 min-w-[118px]">
        <div className="flex items-center justify-between gap-2 text-[11px] leading-none">
          <span className="text-slate-300 font-medium">โควตา AI วันนี้</span>
          <span className={`font-mono tabular-nums font-semibold ${tone.text}`}>
            {quota.dailyUsed}/{quota.dailyLimit} ({quota.dailyPercent}%)
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[#1C2536] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-200 ${tone.bar}`}
            style={{ width: `${Math.max(quota.dailyPercent, quota.dailyUsed > 0 ? 3 : 0)}%` }}
          />
        </div>
      </div>

      {quota.isCoolingDown ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums font-semibold text-rose-300">
          <Clock className="w-3 h-3 shrink-0" />
          <span>รอ {quota.cooldownSecondsLeft}s</span>
        </span>
      ) : quota.dailyExhausted ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-300">
          <ShieldAlert className="w-3 h-3 shrink-0" />
          <span>เต็มรายวัน</span>
        </span>
      ) : quota.lastSourceMode === 'cache' ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-300">
          <Zap className="w-3 h-3 shrink-0" />
          <span>ใช้ Cache</span>
        </span>
      ) : (
        <span className={`text-[11px] font-medium ${tone.text}`}>{tone.label}</span>
      )}
    </div>
  );
}

/**
 * Detailed API Quota Panel for the Left Sidebar (RPM + RPD + Pacific Reset + Mode).
 */
export function SidebarQuotaCard({ quota }: { quota: QuotaSnapshot }) {
  const tone = getToneClasses(quota.tone);

  return (
    <div
      className={`p-3 rounded-lg border ${
        quota.tone === 'danger'
          ? 'bg-rose-500/[0.08] border-rose-500/35'
          : quota.tone === 'warning'
          ? 'bg-amber-500/[0.07] border-amber-500/35'
          : 'bg-[#101621] border-[#1F293A]'
      } space-y-2`}
    >
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-semibold text-slate-200">โควตา AI วันนี้</span>
        <span className={`font-mono tabular-nums font-semibold ${tone.text}`}>
          {quota.dailyUsed} / {quota.dailyLimit} ({quota.dailyPercent}%)
        </span>
      </div>

      <div className="h-1.5 w-full rounded-full bg-[#1C2536] overflow-hidden">
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

      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-[#1B2331] text-[10px]">
        <span className="inline-flex items-center gap-1 text-slate-300">
          <KeyRound className="w-3 h-3 text-amber-400 shrink-0" />
          <span>คีย์กลางระบบ</span>
        </span>
        {quota.lastSourceMode === 'cache' ? (
          <span className="inline-flex items-center gap-1 text-sky-300 font-medium">
            <Zap className="w-3 h-3 shrink-0" />
            <span>โหมดประหยัด (Cache)</span>
          </span>
        ) : (
          <span className="text-emerald-400 font-medium">อัปเดตสด</span>
        )}
      </div>

      <div className="text-[10px] text-slate-500 leading-snug">
        {quota.resetCountdownLabel}
      </div>

      {quota.isCoolingDown && (
        <div className="px-2 py-1.5 rounded bg-rose-500/15 border border-rose-500/35 text-[11px] text-rose-200 flex items-center justify-between gap-1.5">
          <span>ติดลิมิตต่อนาที (429)</span>
          <span className="font-mono tabular-nums font-bold">
            {quota.cooldownSecondsLeft}s
          </span>
        </div>
      )}

      {quota.dailyExhausted && !quota.isCoolingDown && (
        <div className="px-2 py-1.5 rounded bg-rose-500/15 border border-rose-500/35 text-[10px] text-rose-200 leading-relaxed">
          โควตา AI รายวันเต็มชั่วคราว — ข่าว RSS ราคาสด และกราฟเทคนิคยังคงใช้งานได้ฟรี 100%
        </div>
      )}
    </div>
  );
}
