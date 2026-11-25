// 학년 자리(예비 1학년/1학년/2학년, 변경 탭은 2학년/3학년)별로 들고 있던 데이터를 "수강신청 회차" 기준으로 보관하는 저장소.
// 회차 = (입학년도, 그 해에 신청하는 학년). 같은 입학생도 해마다 신청하는 과목이 달라서(2026 입학생: 2027에는 2학년 과목, 2028에는 3학년 과목)
// 입학년도만으로는 구분이 안 됩니다. 모양: 저장소[이름]["2026.2"] = 값 (2026학년도 입학생의 2학년 과목 회차).
// 화면이 보는 학년 자리 값은 작업 학년도(W)에서 계산합니다 — 작업 학년도를 올리면 같은 입학생이 새 회차(빈 상태)를 보고,
// 지난 회차의 데이터는 저장소에 그대로 남아 작업 학년도를 되돌리면 다시 보입니다.

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

/** 회차 키 — 입학년도.신청학년 (예: "2026.2") */
export const roundKey = (cohort: number, grade: number) => `${cohort}.${grade}`;
const ROUND_KEY_RE = /^(\d{4})\.(\d)$/;
export function parseRoundKey(key: string): { cohort: number; grade: number } | null {
  const m = ROUND_KEY_RE.exec(key);
  return m ? { cohort: Number(m[1]), grade: Number(m[2]) } : null;
}

/** 학년 자리(offset = 작업 학년도에서 몇 해 전 입학생인가)의 회차 키. offset 0 = 예비 1학년 = 1학년 과목 신청 */
export const cohortKey = (workYear: number, offset: number) => roundKey(workYear - offset, offset + 1);
/** 학년 화면(GradeKey)의 회차 키 */
export const roundKeyOfGradeKey = (workYear: number, grade: GradeKey) => cohortKey(workYear, GRADE_OFFSETS[grade]);

/**
 * 옛 키("2026" = 입학년도만)를 회차 키로 바꾼다. 옛 자료는 그 파일의 작업 학년도(fileWorkYear)에서 입력한 것이므로
 * 신청 학년 = fileWorkYear − 입학년도 + 1. 새 키는 그대로 두고(같은 회차가 둘이면 새 키가 우선), 풀 수 없는 키는 버린다.
 */
export function migrateRoundKeys<T>(rec: Record<string, T>, fileWorkYear: number): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (!/^\d{4}$/.test(k)) continue;
    const grade = fileWorkYear - Number(k) + 1;
    if (grade >= 1 && grade <= 9) out[roundKey(Number(k), grade)] = v;
  }
  for (const [k, v] of Object.entries(rec)) if (ROUND_KEY_RE.test(k)) out[k] = v;
  return out;
}

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

/** 저장 파일의 보관 자료·수요조사 결과 중 옛 키(입학년도만)가 있는가 — 어느 학년도에 입력한 자료인지 물어야 하는 파일인지 판단 */
export function hasLegacyRoundKeys(...records: unknown[]): boolean {
  return records.some((rec) => {
    if (!rec || typeof rec !== "object") return false;
    return Object.values(rec as Record<string, unknown>).some(
      (inner) => !!inner && typeof inner === "object" && Object.keys(inner as object).some((k) => /^\d{4}$/.test(k)),
    ) || Object.keys(rec as object).some((k) => /^\d{4}$/.test(k));
  });
}

/** 저장 파일에서 읽은 값을 안전하게. 옛 키(입학년도만)는 fileWorkYear 로 회차 키로 바꾸고, 풀 수 없는 키는 버린다 */
export function sanitizeCohortStore(raw: unknown, fileWorkYear: number): CohortStore {
  const out: CohortStore = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [name, byRound] of Object.entries(raw as Record<string, unknown>)) {
    if (!byRound || typeof byRound !== "object") continue;
    out[name] = migrateRoundKeys(byRound as Record<string, unknown>, fileWorkYear);
  }
  return out;
}

/** 저장소에 데이터가 있는 회차 키들(보관함 목록용) — 값이 비어 있지 않은 것만 */
export function storedRounds(store: CohortStore): Set<string> {
  const rounds = new Set<string>();
  for (const byRound of Object.values(store)) {
    for (const [k, v] of Object.entries(byRound)) {
      const empty = v == null || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);
      if (!empty && parseRoundKey(k)) rounds.add(k);
    }
  }
  return rounds;
}
