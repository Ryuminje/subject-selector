"use client";

import type { GradeKey } from "../../../types";

interface GradeTabsProps {
  activeGrade: GradeKey;
  setActiveGrade: (grade: GradeKey) => void;
}

export function GradeTabs({ activeGrade, setActiveGrade }: GradeTabsProps) {
  return (
    // flex-wrap: 셋 다 한 줄에 못 들어갈 만큼 좁으면(모바일 등) 억지로 욱여넣어 글자가 한 자씩
    // 세로로 쪼개지는 대신, 남는 버튼이 다음 줄로 자연스럽게 내려갑니다. whitespace-nowrap은
    // 버튼 각각이 그 안에서 다시 줄바꿈되는 걸 막습니다(실제로 겪은 버그).
    <div className="flex flex-wrap gap-2 mb-6 border-b border-stone-200 pb-4">
      <button
        onClick={() => setActiveGrade("pre1")}
        className={`px-6 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${activeGrade === "pre1" ? "bg-amber-100 text-stone-900 border border-amber-300 shadow-inner" : "text-stone-900 hover:text-stone-900 hover:bg-stone-100"
          }`}
      >
        예비 1학년
      </button>
      <button
        onClick={() => setActiveGrade("grade1")}
        className={`px-6 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${activeGrade === "grade1" ? "bg-amber-100 text-stone-900 border border-amber-300 shadow-inner" : "text-stone-900 hover:text-stone-900 hover:bg-stone-100"
          }`}
      >
        1학년
      </button>
      <button
        onClick={() => setActiveGrade("grade2")}
        className={`px-6 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${activeGrade === "grade2" ? "bg-amber-100 text-stone-900 border border-amber-300 shadow-inner" : "text-stone-900 hover:text-stone-900 hover:bg-stone-100"
          }`}
      >
        2학년
      </button>
    </div>
  );
}
