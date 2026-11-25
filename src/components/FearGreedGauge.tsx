import React from 'react';
import { FearGreedData } from '../types';
import { getFearGreedLabelTh } from '../utils/portfolioMatcher';

export function FearGreedGauge({ data }: { data: FearGreedData }) {
  const clamped = Math.min(100, Math.max(0, data.value));
  const labelTh = data.labelTh || getFearGreedLabelTh(clamped);

  // Angle from -90 deg (left, value=0) to +90 deg (right, value=100)
  const angleDeg = -90 + (clamped / 100) * 180;
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  const cx = 110;
  const cy = 104;
  const needleLen = 68;
  const tipX = cx + needleLen * Math.cos(angleRad);
  const tipY = cy + needleLen * Math.sin(angleRad);

  const scoreColor =
    clamped <= 24
      ? 'text-rose-500'
      : clamped <= 44
      ? 'text-orange-400'
      : clamped <= 55
      ? 'text-slate-300'
      : clamped <= 74
      ? 'text-emerald-400'
      : 'text-emerald-300';

  const delta = clamped - data.previousClose;

  return (
    <section className="bg-[#10151E] border border-[#1E2634] rounded-xl p-5 flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            ดัชนีความกลัวและความโลภ
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Fear &amp; Greed Index · {data.updatedLabel}
          </p>
        </div>
        <span
          className={`font-mono tabular-nums text-xs font-medium ${
            delta > 0
              ? 'text-emerald-400'
              : delta < 0
              ? 'text-rose-400'
              : 'text-slate-400'
          }`}
        >
          {delta > 0 ? `+${delta}` : delta} จากเมื่อวาน
        </span>
      </div>

      {/* Semicircular SVG Gauge */}
      <div className="flex flex-col items-center my-4">
        <svg
          viewBox="0 0 220 124"
          className="w-full max-w-[230px] overflow-visible"
          role="img"
          aria-label={`ดัชนีความกลัวและความโลภอยู่ที่ ${clamped} คะแนน (${labelTh})`}
        >
          {/* 5 zone arcs along radius 82 centered at (110, 104) */}
          {/* Extreme Fear: 0..25 */}
          <path
            d="M 28 104 A 82 82 0 0 1 52.0 46.0"
            fill="none"
            stroke="#EF4444"
            strokeWidth="12"
            strokeLinecap="butt"
            opacity="0.85"
          />
          {/* Fear: 25..45 */}
          <path
            d="M 54.5 43.7 A 82 82 0 0 1 97.2 23.0"
            fill="none"
            stroke="#F97316"
            strokeWidth="12"
            strokeLinecap="butt"
            opacity="0.85"
          />
          {/* Neutral: 45..55 */}
          <path
            d="M 100.5 22.5 A 82 82 0 0 1 119.5 22.5"
            fill="none"
            stroke="#64748B"
            strokeWidth="12"
            strokeLinecap="butt"
            opacity="0.85"
          />
          {/* Greed: 55..75 */}
          <path
            d="M 122.8 23.0 A 82 82 0 0 1 165.5 43.7"
            fill="none"
            stroke="#10B981"
            strokeWidth="12"
            strokeLinecap="butt"
            opacity="0.85"
          />
          {/* Extreme Greed: 75..100 */}
          <path
            d="M 168.0 46.0 A 82 82 0 0 1 192 104"
            fill="none"
            stroke="#34D399"
            strokeWidth="12"
            strokeLinecap="butt"
            opacity="0.9"
          />

          {/* Scale labels */}
          <text x="18" y="118" className="fill-slate-500 text-[10px] font-mono">
            0
          </text>
          <text x="103" y="13" className="fill-slate-500 text-[10px] font-mono">
            50
          </text>
          <text x="190" y="118" className="fill-slate-500 text-[10px] font-mono">
            100
          </text>

          {/* Needle */}
          <line
            x1={cx}
            y1={cy}
            x2={tipX}
            y2={tipY}
            stroke="#F8FAFC"
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{ transition: 'all 400ms cubic-bezier(0.16, 1, 0.3, 1)' }}
          />
          <circle cx={cx} cy={cy} r="5.5" fill="#F8FAFC" />
          <circle cx={cx} cy={cy} r="2.5" fill="#10151E" />
        </svg>

        <div className="text-center -mt-2">
          <div className={`text-3xl font-bold font-mono tabular-nums ${scoreColor}`}>
            {clamped}
          </div>
          <div className="text-sm font-medium text-slate-200 mt-0.5">
            {labelTh}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed border-t border-[#1E2634] pt-3 mb-3">
        {data.marketNote}
      </p>

      {/* Historical comparison */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#1E2634] text-center">
        <div>
          <div className="text-[11px] text-slate-500">เมื่อวาน</div>
          <div className="font-mono tabular-nums text-sm font-semibold text-slate-200 mt-0.5">
            {data.previousClose}
          </div>
        </div>
        <div className="border-x border-[#1E2634]">
          <div className="text-[11px] text-slate-500">1 สัปดาห์ก่อน</div>
          <div className="font-mono tabular-nums text-sm font-semibold text-slate-200 mt-0.5">
            {data.oneWeekAgo}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500">1 เดือนก่อน</div>
          <div className="font-mono tabular-nums text-sm font-semibold text-slate-200 mt-0.5">
            {data.oneMonthAgo}
          </div>
        </div>
      </div>
    </section>
  );
}
