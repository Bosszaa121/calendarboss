import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="bg-amber-500/15 border-b border-amber-500/35 px-4 py-2 text-xs text-amber-200 flex items-center justify-center gap-2"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>
        ขณะนี้อุปกรณ์อยู่ในโหมดออฟไลน์ — แสดงข้อมูลพอร์ตและปฏิทินล่าสุดที่บันทึกไว้ในเครื่อง
      </span>
    </div>
  );
}
