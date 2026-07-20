"use client";

import type { GradeKey } from "../../../types";

interface GradeTabsProps {
  activeGrade: GradeKey;
  setActiveGrade: (grade: GradeKey) => void;
}

export function GradeTabs({ activeGrade, setActiveGrade }: GradeTabsProps) {
  return (
    <div className="flex gap-2 mb-6 border-b border-stone-200 pb-4">
      <button
        onClick={() => setActiveGrade("pre1")}
        className={`px-6 py-2.5 rounded-xl font-medium transition-all ${activeGrade === "pre1" ? "bg-amber-100 text-stone-900 border border-amber-300 shadow-inner" : "text-stone-900 hover:text-stone-900 hover:bg-stone-100"
          }`}
      >
        예비 1학년
      </button>
      <button
        onClick={() => setActiveGrade("grade1")}
        className={`px-6 py-2.5 rounded-xl font-medium transition-all ${activeGrade === "grade1" ? "bg-amber-100 text-stone-900 border border-amber-300 shadow-inner" : "text-stone-900 hover:text-stone-900 hover:bg-stone-100"
          }`}
      >
        1학년
      </button>
      <button
        onClick={() => setActiveGrade("grade2")}
        className={`px-6 py-2.5 rounded-xl font-medium transition-all ${activeGrade === "grade2" ? "bg-amber-100 text-stone-900 border border-amber-300 shadow-inner" : "text-stone-900 hover:text-stone-900 hover:bg-stone-100"
          }`}
      >
        2학년
      </button>
    </div>
  );
}
