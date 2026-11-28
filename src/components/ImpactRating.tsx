import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  AssetDirection,
  AssetDirectionForecast,
  ImpactLevel,
  MacroImpactItem,
  PortfolioImpactDetail,
  Sentiment,
} from '../types';

function BullIcon({ active, colorClass }: { active: boolean; colorClass: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`w-3.5 h-3.5 shrink-0 ${active ? colorClass : 'text-slate-700'}`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M4.5 5.2c-.6 1.5-.3 3.4.8 4.6l1.2 1.3c-.2.7-.3 1.5-.2 2.3.2 1.8 1.4 3.5 3 4.3l.9.4c.5.3 1.1.4 1.8.4s1.3-.1 1.8-.4l.9-.4c1.6-.8 2.8-2.5 3-4.3.1-.8 0-1.6-.2-2.3l1.2-1.3c1.1-1.2 1.4-3.1.8-4.6-.2-.4-.7-.5-1-.2-.9.8-1.8 1.8-2.1 2.9-.8-.3-1.7-.5-2.6-.5h-3.6c-.9 0-1.8.2-2.6.5-.3-1.1-1.2-2.1-2.1-2.9-.3-.3-.8-.2-1 .2z" />
    </svg>
  );
}

export function ImpactRating({
  level,
  showLabel = true,
}: {
  level: ImpactLevel;
  showLabel?: boolean;
}) {
  const config =
    level === 3
      ? { color: 'text-rose-500', text: 'สูง', textClass: 'text-rose-400' }
      : level === 2
      ? { color: 'text-amber-500', text: 'กลาง', textClass: 'text-amber-400' }
      : { color: 'text-slate-400', text: 'ต่ำ', textClass: 'text-slate-400' };

  return (
    <div
      className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
      title={`ระดับความสำคัญ: ${config.text} (${level}/3)`}
    >
      <div className="inline-flex items-center gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <BullIcon key={i} active={i <= level} colorClass={config.color} />
        ))}
      </div>
      {showLabel && (
        <span className={`text-[11px] font-medium ${config.textClass}`}>
          {config.text}
        </span>
      )}
    </div>
  );
}

export function AssetTickerTag({
  symbol,
  matched,
  relation,
  onClick,
}: {
  symbol: string;
  matched: boolean;
  relation?: 'direct' | 'indirect';
  onClick?: () => void;
}) {
  const baseClass =
    'inline-flex items-center gap-1 font-mono text-[11px] font-medium px-2 py-0.5 rounded transition-all whitespace-nowrap shrink-0';

  const styleClass = matched
    ? relation === 'indirect'
      ? 'bg-sky-500/15 text-sky-200 border border-sky-400/50 font-semibold'
      : 'bg-amber-500/20 text-amber-200 ticker-glow font-semibold'
    : 'bg-[#161E2B] text-slate-300 border border-slate-800 hover:border-slate-700';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={`${baseClass} ${styleClass} cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400`}
        title={matched ? `${symbol} อยู่ในพอร์ตโฟลิโอของคุณ` : `ดูข้อมูล ${symbol}`}
      >
        <span>{symbol}</span>
      </button>
    );
  }

  return (
    <span
      className={`${baseClass} ${styleClass}`}
      title={matched ? `${symbol} อยู่ในพอร์ตโฟลิโอของคุณ` : symbol}
    >
      {symbol}
    </span>
  );
}

export function SentimentIndicator({ sentiment }: { sentiment: Sentiment }) {
  if (sentiment === 'bullish') {
    return (
      <div className="inline-flex items-center gap-1.5 text-emerald-400 font-medium text-xs whitespace-nowrap shrink-0">
        <TrendingUp className="w-3.5 h-3.5 shrink-0" />
        <span>Bullish</span>
        <span className="text-emerald-500/60" aria-hidden="true">·</span>
        <span className="text-emerald-300/90 font-normal">เชิงบวก</span>
      </div>
    );
  }

  if (sentiment === 'bearish') {
    return (
      <div className="inline-flex items-center gap-1.5 text-rose-400 font-medium text-xs whitespace-nowrap shrink-0">
        <TrendingDown className="w-3.5 h-3.5 shrink-0" />
        <span>Bearish</span>
        <span className="text-rose-500/60" aria-hidden="true">·</span>
        <span className="text-rose-300/90 font-normal">เชิงลบ</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 text-slate-400 font-medium text-xs whitespace-nowrap shrink-0">
      <Minus className="w-3.5 h-3.5 shrink-0" />
      <span>Neutral</span>
      <span className="text-slate-600" aria-hidden="true">·</span>
      <span className="text-slate-400 font-normal">เป็นกลาง</span>
    </div>
  );
}

export function PortfolioMatchBadge({
  directCount,
  indirectCount,
}: {
  directCount?: number;
  indirectCount?: number;
}) {
  const hasDirect = (directCount ?? 1) > 0;
  const hasIndirect = (indirectCount ?? 0) > 0;

  if (hasDirect && hasIndirect) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/40 px-2 py-0.5 rounded whitespace-nowrap shrink-0">
        กระทบพอร์ต (ทางตรง {directCount} · ทางอ้อม {indirectCount})
      </span>
    );
  }

  if (!hasDirect && hasIndirect) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300 bg-sky-500/15 border border-sky-500/40 px-2 py-0.5 rounded whitespace-nowrap shrink-0">
        กระทบทางอ้อม ({indirectCount})
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/40 px-2 py-0.5 rounded whitespace-nowrap shrink-0">
      กระทบพอร์ต{directCount ? ` (${directCount})` : ''}
    </span>
  );
}

const SEVERITY_LABEL_TH = {
  high: { text: 'ผลกระทบมาก', cls: 'text-rose-400' },
  medium: { text: 'ปานกลาง', cls: 'text-amber-300' },
  low: { text: 'น้อย', cls: 'text-slate-400' },
} as const;

