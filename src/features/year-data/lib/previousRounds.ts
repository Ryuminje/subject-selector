// 지난 수강신청 회차의 결과 → 새 회차의 "이전 수강과목".
// 같은 입학생이 1학년 → 2학년 → 3학년 과목을 차례로 신청하므로, (입학년도, g)학년 회차의 이전 수강과목은 같은 입학년도의 1 ~ g−1학년 회차에서 모읍니다.
// 회차마다 읽는 곳(앞 순서가 우선):
//  1) 선택과목 변경 탭의 "변경 후" 결과(5단계 변경 후 타임별 학생 명단과 같은 값) — 2·3학년 회차에만 있고, 변경 탭이 회차별로 저장해 둔 것(change.finalSubjects)
//  2) 본조사 신청 과목(학기별 합침) — 수요조사에서 폐강으로 정해진 과목은 뺍니다. 타임 배정 결과는 저장되지 않아 읽을 수 없습니다.
// 같은 학생은 학생 명단의 모든 학번(진급 전후)으로 이어 붙이고, 결과는 모든 학번 아래에 같은 목록을 넣습니다.

import type { ProcessedStudent } from "../../../types";
import { normalizeSubject } from "../../change-survey/lib/subjectMatch";
import { roundKey, type CohortStore } from "./cohortStore";
import type { DemandResult } from "./demandOutcome";
import { isExcluded, type RosterStudent } from "./roster";

export type PreviousSource = "변경 결과" | "본조사 신청";

export interface PreviousRoundSummary {
  grade: number;
  /** 어디서 읽었나(없으면 null = 그 회차 자료 없음) */
  source: PreviousSource | null;
  students: number;
  /** 본조사 신청에서 폐강이라 뺀 과목 수(학생×과목) */
  closedRemoved: number;
}

export interface PreviousSubjects {
  name: string;
  subjects: string[];
}

export interface PreviousRoundsResult {
  /** 학번 → 이름·이전 수강과목(진급 전후 모든 학번 아래에 같은 값) — previousSubjectMap 과 같은 모양 */
  map: Record<string, PreviousSubjects>;
  students: number;
  subjectCount: number;
  rounds: PreviousRoundSummary[];
}

interface Args {
  store: CohortStore;
  roster: RosterStudent[];
  demandResults: Record<string, DemandResult>;
  /** 입학년도 */
  cohort: number;
  /** 읽을 지난 신청 학년들(예: 3학년 회차의 이전 수강과목 = [1, 2]) */
  grades: number[];
}

const nonEmpty = (m: unknown): m is Record<string, string[]> => !!m && typeof m === "object" && Object.keys(m as object).length > 0;

export function collectPreviousRounds({ store, roster, demandResults, cohort, grades }: Args): PreviousRoundsResult {
  // 학번은 입학년도가 다른 학생끼리 겹칠 수 있어(같은 3학년 학번을 다른 해 졸업생이 쓴다) 이 입학년도 학생만으로 찾는다
  const byId = new Map<string, RosterStudent>();
  for (const s of roster) if (s.cohort === cohort) for (const id of Object.values(s.ids)) if (id) byId.set(id, s);

  interface Entry { name: string; ids: Set<string>; subjects: Map<string, string> }
  const entries = new Map<string, Entry>();
  /** 학생 한 명의 과목을 합친다. 전출·퇴학 학생이면 false */
  const add = (id: string, name: string, subjects: string[]): boolean => {
    const r = byId.get(id);
    if (r && isExcluded(r)) return false;
    const key = r ? r.key : `id:${id}`;
    let e = entries.get(key);
    if (!e) {
      e = { name: r?.name || name, ids: new Set(), subjects: new Map() };
      entries.set(key, e);
    }
    if (r) for (const i of Object.values(r.ids)) if (i) e.ids.add(i);
    e.ids.add(id);
    for (const sub of subjects) {
      const n = normalizeSubject(sub ?? "");
      if (n && !e.subjects.has(n)) e.subjects.set(n, sub.trim());
    }
    return true;
  };

  const rounds: PreviousRoundSummary[] = [];
  for (const g of grades) {
    const key = roundKey(cohort, g);
    // 1) 변경 탭 결과 — 2학기 결과가 있으면 그것, 없으면 1학기
    const final = [store["change.finalSubjects"]?.[key], store["change.s1.finalSubjects"]?.[key]].find(nonEmpty);
    if (final) {
      let n = 0;
      for (const [id, subs] of Object.entries(final)) if (add(id, "", subs)) n++;
      rounds.push({ grade: g, source: "변경 결과", students: n, closedRemoved: 0 });
      continue;
    }
    // 2) 본조사 신청 과목
    const main = store["main.processedData"]?.[key] as ProcessedStudent[] | undefined;
    if (Array.isArray(main) && main.length > 0) {
      const closed = new Set((demandResults[key]?.outcomes ?? []).filter((o) => o.status === "폐강").map((o) => normalizeSubject(o.subject)));
      let n = 0;
      let removed = 0;
      for (const st of main) {
        const all = [...(st.semester1 ?? []), ...(st.semester1_2 ?? []), ...(st.semester2 ?? [])];
        const kept = all.filter((s) => !closed.has(normalizeSubject(s)));
        removed += all.length - kept.length;
        if (add(String(st.studentId).trim(), st.name, kept)) n++;
      }
      rounds.push({ grade: g, source: "본조사 신청", students: n, closedRemoved: removed });
      continue;
    }
    rounds.push({ grade: g, source: null, students: 0, closedRemoved: 0 });
  }

  const map: Record<string, PreviousSubjects> = {};
  let subjectCount = 0;
  for (const e of entries.values()) {
    const subjects = [...e.subjects.values()];
    subjectCount += subjects.length;
    for (const id of e.ids) map[id] = { name: e.name, subjects };
  }
  return { map, students: entries.size, subjectCount, rounds };
}

/** 화면에 보여 줄 한 줄 설명 — 어느 회차를 어디서 읽었는지 */
export function describePreviousRounds(r: PreviousRoundsResult): string {
  return r.rounds
    .map((x) =>
      x.source
        ? `${x.grade}학년 회차: ${x.source} ${x.students}명${x.closedRemoved > 0 ? `(폐강 과목 ${x.closedRemoved}건 제외)` : ""}`
        : `${x.grade}학년 회차: 자료 없음`,
    )
    .join(" · ");
}
