// 선택과목 변경 탭의 1학기·2학기 구분.
// 두 학기는 시간표·학생 타임·신청·확정이 서로 완전히 독립이라, 공유 저장소(cohortStore)의 이름을 학기마다 따로 씁니다.
// 2학기는 학기 구분이 없던 시절의 이름("change.…")을 그대로 씁니다 — 그래야 옛 저장 파일이 2학기 자리로 바로 읽힙니다.

import type { StudentTimeData } from "../../../types";
import type { RosterStudent } from "../../year-data/lib/roster";

export type ChangeSemester = "s1" | "s2";

export const SEMESTER_LABEL: Record<ChangeSemester, string> = { s1: "1학기", s2: "2학기" };

/** 저장소 이름. 1학기는 change.s1.필드, 2학기는 change.필드(옛 이름) */
export const changeStoreName = (semester: ChangeSemester, field: string): string => (semester === "s1" ? `change.s1.${field}` : `change.${field}`);

/** 타임 배정이 보낸 학기 이름("1학기"/"2학기"/없음) → 변경 탭의 학기. 학기 구분이 없으면 null(지금 보는 학기에 받는다) */
export function semesterFromLabel(label: string | undefined): ChangeSemester | null {
  if (!label) return null;
  if (label.includes("2학기")) return "s2";
  if (label.includes("1학기")) return "s1";
  return null;
}

/** 학생 한 명의 모든 학번(진급 전후) — 명단에 없으면 받은 학번 하나뿐 */
export function allIdsOf(id: string, roster: RosterStudent[]): string[] {
  const hit = roster.find((r) => r.ids[1] === id || r.ids[2] === id || r.ids[3] === id);
  const ids = hit ? [hit.ids[1], hit.ids[2], hit.ids[3]] : [];
  return [...new Set([id, ...ids].filter((x): x is string => !!x))];
}

/** 이전 수강과목 맵의 학생 수 — 같은 학생이 진급 전후 학번으로 두 번 들어 있어도 한 명으로 센다 */
export function countHistoryStudents(map: Record<string, unknown>, roster: RosterStudent[]): number {
  const seen = new Set<string>();
  for (const id of Object.keys(map)) {
    const hit = roster.find((r) => r.ids[1] === id || r.ids[2] === id || r.ids[3] === id);
    seen.add(hit ? hit.key : id);
  }
  return seen.size;
}

/**
 * 1학기 변경 후 수강과목을 2학기의 "이전 수강과목"(학번 → 과목 목록)으로 바꾼다.
 * 2학기에는 진급으로 학번이 바뀌므로, 같은 학생의 모든 학번 아래에 같은 목록을 넣어 어느 학번으로 찾아도 맞게 한다.
 */
export function buildCarryOver(finalSubjects: Record<string, string[]>, students: StudentTimeData[], roster: RosterStudent[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const s of students) {
    const subjects = finalSubjects[s.id];
    if (!subjects) continue;
    for (const id of allIdsOf(s.id, roster)) out[id] = subjects;
  }
  return out;
}
