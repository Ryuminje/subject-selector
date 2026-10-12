"use client";

import { Printer } from "lucide-react";

/** 요약본을 A4로 인쇄하거나 PDF로 저장합니다(브라우저 인쇄창의 "PDF로 저장"). */
export function PrintButton({ label = "인쇄하기 / PDF로 저장" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-stone-800 bg-white rounded-xl border border-stone-300 hover:bg-stone-50 transition-colors"
    >
      <Printer className="w-4 h-4" />
      {label}
    </button>
  );
}