export function PortfolioImpactMatrix({
  impacts,
  compact = false,
  onTickerClick,
}: {
  impacts: PortfolioImpactDetail[];
  compact?: boolean;
  onTickerClick?: (symbol: string) => void;
}) {
  if (impacts.length === 0) return null;

  const shown = compact ? impacts.slice(0, 3) : impacts;

  return (
    <div className="mt-2.5 pt-2.5 border-t border-[#1E2634]/80 space-y-1.5">
      {shown.map((imp) => {
        const sev = SEVERITY_LABEL_TH[imp.severity];
        return (
          <div
            key={`${imp.symbol}-${imp.relation}`}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs leading-relaxed"
          >
            <AssetTickerTag
              symbol={imp.symbol}
              matched
              relation={imp.relation}
              onClick={onTickerClick ? () => onTickerClick(imp.symbol) : undefined}
            />
            <span
              className={`text-[11px] font-medium whitespace-nowrap ${
                imp.relation === 'direct' ? 'text-amber-300' : 'text-sky-300'
              }`}
            >
              {imp.relation === 'direct' ? 'ทางตรง' : 'ทางอ้อม'}
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className={`text-[11px] font-semibold whitespace-nowrap ${sev.cls}`}>
              {sev.text}
            </span>
            <span className="text-slate-600" aria-hidden="true">—</span>
            <span className="text-slate-300">{imp.reasonTh}</span>
          </div>
        );
      })}
      {compact && impacts.length > shown.length && (
        <div className="text-[11px] text-slate-400">
          และอีก {impacts.length - shown.length} สินทรัพย์ในพอร์ตที่เชื่อมโยง
        </div>
      )}
    </div>
  );
}

const DIRECTION_STYLE: Record<
  AssetDirection,
  { dot: string; label: string; chipCls: string }
> = {
  bullish: {
    dot: 'bg-emerald-400',
    label: 'ขึ้น',
    chipCls: 'bg-emerald-500/12 border-emerald-500/40 text-emerald-200',
  },
  bearish: {
    dot: 'bg-rose-400',
    label: 'ลง',
    chipCls: 'bg-rose-500/12 border-rose-500/40 text-rose-200',
  },
  neutral: {
    dot: 'bg-slate-400',
    label: 'คงที่',
    chipCls: 'bg-slate-700/30 border-slate-600/50 text-slate-200',
  },
};

export function AssetDirectionChip({
  forecast,
  onClick,
}: {
  forecast: AssetDirectionForecast;
  onClick?: () => void;
}) {
  const cfg = DIRECTION_STYLE[forecast.direction];
  const heldRing = forecast.isPortfolioHeld ? 'ring-1 ring-amber-400/60' : '';

  const content = (
    <>
      <span className="font-mono font-semibold">{forecast.symbol}</span>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} aria-hidden="true" />
      <span className="font-medium">{cfg.label}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        title={`${forecast.symbol}: คาดการณ์${cfg.label} — ${forecast.reasonTh}`}
        className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${cfg.chipCls} ${heldRing}`}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      title={`${forecast.symbol}: คาดการณ์${cfg.label} — ${forecast.reasonTh}`}
      className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded border whitespace-nowrap shrink-0 ${cfg.chipCls} ${heldRing}`}
    >
      {content}
    </span>
  );
}

export function AssetDirectionForecastList({
  forecasts,
  isReleased,
  compact = false,
  onTickerClick,
}: {
  forecasts: AssetDirectionForecast[];
  isReleased: boolean;
  compact?: boolean;
  onTickerClick?: (symbol: string) => void;
}) {
  if (forecasts.length === 0) return null;

  const shown = compact ? forecasts.slice(0, 4) : forecasts.slice(0, 6);
  const lead = shown[0];

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {shown.map((fc) => (
          <AssetDirectionChip
            key={fc.symbol}
            forecast={fc}
            onClick={onTickerClick ? () => onTickerClick(fc.symbol) : undefined}
          />
        ))}
      </div>
      {!compact && lead && (
        <div className="text-[11px] text-slate-400 leading-relaxed">
          <span className="text-slate-300 font-medium">
            {isReleased ? 'ผลเทียบคาดการณ์:' : 'แนวโน้มคาดการณ์:'}
          </span>{' '}
          {lead.reasonTh}
          {!isReleased && lead.scenarioNoteTh && (
            <span className="text-amber-300/90 ml-1">({lead.scenarioNoteTh})</span>
          )}
        </div>
      )}
    </div>
  );
}

export function MacroImpactMatrix({
  impacts,
}: {
  impacts?: MacroImpactItem[];
}) {
  if (!impacts || impacts.length === 0) return null;

  return (
    <div className="rounded-xl bg-[#090C11] border border-[#1B2331] p-3 space-y-2">
      <div className="text-[11px] font-semibold text-slate-300">
        ผลกระทบมหภาค (ค่าเงิน · โลหะมีค่า · คริปโต · ดัชนี)
      </div>
      <div className="space-y-1.5">
        {impacts.slice(0, 6).map((item, idx) => {
          const cfg = DIRECTION_STYLE[item.direction] || DIRECTION_STYLE.neutral;
          return (
            <div
              key={`${item.asset}-${idx}`}
              className="flex items-start justify-between gap-2 text-xs leading-snug"
            >
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-mono text-[11px] font-semibold text-slate-200 px-1.5 py-0.5 rounded bg-[#141B26] border border-[#222D40]">
                  {item.asset}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.chipCls}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />
                  <span>{cfg.label}</span>
                </span>
              </div>
              <span className="text-[11px] text-slate-300 text-right leading-relaxed">
                {item.noteTh}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


