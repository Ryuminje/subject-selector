// 타임별 학생 명단(변경 전·후)과 그 엑셀에서 학생을 어떻게 보여 줄지 — 어느 학년 때 학번으로 볼지, 어떤 순서로 줄 세울지.
// 학번은 학생 명단(기초자료)에 학년별로 누적돼 있어서(1학년 학번·2학년 학번·3학년 학번) 파일에 적힌 학번과 다른 학년의 학번으로 바꿔 볼 수 있다.
// 이 설정은 "어느 반에 들어가는지"에는 영향이 없다 — 반은 파일의 학번 기준으로 먼저 나눈 뒤, 각 칸 안의 표시와 순서만 바꾼다.

import type { RosterStudent } from "../../year-data/lib/roster";

/** "file" = 파일에 적힌 학번 그대로, 1·2·3 = 그 학년 때의 학번 */
export type IdMode = "file" | 1 | 2 | 3;
export type SortMode = "id" | "name";

export const SORT_LABEL: Record<SortMode, string> = { id: "학번순", name: "이름순" };

/**
 * 학번 → 학생 명단의 그 학생(어느 학년 때 학번으로 찾아도 같은 학생).
 * 학번은 학년마다 번호가 새로 매겨져 입학년도가 다른 학생끼리 같은 번호를 쓸 수 있다(2024학년도 입학생의 3학년 학번 30314와
 * 2025학년도 입학생의 3학년 학번 30314). 그래서 보고 있는 학생들의 입학년도(cohort)를 주면 그 입학년도 학생만에서 찾는다.
 */
export function makeIdLookup(roster: RosterStudent[], cohort?: number): Map<string, RosterStudent> {
  const m = new Map<string, RosterStudent>();
  for (const s of roster) {
    if (cohort !== undefined && s.cohort !== cohort) continue;
    for (const id of Object.values(s.ids)) if (id) m.set(id, s);
  }
  return m;
}

/** 화면·엑셀에 적을 학번. 명단에 없거나 그 학년 학번이 비어 있으면 파일의 학번을 그대로 쓴다. */
export function displayIdOf(id: string, lookup: Map<string, RosterStudent>, mode: IdMode): string {
  if (mode === "file") return id;
  return lookup.get(id)?.ids[mode] ?? id;
}

/**
 * 고른 학년 학번으로 못 바꾸는 학생을 이유별로 센다(mode "file" 이면 없음).
 *  - notInRoster: 이 학번이 학생 명단 어디에도 없다(다른 학번 체계이거나 명단에 안 올린 학생)
 *  - noGradeId: 명단에는 있지만 그 학년 때 학번 칸이 비어 있다
 */
export function diagnoseIds(ids: string[], lookup: Map<string, RosterStudent>, mode: IdMode): { notInRoster: string[]; noGradeId: string[] } {
  const out = { notInRoster: [] as string[], noGradeId: [] as string[] };
  if (mode === "file") return out;
  for (const id of ids) {
    const r = lookup.get(id);
    if (!r) out.notInRoster.push(id);
    else if (!r.ids[mode]) out.noGradeId.push(id);
  }
  return out;
}

/** 표시 학번(숫자 순) 또는 이름(가나다순, 같으면 표시 학번)으로 정렬한 새 배열 */
export function sortForDisplay<S extends { id: string; name: string }>(students: S[], idOf: (s: S) => string, sort: SortMode): S[] {
  const byId = (a: S, b: S) => idOf(a).localeCompare(idOf(b), undefined, { numeric: true });
  return [...students].sort(sort === "name" ? (a, b) => a.name.localeCompare(b.name, "ko") || byId(a, b) : byId);
}
