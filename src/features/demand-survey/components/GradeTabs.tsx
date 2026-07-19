"use client";

import type { GradeKey } from "../../../types";

interface GradeTabsProps {
  activeGrade: GradeKey;
  setActiveGrade: (grade: GradeKey) => void;
}

export function GradeTabs({ activeGrade, setActiveGrade }: GradeTabsProps) {
  return (
    <div className="flex gap-2 mb-6 border-b border-slate-800 pb-4">
      <button
        onClick={() => setActiveGrade("pre1")}
        className={`px-6 py-2.5 rounded-xl font-medium transition-all ${activeGrade === "pre1" ? "bg-indigo-600/20 text-white border border-indigo-500/30 shadow-inner" : "text-white hover:text-white hover:bg-slate-800/50"
          }`}
      >
        예비 1학년
      </button>
      <button
        onClick={() => setActiveGrade("grade1")}
        className={`px-6 py-2.5 rounded-xl font-medium transition-all ${activeGrade === "grade1" ? "bg-indigo-600/20 text-white border border-indigo-500/30 shadow-inner" : "text-white hover:text-white hover:bg-slate-800/50"
          }`}
      >
        1학년
      </button>
      <button
        onClick={() => setActiveGrade("grade2")}
        className={`px-6 py-2.5 rounded-xl font-medium transition-all ${activeGrade === "grade2" ? "bg-indigo-600/20 text-white border border-indigo-500/30 shadow-inner" : "text-white hover:text-white hover:bg-slate-800/50"
          }`}
      >
        2학년
      </button>
    </div>
  );
}
