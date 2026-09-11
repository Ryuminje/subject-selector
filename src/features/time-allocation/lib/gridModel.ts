// 타임 배정 그리드의 파생 값.
// prototypes/time-allocation/public/app.js renderGrid() 의 집계 부분을 옮긴 것입니다.
//
// ★ 이미 잡은 버그(README 6절): 한 구획의 과목들은 같은 타임을 시수로 나눠 쓰므로,
//   타임별 인원·반 집계에서 **구획의 첫 과목에서만** 세고 나머지(shared)는 건너뜁니다.
//   과목 단위로 각각 더하면 인원·반이 부풀려집니다.

import type { Assignment, CommonConfig, RosterStudent, RosterSubject } from "../types";
import { bandList, classKey } from "./bands";

export interface GridContext {
  numTimes: number;
  subjects: RosterSubject[];
  students: RosterStudent[];
  selected: boolean[];
  common: CommonConfig;
  bandTimes: Array<Record<string, number>>;
}

/** 공통과목 셀 하나(구획 첫 과목만 shared=false). */
export interface CommonCell {
  name: string;
  bandIdx: number;
  credits: number;
  teachers: number;
  shared: boolean;
}

export function commonCells(common: CommonConfig): CommonCell[] {
  const out: CommonCell[] = [];
  bandList(common).forEach((b, bi) =>
    b.subjects.forEach((s, j) =>
      out.push({ name: s.name, bandIdx: bi, credits: s.credits, teachers: s.teachers, shared: j > 0 }),
    ),
  );
  return out;
}

/** 구획 bandIdx 가 타임 t 에 배치한 반 키 목록. */
export function classesAt(
  ctx: Pick<GridContext, "students" | "bandTimes">,
  bandIdx: number,
  t: number,
): string[] {
  const classes = [...new Set(ctx.students.map((st) => classKey(st.id)))].sort();
  return classes.filter((k) => (ctx.bandTimes[bandIdx] || {})[k] === t);
}

export interface PerTimeRow {
  time: number;
  students: number; // 그 타임의 인원(선택 + 공통, 구획 단위)
  sections: number; // 그 타임의 분반 수(선택 + 공통, 구획 단위)
}

/** 타임별 인원·분반 수. 공통과목은 구획 첫 과목에서만 집계(shared 건너뜀). */
export function perTimeRows(
  ctx: GridContext,
  assign: Assignment | null,
  placement: number[][],
): PerTimeRow[] {
  const com = commonCells(ctx.common);
  const rows: PerTimeRow[] = [];
  for (let t = 0; t < ctx.numTimes; t++) {
    let stu = 0;
    let secs = 0;
    ctx.subjects.forEach((s) => {
      if (ctx.selected[s.idx] && placement[s.idx]?.includes(t)) {
        secs++;
        stu += assign ? assign.load[s.idx][t] : 0;
      }
    });
    com.forEach((c) => {
      if (c.shared) return; // 같은 구획의 다른 과목이므로 이미 셈에 들어가 있음
      const ks = classesAt(ctx, c.bandIdx, t);
      if (ks.length) {
        secs += ks.length;
        stu += ctx.students.filter((st) => ks.includes(classKey(st.id))).length;
      }
    });
    rows.push({ time: t, students: stu, sections: secs });
  }
  return rows;
}

/**
 * 검증용 불변식 값.
 * left  = Σ(타임별 인원)  — perTimeRows 로 집계한 합(구획 단위)
 * right = Σ학생(배정된 선택과목 수 + 그 반이 점유한 구획 수)  — 실제로 학생이 채운 칸 수
 * 이 둘이 같아야 합니다(학생은 한 타임에 한 수업만 듣기 때문).
 */
export function invariantCheck(
  ctx: GridContext,
  assign: Assignment,
  placement: number[][],
): { left: number; right: number; ok: boolean } {
  const left = perTimeRows(ctx, assign, placement).reduce((a, r) => a + r.students, 0);
  const bandCount = ctx.common.on ? bandList(ctx.common).length : 0;
  const right = ctx.students.reduce((acc, st, i) => {
    const k = classKey(st.id);
    const bandsForClass = ctx.common.on
      ? ctx.bandTimes.filter((m) => m[k] !== undefined).length
      : 0;
    return acc + assign.byStudent[i].size + Math.min(bandsForClass, bandCount);
  }, 0);
  return { left, right, ok: left === right };
}
