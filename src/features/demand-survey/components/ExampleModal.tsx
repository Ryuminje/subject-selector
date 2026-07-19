"use client";

import { CheckCircle2, X } from "lucide-react";

interface ExampleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExampleModal({ isOpen, onClose }: ExampleModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden max-w-[80vw] w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-800/50">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <span>💡</span> 올바른 엑셀 입력 양식 가이드
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* 올바른 예시 */}
          <div className="space-y-4 flex flex-col h-full">
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <h4 className="text-lg font-semibold text-emerald-400">올바른 예시 (권장)</h4>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30 flex-1 flex flex-col">
              <p className="text-slate-300 text-sm mb-4 shrink-0">
                과목명이 단일 셀에 병합 없이 온전하게 입력되어 있어야 합니다.
              </p>
              <div className="flex-1 flex items-center justify-center min-h-0 bg-slate-900 rounded border border-slate-800 p-2 overflow-hidden">
                <img src="/excel-right.png" alt="올바른 엑셀 예시" className="w-full h-auto object-contain max-h-[40vh]" />
              </div>
            </div>
          </div>

          {/* 잘못된 예시 */}
          <div className="space-y-4 flex flex-col h-full">
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center">
                <X className="w-5 h-5 text-rose-400" />
              </div>
              <h4 className="text-lg font-semibold text-rose-400">잘못된 예시</h4>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-rose-500/30 flex-1 flex flex-col">
              <p className="text-slate-300 text-sm mb-4 shrink-0">
                셀 병합(Merge)을 사용하거나 띄어쓰기 대신 줄바꿈(Alt+Enter)을 사용하면 데이터를 제대로 읽을 수 없습니다.
              </p>
              <div className="flex-1 flex items-center justify-center min-h-0 bg-slate-900 rounded border border-slate-800 p-2 overflow-hidden">
                <img src="/excel-wrong.png" alt="잘못된 엑셀 예시" className="w-full h-auto object-contain max-h-[40vh]" />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-800/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
