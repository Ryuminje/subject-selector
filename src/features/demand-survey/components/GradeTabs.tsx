"use client";

import type { GradeKey } from "../../../types";
import { useYearData } from "../../year-data/YearDataContext";
import { cohortLabels, gradeCaptions } from "../../year-data/lib/gradeLabels";

interface GradeTabsProps {
  activeGrade: GradeKey;
  setActiveGrade: (grade: GradeKey) => void;
  /** 탭 이름을 바꿔 쓸 때 — 없으면 작업 학년도에서 계산한 입학년도 표기("2026학년도 입학생") */
  labels?: Record<GradeKey, string>;
}

const GRADES: GradeKey[] = ["pre1", "grade1", "grade2"];

// 학년 탭: 큰 글씨는 입학년도, 아래 작은 문구는 지금(올해) 몇 학년인지. 수요조사·본조사·타임 배정이 같이 씁니다.
export function GradeTabs({ activeGrade, setActiveGrade, labels }: GradeTabsProps) {
  const { workYear } = useYearData();
  const names = labels ?? cohortLabels(workYear);
  return (
    // flex-wrap: 셋 다 한 줄에 못 들어갈 만큼 좁으면(모바일 등) 억지로 욱여넣어 글자가 한 자씩
    // 세로로 쪼개지는 대신, 남는 버튼이 다음 줄로 자연스럽게 내려갑니다. whitespace-nowrap은
    // 버튼 각각이 그 안에서 다시 줄바꿈되는 걸 막습니다(실제로 겪은 버그).
    <div className="flex flex-wrap gap-2 mb-6 border-b border-stone-200 pb-4">
      {GRADES.map((g) => (
        <button
          key={g}
          onClick={() => setActiveGrade(g)}
          className={`px-6 py-2 rounded-xl font-medium transition-all whitespace-nowrap flex flex-col items-center leading-tight ${activeGrade === g ? "bg-amber-100 text-stone-900 border border-amber-300 shadow-inner" : "text-stone-900 hover:text-stone-900 hover:bg-stone-100"
            }`}
        >
          <span>{names[g]}</span>
          <span className="text-[11px] font-normal text-stone-500">{gradeCaptions[g]}</span>
        </button>
      ))}
    </div>
  );
}
