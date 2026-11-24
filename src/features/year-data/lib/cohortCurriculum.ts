// 편성표를 입학년도별로 보관하고, 다른 탭이 보는 예비 1학년/1학년/2학년(GradeKey) 화면은 거기서 계산합니다.
// 편성표 엑셀의 원본 행을 그대로 저장해 두면 학년이 올라가 해가 바뀌어도(작업 학년도가 바뀌어도) 그 입학년도 편성표를
// 다시 올릴 필요 없이 새 학년의 학기 열로 다시 계산할 수 있습니다.
//
// 옛 저장 파일(학년별로 이미 해석된 값만 있음)은 rows 없이 legacy 에 담아 두었다가, 그 입학년도 편성표를 새로 올리면 rows 로 대체됩니다.

import type {
  DesignatedSubject,
  GradeKey,
  ParsedCurriculumSubject,
  SelectedSubjectHours,
  SubjectMap,
} from "../../../types";
import { parseCurriculumRows } from "./parseCurriculum";

export const GRADES: GradeKey[] = ["pre1", "grade1", "grade2"];

export interface FieldTypes {
  parsed: ParsedCurriculumSubject[];
  map: SubjectMap;
  designated: DesignatedSubject[];
  selected: SelectedSubjectHours[];
  isParsed: boolean;
}
export type Field = keyof FieldTypes;

export type LegacyCurriculum = Partial<FieldTypes>;

export interface CohortCurriculum {
  /** 편성표 엑셀 첫 시트의 행(병합 셀 펼침). 없으면 legacy 값을 씁니다. */
  rows: unknown[][] | null;
  /** 과목 → 사용자가 고친 교과(군) */
  categoryOverrides: Record<string, string>;
  legacy?: LegacyCurriculum;
}

export type Cohorts = Record<string, CohortCurriculum>;
export type PerGradeOf<T> = { [key in GradeKey]: T };

/** 작업 학년도 W 에서 학년 화면(예비 1학년/1학년/2학년)에 해당하는 입학년도 */
export const cohortOfGradeKey = (workYear: number, grade: GradeKey): number =>
  grade === "pre1" ? workYear : grade === "grade1" ? workYear - 1 : workYear - 2;

export const emptyCohort = (): CohortCurriculum => ({ rows: null, categoryOverrides: {} });

/** 한 입학년도의 편성표를 어느 학년 화면(grade)의 모양으로 계산 */
export function deriveCohort(c: CohortCurriculum | undefined, grade: GradeKey): FieldTypes {
  if (c?.rows) {
    const r = parseCurriculumRows(c.rows, grade);
    const ov = c.categoryOverrides;
    const has = Object.keys(ov).length > 0;
    return {
      parsed: has ? r.parsed.map((p) => (ov[p.subject] ? { ...p, category: ov[p.subject] } : p)) : r.parsed,
      map: r.map,
      designated: has ? r.designated.map((d) => (ov[d.subject] ? { ...d, detailedCategory: ov[d.subject] } : d)) : r.designated,
      selected: has ? r.selected.map((d) => (ov[d.subject] ? { ...d, detailedCategory: ov[d.subject] } : d)) : r.selected,
      isParsed: true,
    };
  }
  const l = c?.legacy;
  return {
    parsed: l?.parsed ?? [],
    map: l?.map ?? {},
    designated: l?.designated ?? [],
    selected: l?.selected ?? [],
    isParsed: l?.isParsed ?? false,
  };
}

/** 학년 화면 세 개를 한 번에 계산 */
export function deriveViews(cohorts: Cohorts, workYear: number): { [F in Field]: PerGradeOf<FieldTypes[F]> } {
  const out = { parsed: {}, map: {}, designated: {}, selected: {}, isParsed: {} } as { [F in Field]: PerGradeOf<FieldTypes[F]> };
  for (const g of GRADES) {
    const d = deriveCohort(cohorts[String(cohortOfGradeKey(workYear, g))], g);
    (Object.keys(d) as Field[]).forEach((f) => {
      (out[f] as Record<string, unknown>)[g] = d[f];
    });
  }
  return out;
}

/**
 * 옛 방식의 "학년별 값 통째로 쓰기"(저장 파일 불러오기)를 입학년도 저장소에 반영하는 setter 를 만든다.
 * 바뀐 학년의 입학년도는 rows 를 버리고 legacy 로 전환한다(그 입학년도의 다른 항목은 지금 계산된 값을 legacy 로 옮겨 유지).
 */
export function makeViewSetter<F extends Field>(
  field: F,
  /** 입학년도 저장소를 (이전 값, 작업 학년도) → 새 값으로 갱신 */
  update: (fn: (prev: Cohorts, workYear: number) => Cohorts) => void,
): React.Dispatch<React.SetStateAction<PerGradeOf<FieldTypes[F]>>> {
  return (u) =>
    update((prev, W) => {
      const view = deriveViews(prev, W)[field];
      const next = typeof u === "function" ? (u as (p: PerGradeOf<FieldTypes[F]>) => PerGradeOf<FieldTypes[F]>)(view) : u;
      let out = prev;
      for (const g of GRADES) {
        if (next[g] === view[g]) continue;
        const key = String(cohortOfGradeKey(W, g));
        const cur = out[key];
        const base: LegacyCurriculum = cur?.rows ? { ...deriveCohort(cur, g) } : { ...(cur?.legacy ?? {}) };
        if (out === prev) out = { ...prev };
        out[key] = { rows: null, categoryOverrides: {}, legacy: { ...base, [field]: next[g] } };
      }
      return out;
    });
}

/** 위계 규칙은 모든 입학년도가 같은 한 벌 — 학년별 화면에서 한 학년만 바뀌면 그 값, 여러 학년이 한꺼번에 바뀌면(불러오기) 합집합 */
export function mergeHierarchyWrite<T extends { prereq: string; advanced: string }>(prev: T[], next: PerGradeOf<T[]>): T[] {
  const changed = GRADES.map((g) => next[g]).filter((l): l is T[] => Array.isArray(l) && l !== prev);
  if (changed.length === 0) return prev;
  if (changed.length === 1) return changed[0];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const list of changed) {
    for (const r of list) {
      const k = `${r.prereq}|${r.advanced}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(r);
      }
    }
  }
  return out;
}

/** 저장 파일에서 읽은 입학년도 편성표를 안전하게(모양이 틀린 항목은 버린다) */
export function sanitizeCohorts(raw: unknown): Cohorts {
  const out: Cohorts = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}$/.test(k) || !v || typeof v !== "object") continue;
    const o = v as Partial<CohortCurriculum>;
    out[k] = {
      rows: Array.isArray(o.rows) ? (o.rows as unknown[][]) : null,
      categoryOverrides: o.categoryOverrides && typeof o.categoryOverrides === "object" ? (o.categoryOverrides as Record<string, string>) : {},
      legacy: o.legacy && typeof o.legacy === "object" ? (o.legacy as LegacyCurriculum) : undefined,
    };
  }
  return out;
}
