import React from 'react';
import { Loader2 } from 'lucide-react';

export function LiveSearchingBanner({ message }: { message: string }) {
  return (
    <div className="bg-amber-500/[0.08] border border-amber-500/30 rounded-xl px-4 py-3 flex items-center gap-3 text-xs text-amber-200">
      <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
      <span className="leading-snug">{message}</span>
    </div>
  );
}

export function FearGreedSkeleton() {
  return (
    <section className="bg-[#10151E] border border-[#1E2634] rounded-xl p-5 flex flex-col justify-between animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-4 w-44 rounded bg-[#1B2433]" />
          <div className="h-3 w-36 rounded bg-[#151D2B]" />
        </div>
        <div className="h-4 w-20 rounded bg-[#1B2433]" />
      </div>

      <div className="flex flex-col items-center my-6 space-y-3">
        <div className="w-48 h-24 rounded-t-full border-[12px] border-b-0 border-[#1C2636]" />
        <div className="h-8 w-14 rounded bg-[#1B2433]" />
        <div className="h-3.5 w-24 rounded bg-[#151D2B]" />
      </div>

      <div className="border-t border-[#1E2634] pt-3 mb-3 space-y-2">
        <div className="h-3 w-full rounded bg-[#151D2B]" />
        <div className="h-3 w-3/4 rounded bg-[#151D2B]" />
      </div>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#1E2634]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div className="h-2.5 w-14 rounded bg-[#151D2B]" />
            <div className="h-4 w-8 rounded bg-[#1B2433]" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function CalendarRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-[#1A2230] animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-4 w-16 rounded bg-[#1B2433]" />
            <div className="h-5 w-12 rounded bg-[#151D2B]" />
            <div className="h-4 w-14 rounded bg-[#151D2B]" />
          </div>
          <div className="flex-1 space-y-2 min-w-0">
            <div className="h-4 w-3/4 rounded bg-[#1B2433]" />
            <div className="flex items-center gap-2">
              <div className="h-5 w-24 rounded bg-[#151D2B]" />
              <div className="h-5 w-20 rounded bg-[#151D2B]" />
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="h-4 w-12 rounded bg-[#151D2B]" />
            <div className="h-4 w-12 rounded bg-[#151D2B]" />
            <div className="h-4 w-12 rounded bg-[#151D2B]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EarningsXDSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="space-y-5 animate-pulse">
      <section className="bg-[#10151E] border border-[#1E2634] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1E2634] flex items-center justify-between">
          <div className="h-4 w-56 rounded bg-[#1B2433]" />
          <div className="h-3 w-28 rounded bg-[#151D2B]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4 sm:p-5">
          {Array.from({ length: cards }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-[#1F293A] bg-[#0D121A] p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5">
                  <div className="h-4 w-20 rounded bg-[#1B2433]" />
                  <div className="h-3 w-36 rounded bg-[#151D2B]" />
                </div>
                <div className="h-5 w-28 rounded bg-[#1B2433]" />
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#1C2534]">
                {[0, 1, 2, 3].map((j) => (
                  <div key={j} className="space-y-1">
                    <div className="h-2.5 w-16 rounded bg-[#151D2B]" />
                    <div className="h-3.5 w-20 rounded bg-[#1B2433]" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#10151E] border border-[#1E2634] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1E2634] flex items-center justify-between">
          <div className="h-4 w-64 rounded bg-[#1B2433]" />
          <div className="h-3 w-16 rounded bg-[#151D2B]" />
        </div>
        <div className="divide-y divide-[#1A2230]">
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-44 rounded bg-[#1B2433]" />
                  <div className="h-3 w-64 rounded bg-[#151D2B]" />
                </div>
                <div className="h-6 w-28 rounded bg-[#1B2433]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="h-12 rounded-lg bg-[#0B0F16] border border-[#1B2331]" />
                <div className="h-12 rounded-lg bg-[#0B0F16] border border-[#1B2331]" />
              </div>
              <div className="h-3 w-5/6 rounded bg-[#151D2B]" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function NewsCardsSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-pulse">
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className="bg-[#10151E] border border-[#1E2634] rounded-xl p-5 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="h-3.5 w-36 rounded bg-[#151D2B]" />
            <div className="h-5 w-20 rounded bg-[#1B2433]" />
          </div>
          <div className="h-4 w-11/12 rounded bg-[#1B2433]" />
          <div className="space-y-1.5">
            <div className="h-3 w-full rounded bg-[#151D2B]" />
            <div className="h-3 w-4/5 rounded bg-[#151D2B]" />
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-[#1A2230]">
            <div className="h-5 w-14 rounded bg-[#151D2B]" />
            <div className="h-5 w-14 rounded bg-[#151D2B]" />
            <div className="h-5 w-14 rounded bg-[#151D2B]" />
          </div>
        </div>
      ))}
    </div>
  );
}
