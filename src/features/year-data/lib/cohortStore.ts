// 학년 자리(예비 1학년/1학년/2학년, 변경 탭은 2학년/3학년)별로 들고 있던 데이터를 입학년도 기준으로 보관하는 저장소.
// 모양: 저장소[이름][입학년도] = 값. 화면이 보는 학년 자리 값은 작업 학년도(W)에서 계산합니다 — 작업 학년도를 바꿔도
// 데이터는 입학년도를 따라가고, 보고 있는 세 입학년도 밖(지난 입학생)으로 밀려난 데이터는 저장소에 그대로 남습니다.

import type { GradeKey } from "../../../types";
import type { ChangeGradeKey } from "../../change-survey/types";

/** 학년 자리 → 작업 학년도에서 몇 해 전 입학생인가(예비 1학년 = 올해 입학생) */
export const GRADE_OFFSETS: Record<GradeKey, number> = { pre1: 0, grade1: 1, grade2: 2 };
/** 선택과목 변경 탭의 학년 자리(grade2/grade3 = 내년 2·3학년) — 공유 저장소의 grade1/grade2 와 같은 입학생 */
export const CHANGE_OFFSETS: Record<ChangeGradeKey, number> = { grade2: 1, grade3: 2 };

/** 평평한 맵의 키 앞부분: 학년 자리 이름("grade1_1학기_문학") — 수요조사·본조사의 손으로 고친 개설 반 수 */
export const KEY_PREFIX_BY_GRADE: Record<GradeKey, string> = { pre1: "pre1", grade1: "grade1", grade2: "grade2" };
/** 평평한 맵의 키 앞부분: 내년 학년 숫자("2_문학_1") — 교과(군)별 시수 정리의 손으로 고친 반 수 */
export const KEY_PREFIX_BY_LABEL: Record<GradeKey, string> = { pre1: "1", grade1: "2", grade2: "3" };

export type CohortStore = Record<string, Record<string, unknown>>;

export const cohortKey = (workYear: number, offset: number) => String(workYear - offset);

/** 학년 자리 화면 값 계산(없는 입학년도는 기본값) */
export function buildView<K extends string, T>(
  map: Record<string, unknown> | undefined,
  workYear: number,
  offsets: Record<K, number>,
  def: T | ((k: K) => T),
): Record<K, T> {
  const out = {} as Record<K, T>;
  (Object.keys(offsets) as K[]).forEach((k) => {
    const v = map?.[cohortKey(workYear, offsets[k])];
    out[k] = v === undefined ? (typeof def === "function" ? (def as (k: K) => T)(k) : def) : (v as T);
  });
  return out;
}

/** 화면 값(view)에서 바뀐 학년 자리만 해당 입학년도에 되써서 새 map 을 돌려준다(안 바뀌면 같은 map) */
export function writeView<K extends string, T>(
  map: Record<string, unknown> | undefined,
  workYear: number,
  offsets: Record<K, number>,
  view: Record<K, T>,
  next: Record<K, T>,
): Record<string, unknown> | undefined {
  let out = map;
  (Object.keys(offsets) as K[]).forEach((k) => {
    if (next[k] === view[k] || next[k] === undefined) return;
    if (out === map) out = { ...(map ?? {}) };
    (out as Record<string, unknown>)[cohortKey(workYear, offsets[k])] = next[k];
  });
  return out;
}

/** 저장 파일에서 읽은 값을 안전하게(입학년도 키가 4자리 숫자가 아닌 항목은 버린다) */
export function sanitizeCohortStore(raw: unknown): CohortStore {
  const out: CohortStore = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [name, byCohort] of Object.entries(raw as Record<string, unknown>)) {
    if (!byCohort || typeof byCohort !== "object") continue;
    const m: Record<string, unknown> = {};
    for (const [c, v] of Object.entries(byCohort as Record<string, unknown>)) if (/^\d{4}$/.test(c)) m[c] = v;
    out[name] = m;
  }
  return out;
}

/** 저장소에 데이터가 있는 입학년도들(보관함 목록용) — 값이 비어 있지 않은 것만 */
export function storedCohortYears(store: CohortStore): Set<number> {
  const years = new Set<number>();
  for (const byCohort of Object.values(store)) {
    for (const [c, v] of Object.entries(byCohort)) {
      const empty = v == null || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);
      if (!empty) years.add(Number(c));
    }
  }
  return years;
}
