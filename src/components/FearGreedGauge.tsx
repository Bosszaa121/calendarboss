import React from 'react';
import { FearGreedData } from '../types';
import { getFearGreedLabelTh } from '../utils/portfolioMatcher';

export function FearGreedGauge({ data }: { data: FearGreedData }) {
  const clamped = Math.min(100, Math.max(0, data.value));
  const labelTh = data.labelTh || getFearGreedLabelTh(clamped);
  const delta = clamped - data.previousClose;

  const scoreTone =
    clamped <= 24
      ? { text: 'text-rose-400', bar: 'bg-rose-500', badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30' }
      : clamped <= 44
      ? { text: 'text-orange-400', bar: 'bg-orange-400', badge: 'bg-orange-500/15 text-orange-300 border-orange-500/30' }
      : clamped <= 55
      ? { text: 'text-amber-300', bar: 'bg-amber-400', badge: 'bg-amber-500/15 text-amber-200 border-amber-500/30' }
      : { text: 'text-emerald-400', bar: 'bg-emerald-400', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-200">
            ดัชนี Fear &amp; Greed
          </div>
          <div className="text-[11px] text-slate-500 truncate">{data.updatedLabel}</div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${scoreTone.badge}`}
          >
            {labelTh}
          </span>
          <span className={`font-mono tabular-nums text-xl font-bold ${scoreTone.text}`}>
            {clamped}
          </span>
        </div>
      </div>

      {/* Clean Linear Progress Bar (Zero SVG charts) */}
      <div className="space-y-1">
        <div className="h-2 w-full rounded-full bg-[#18202E] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${scoreTone.bar}`}
            style={{ width: `${Math.max(clamped, 2)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-500">
          <span>0 กลัวสุดขีด</span>
          <span
            className={
              delta > 0
                ? 'text-emerald-400'
                : delta < 0
                ? 'text-rose-400'
                : 'text-slate-400'
            }
          >
            {delta > 0 ? `+${delta}` : delta} จากเมื่อวาน ({data.previousClose})
          </span>
          <span>100 โลภสุดขีด</span>
        </div>
      </div>
    </div>
  );
}
