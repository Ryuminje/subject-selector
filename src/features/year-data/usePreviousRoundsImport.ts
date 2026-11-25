"use client";

// 수요조사·본조사 업로드 단계의 "지난 수강신청 회차에서 가져오기" — 새 회차의 이전 수강과목(previousSubjectMap)을 지난 회차 결과로 채운다.
// 읽는 규칙은 lib/previousRounds. 엑셀로 올려 둔 이전 수강과목이 있으면 덮어쓰기 전에 확인을 묻는다.

import { useMemo } from "react";
import type { GradeKey } from "../../types";
import { useYearData } from "./YearDataContext";
import { cohortOfGradeKey } from "./lib/cohortCurriculum";
import { GRADE_OFFSETS } from "./lib/cohortStore";
import { collectPreviousRounds, describePreviousRounds, type PreviousSubjects } from "./lib/previousRounds";

type PrevMap = Record<GradeKey, Record<string, PreviousSubjects>>;
type PrevFiles = Record<GradeKey, { name: string; size: number; data: string } | null>;

export const PREVIOUS_ROUNDS_FILE_NAME = "지난 수강신청 회차에서 가져옴";

export function usePreviousRoundsImport(
  activeGrade: GradeKey,
  previousSubjectMap: PrevMap,
  setPreviousSubjectMap: React.Dispatch<React.SetStateAction<PrevMap>>,
  setPreviousHistoryFiles: React.Dispatch<React.SetStateAction<PrevFiles>>,
) {
  const { workYear, roster, cohortStore, demandResults } = useYearData();
  const targetGrade = GRADE_OFFSETS[activeGrade] + 1; // 이 회차에서 신청하는 학년
  const cohort = cohortOfGradeKey(workYear, activeGrade);

  // 1학년 과목 신청(예비 1학년)에는 지난 회차가 없다
  const preview = useMemo(
    () =>
      targetGrade <= 1
        ? null
        : collectPreviousRounds({ store: cohortStore, roster, demandResults, cohort, grades: Array.from({ length: targetGrade - 1 }, (_, i) => i + 1) }),
    [targetGrade, cohortStore, roster, demandResults, cohort],
  );

  const importPreviousRounds = () => {
    if (!preview) return;
    const detail = describePreviousRounds(preview);
    if (preview.students === 0) {
      window.alert(`가져올 지난 수강신청 회차 자료가 없습니다.\n${detail}`);
      return;
    }
    const existing = Object.keys(previousSubjectMap[activeGrade] || {}).length;
    if (existing > 0 && !window.confirm(`이미 올려 둔 이전 수강과목이 있습니다. 지난 수강신청 회차 결과로 바꿀까요?\n(${detail})`)) return;
    setPreviousSubjectMap((prev) => ({ ...prev, [activeGrade]: preview.map }));
    setPreviousHistoryFiles((prev) => ({ ...prev, [activeGrade]: { name: PREVIOUS_ROUNDS_FILE_NAME, size: 0, data: "" } }));
    window.alert(`지난 수강신청 회차에서 ${preview.students}명, 과목 ${preview.subjectCount}개를 가져왔습니다.\n${detail}`);
  };

  return {
    /** 이 회차가 1학년 과목 신청이면 null(버튼을 숨긴다) */
    previousRoundsPreview: preview,
    previousRoundsDescription: preview ? describePreviousRounds(preview) : "",
    importPreviousRounds,
  };
}
