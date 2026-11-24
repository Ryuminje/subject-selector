// 수요조사 결과(과목별 신청자·개설 반 수·폐강)를 본조사로 넘기기 위한 계산.
// 판정 규칙은 수요조사 탭의 "과목 개설 여부"(getClassRecommendation + 손으로 고친 값)와 같습니다.

import { getClassRecommendation } from "../../demand-survey/hooks/useDemandClassSummary";
import { normalizeSubjectName } from "../../main-survey/hooks/useMainUploads";
import type { GradeKey, SubjectStat } from "../../../types";

export type OutcomeStatus = "확정" | "폐강" | "미정";

export interface SubjectOutcome {
  group: string;
  semester: string;
  subject: string;
  applicants: number;
  /** 개설 반 수("2"), 범위("2~3"), "논의", "폐강" 등 수요조사 화면에 보이는 값 그대로 */
  remark: string;
  status: OutcomeStatus;
}

/** 입학년도별로 저장하는 수요조사 결과 한 벌 */
export interface DemandResult {
  importedAt: number;
  standardClassSize: number;
  outcomes: SubjectOutcome[];
}

/** 학기+과목명(정규화) — 수요조사와 본조사에서 같은 과목을 찾는 키 */
export const outcomeKey = (semester: string, subject: string) => `${semester}|${normalizeSubjectName(subject)}`;

/** 수요조사 통계 → 과목별 결과. manual 은 수요조사 화면에서 손으로 고친 개설 반 수(키 = `${grade}_${학기}_${과목}`). */
export function computeDemandOutcomes(
  grade: GradeKey,
  stats: SubjectStat[],
  standardSize: number,
  manual: Record<string, string>,
): SubjectOutcome[] {
  return stats.map((s) => {
    const base = getClassRecommendation(s.applicants, standardSize);
    const manualValue = manual[`${grade}_${s.semester}_${s.subject}`];
    const remark = manualValue !== undefined ? manualValue : base;
    const status: OutcomeStatus = remark === "폐강" ? "폐강" : !isNaN(Number(remark)) ? "확정" : "미정";
    return { group: s.group, semester: s.semester, subject: s.subject, applicants: s.applicants, remark, status };
  });
}

/** 바뀌었는지 비교하는 서명(수요조사를 고친 뒤 "다시 가져오기" 안내용) */
export const outcomeSignature = (outcomes: SubjectOutcome[]) =>
  outcomes.map((o) => `${o.semester}|${o.subject}|${o.applicants}|${o.remark}`).join("\n");

export interface ClosedWithApplicants {
  outcome: SubjectOutcome;
  /** 지금(본조사)의 신청자 수 */
  applicants: number;
}

/** 수요조사에서 폐강된 과목 중 본조사에 신청이 있는 것 */
export function closedWithApplicants(outcomes: SubjectOutcome[], mainStats: SubjectStat[]): ClosedWithApplicants[] {
  const byKey = new Map(mainStats.map((s) => [outcomeKey(s.semester, s.subject), s]));
  return outcomes
    .filter((o) => o.status === "폐강")
    .map((o) => ({ outcome: o, applicants: byKey.get(outcomeKey(o.semester, o.subject))?.applicants ?? 0 }))
    .filter((x) => x.applicants > 0);
}
