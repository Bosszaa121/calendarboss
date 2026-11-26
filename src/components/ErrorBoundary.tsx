import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'เกิดข้อผิดพลาดที่ไม่คาดคิด',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('InvestCal ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#090C11] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#10151E] border border-rose-500/35 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-slate-100">
                  เกิดข้อผิดพลาดในการแสดงผล
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  กรุณารีโหลดหน้าเว็บเพื่อกลับมาใช้งานตามปกติ
                </p>
              </div>
            </div>
            <p className="text-xs text-rose-300 bg-[#090C11] border border-[#1E2634] rounded-lg p-3 font-mono break-words">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>รีโหลดแอปพลิเคชัน</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
