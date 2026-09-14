// 타임 배정 그리드의 파생 값.
// prototypes/time-allocation/public/app.js renderGrid() 의 집계 부분을 옮긴 것입니다.
//
// ★ 이미 잡은 버그(README 6절): 한 구획의 과목들은 같은 타임을 시수로 나눠 쓰므로,
//   타임별 인원·반 집계에서 **구획의 첫 과목에서만** 세고 나머지(shared)는 건너뜁니다.
//   과목 단위로 각각 더하면 인원·반이 부풀려집니다.
// 1학기/2학기는 반 고정 공통과목도 서로 독립이라, 공통과목 셀마다 어느 학기 설정인지
// semesterKey 로 표시해 두고 그 학기의 bandTimes 로만 조회합니다.

import type { Assignment, RosterStudent, RosterSubject, SemesterBandInfo } from "../types";
import { bandList, classKey } from "./bands";
import { countAt } from "./assign";

export interface GridContext {
  numTimes: number;
  subjects: RosterSubject[];
  students: RosterStudent[];
  selected: boolean[];
  /** semesterKeyOf(subject) → 그 학기의 공통과목 설정 + 타임 고정 결과. */
  bySemester: Record<string, SemesterBandInfo>;
}

/** 공통과목 셀 하나(구획 첫 과목만 shared=false). */
export interface CommonCell {
  semesterKey: string;
  name: string;
  bandIdx: number;
  credits: number;
  teachers: number;
  shared: boolean;
}

export function commonCells(bySemester: Record<string, SemesterBandInfo>): CommonCell[] {
  const out: CommonCell[] = [];
  Object.entries(bySemester).forEach(([semesterKey, info]) => {
    bandList(info.common).forEach((b, bi) =>
      b.subjects.forEach((s, j) =>
        out.push({
          semesterKey,
          name: s.name,
          bandIdx: bi,
          credits: s.credits,
          teachers: s.teachers,
          shared: j > 0,
        }),
      ),
    );
  });
  return out;
}

/** 구획 bandIdx 가 타임 t 에 배치한 반 키 목록(그 학기의 bandTimes 를 넘겨받음). */
export function classesAt(
  ctx: Pick<GridContext, "students">,
  bandTimes: Array<Record<string, number>>,
  bandIdx: number,
  t: number,
): string[] {
  const classes = [...new Set(ctx.students.map((st) => classKey(st.id)))].sort();
  return classes.filter((k) => (bandTimes[bandIdx] || {})[k] === t);
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
  const com = commonCells(ctx.bySemester);
  const rows: PerTimeRow[] = [];
  for (let t = 0; t < ctx.numTimes; t++) {
    let stu = 0;
    let secs = 0;
    ctx.subjects.forEach((s) => {
      if (ctx.selected[s.idx] && placement[s.idx]?.includes(t)) {
        secs += countAt(placement[s.idx], t);
        stu += assign ? assign.load[s.idx][t] : 0;
      }
    });
    com.forEach((c) => {
      if (c.shared) return; // 같은 구획의 다른 과목이므로 이미 셈에 들어가 있음
      const bandTimes = ctx.bySemester[c.semesterKey]?.bandTimes ?? [];
      const ks = classesAt(ctx, bandTimes, c.bandIdx, t);
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
 * right = Σ학생(배정된 선택과목 수 + 그 반이 점유한 구획 수, 학기별 합산)  — 실제로 학생이 채운 칸 수
 * 이 둘이 같아야 합니다(학생은 한 타임에 한 수업만 듣기 때문).
 */
export function invariantCheck(
  ctx: GridContext,
  assign: Assignment,
  placement: number[][],
): { left: number; right: number; ok: boolean } {
  const left = perTimeRows(ctx, assign, placement).reduce((a, r) => a + r.students, 0);
  const right = ctx.students.reduce((acc, st, i) => {
    const k = classKey(st.id);
    let bandsForClass = 0;
    Object.values(ctx.bySemester).forEach((info) => {
      const bandCount = info.common.on ? bandList(info.common).length : 0;
      const occ = info.bandTimes.filter((m) => m[k] !== undefined).length;
      bandsForClass += Math.min(occ, bandCount);
    });
    return acc + assign.byStudent[i].size + bandsForClass;
  }, 0);
  return { left, right, ok: left === right };
}
