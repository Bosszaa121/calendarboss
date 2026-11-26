import React, { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton({ compact = false }: { compact?: boolean }) {
  const { canNativeInstall, isIOS, isInstalled, triggerInstall } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  if (isInstalled) return null;

  async function handleClick() {
    if (canNativeInstall) {
      await triggerInstall();
    } else {
      setGuideOpen(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        title="ติดตั้ง InvestCal ลงหน้าจอโฮม (PWA)"
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#253042] bg-[#121926] text-slate-200 hover:border-amber-500/50 hover:text-amber-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          compact ? 'px-2.5 py-2 text-xs font-medium' : 'w-full px-3 py-2 text-xs font-medium'
        }`}
      >
        {canNativeInstall ? (
          <Download className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        ) : (
          <Smartphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        )}
        <span className={compact ? 'hidden xl:inline' : ''}>ติดตั้งแอป</span>
      </button>

      {guideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="วิธีติดตั้งแอป InvestCal ลงมือถือหรือคอมพิวเตอร์"
          onClick={() => setGuideOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[#10151E] border border-[#253042] rounded-xl shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  ติดตั้ง InvestCal เป็นแอป (PWA)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  เปิดใช้งานเต็มหน้าจอและรับการแจ้งเตือนผ่านมือถือหรือคอมพิวเตอร์
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#1A2332] cursor-pointer"
                aria-label="ปิด"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-2.5 text-xs text-slate-300 leading-relaxed bg-[#0B0F16] border border-[#1E2634] rounded-lg p-3.5">
                <li className="flex items-start gap-2">
                  <span className="font-mono text-amber-400 font-semibold">1.</span>
                  <span>
                    แตะปุ่ม <Share className="w-3.5 h-3.5 inline text-sky-400 mx-0.5" />{' '}
                    <strong>แชร์ (Share)</strong> ที่แถบด้านล่างของ Safari
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono text-amber-400 font-semibold">2.</span>
                  <span>
                    เลื่อนลงแล้วเลือก <strong>&quot;เพิ่มไปยังหน้าจอโฮม&quot; (Add to Home Screen)</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono text-amber-400 font-semibold">3.</span>
                  <span>แตะ &quot;เพิ่ม&quot; เพื่อใช้งาน InvestCal เสมือนแอปมือถือจริง</span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-2.5 text-xs text-slate-300 leading-relaxed bg-[#0B0F16] border border-[#1E2634] rounded-lg p-3.5">
                <li className="flex items-start gap-2">
                  <span className="font-mono text-amber-400 font-semibold">1.</span>
                  <span>
                    บน <strong>Chrome Android</strong>: แตะเมนูจุด 3 จุด (⋮) มุมขวาบน แล้วเลือก{' '}
                    <strong>&quot;ติดตั้งแอป&quot;</strong> หรือ <strong>&quot;เพิ่มลงหน้าจอหลัก&quot;</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono text-amber-400 font-semibold">2.</span>
                  <span>
                    บน <strong>Chrome คอมพิวเตอร์</strong>: คลิกไอคอนติดตั้งที่ด้านขวาของแถบ URL เพื่อปักหมุดเป็นแอปเดสก์ท็อป
                  </span>
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setGuideOpen(false)}
              className="w-full py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-colors cursor-pointer"
            >
              เข้าใจแล้ว
            </button>
          </div>
        </div>
      )}
    </>
  );
}
