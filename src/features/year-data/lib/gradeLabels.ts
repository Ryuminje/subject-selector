// 학년 탭 이름표 — 작업 학년도(수강신청을 받는 해)에서 계산한 입학년도 표기와 "현재 몇 학년" 작은 문구.
// 예) 작업 학년도 2027: 예비 1학년 = 2027학년도 입학생, 현 1학년 = 2026학년도 입학생, 현 2학년 = 2025학년도 입학생.

import type { GradeKey } from "../../../types";

/** 학년 탭의 큰 이름(입학년도 표기) */
export const cohortLabels = (workYear: number): Record<GradeKey, string> => ({
  pre1: `${workYear}학년도 입학생`,
  grade1: `${workYear - 1}학년도 입학생`,
  grade2: `${workYear - 2}학년도 입학생`,
});

/** 학년 탭 아래 작은 문구 — 지금(올해) 몇 학년인지 */
export const gradeCaptions: Record<GradeKey, string> = {
  pre1: "예비 1학년",
  grade1: "현 1학년",
  grade2: "현 2학년",
};

/** 선택과목 변경 탭의 학년 키(grade2/grade3 = 내년 2·3학년)를 같은 학년의 공유 저장소 키로 */
export const sharedGradeOfChange = (g: "grade2" | "grade3"): GradeKey => (g === "grade2" ? "grade1" : "grade2");
