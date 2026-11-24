"use client";

// 선택과목 변경 탭의 학년 토글(2학년/3학년 = 내년 학년) 안에 넣는 이름표 —
// 큰 글씨는 입학년도, 아래 작은 문구는 지금(올해) 몇 학년인지. 변경 탭의 grade2/grade3 는 공유 저장소의 grade1/grade2 와 같은 학년.

import { useYearData } from "../YearDataContext";
import { cohortLabels, gradeCaptions, sharedGradeOfChange } from "../lib/gradeLabels";

export function ChangeGradeLabel({ grade }: { grade: "grade2" | "grade3" }) {
  const { workYear } = useYearData();
  const g = sharedGradeOfChange(grade);
  return (
    <span className="flex flex-col items-center leading-tight">
      <span>{cohortLabels(workYear)[g]}</span>
      <span className="text-[11px] font-normal opacity-70">{gradeCaptions[g]}</span>
    </span>
  );
}
