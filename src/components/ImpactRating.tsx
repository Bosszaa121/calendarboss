import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ImpactLevel, Sentiment } from '../types';

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
  onClick,
}: {
  symbol: string;
  matched: boolean;
  onClick?: () => void;
}) {
  const baseClass =
    'inline-flex items-center font-mono text-[11px] font-medium px-2 py-0.5 rounded transition-all whitespace-nowrap shrink-0';

  const styleClass = matched
    ? 'bg-amber-500/20 text-amber-200 ticker-glow font-semibold'
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
        {symbol}
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

export function PortfolioMatchBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/40 px-2 py-0.5 rounded whitespace-nowrap shrink-0">
      กระทบพอร์ต
    </span>
  );
}
