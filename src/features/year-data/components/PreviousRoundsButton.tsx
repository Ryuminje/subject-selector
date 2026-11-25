"use client";

// 수요조사·본조사 업로드 단계에서 "이전 학년 이수 이력" 위에 놓는 버튼 — 지난 수강신청 회차 결과를 이전 수강과목으로 가져온다.
// 1학년 과목 신청(예비 1학년)에는 지난 회차가 없어 아무것도 그리지 않는다.

import { History } from "lucide-react";
import type { PreviousRoundsResult } from "../lib/previousRounds";

export interface PreviousRoundsProps {
  preview: PreviousRoundsResult | null;
  description: string;
  onImport: () => void;
}

export function PreviousRoundsButton({ preview, description, onImport }: PreviousRoundsProps) {
  if (!preview) return null;
  const empty = preview.students === 0;
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-900">
      <button
        onClick={onImport}
        disabled={empty}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium disabled:opacity-50 disabled:hover:bg-amber-600"
      >
        <History className="w-4 h-4" />
        지난 수강신청 회차에서 가져오기
      </button>
      <span className="text-xs">
        {empty ? "가져올 지난 회차 자료가 아직 없습니다. " : `${preview.students}명 · 과목 ${preview.subjectCount}개 — `}
        {description}
      </span>
    </div>
  );
}
