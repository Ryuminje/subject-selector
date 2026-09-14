// 배정 결과 → 학생 × 타임 표 / TSV / StudentTimeData.
// prototypes/time-allocation/public/app.js 의 timeLabel/studentRow/studentsTSV 를 옮기고,
// 선택과목 변경 탭이 먹는 StudentTimeData 형태로 변환하는 toStudentTimeData 를 더했습니다.
// 1학기/2학기 반 고정 공통과목은 서로 독립이라 학기별로 순회해 채웁니다.

import type { Assignment, RosterStudent, RosterSubject, SemesterBandInfo } from "../types";
import type { StudentTimeData } from "../../../types";
import { semesterKeyOf } from "../types";
import { bandList, classKey, classLabel } from "./bands";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export interface StudentRowsContext {
  numTimes: number;
  startLetter: number;
  subjects: RosterSubject[];
  students: RosterStudent[];
  /** 그리드(②단계)와 같은 순서 — 학기별로 나눠 보여줄 때 이 순서를 그대로 씁니다. */
  semesterKeys: string[];
  /** semesterKeyOf(subject) → 그 학기의 공통과목 설정 + 타임 고정 결과 + 그 학기가 쓰는 타임 수(ownTimes). */
  bySemester: Record<string, SemesterBandInfo & { ownTimes: number }>;
}

export const timeLabel = (ctx: Pick<StudentRowsContext, "startLetter">, t: number): string =>
  LETTERS[(ctx.startLetter + t) % 26];

/**
 * 학생 i 의 타임별 과목명 배열(선택과목 + 학기별 반 고정 공통과목). 길이 = numTimes.
 *
 * ⚠️ 1학기/2학기는 같은 타임 번호를 각자 독립적으로 씁니다(예: 1학기 A타임과 2학기
 * A타임은 물리적으로 다른 시간) — 그래서 이 함수처럼 모든 학기를 **하나의** 배열에
 * 같은 인덱스로 합치면, 두 학기가 같은 t에 과목을 배치했을 때 뒤에 합쳐지는 학기가
 * 앞 학기 것을 덮어써 버립니다(실제로 겪은 버그). **학기별로 구분해서 보여줘야 하는
 * 화면·내보내기는 이 함수 대신 아래 studentRowsBySemester를 쓰세요.** 이 함수는
 * toStudentTimeData(단일 학기 전제의 다른 탭 연동)에서만 남겨둔 것입니다.
 */
export function studentRow(ctx: StudentRowsContext, assign: Assignment, i: number): string[] {
  const st = ctx.students[i];
  const byT = new Array<string>(ctx.numTimes).fill("");
  for (const [s, t] of assign.byStudent[i]) byT[t] = ctx.subjects[s].name;
  const k = classKey(st.id);
  Object.values(ctx.bySemester).forEach((info) => {
    if (!info.common.on) return;
    bandList(info.common).forEach((b, bi) => {
      const t = (info.bandTimes[bi] || {})[k];
      if (t !== undefined) byT[t] = b.subjects.map((s) => s.name).join(" + ");
    });
  });
  return byT;
}

/**
 * 학생 i 의 타임별 과목명을 **학기별로 나눠서** 돌려줍니다(semesterKey → 배열, 각 배열
 * 길이는 그 학기가 실제로 쓰는 타임 수 ownTimes). studentRow와 달리 학기끼리 같은 타임
 * 번호를 써도 서로 덮어쓰지 않습니다 — 화면(③단계)·TSV·엑셀 내보내기는 전부 이걸 씁니다.
 */
export function studentRowsBySemester(
  ctx: StudentRowsContext,
  assign: Assignment,
  i: number,
  sectionLabels?: Map<string, string>,
): Record<string, string[]> {
  const st = ctx.students[i];
  const k = classKey(st.id);
  const out: Record<string, string[]> = {};
  ctx.semesterKeys.forEach((key) => {
    out[key] = new Array<string>(ctx.bySemester[key]?.ownTimes ?? ctx.numTimes).fill("");
  });
  for (const [s, t] of assign.byStudent[i]) {
    const subj = ctx.subjects[s];
    const row = out[semesterKeyOf(subj)];
    if (!row || t >= row.length) continue;
    // 분반이 겹친(A1/A2) 칸이면 라벨을 과목명 뒤에 붙여 구분합니다. plain "A"면(안 겹침) 그대로.
    const label = sectionLabels?.get(`${i}|${s}`);
    const plain = timeLabel(ctx, t);
    row[t] = label && label !== plain ? `${subj.name} (${label})` : subj.name;
  }
  ctx.semesterKeys.forEach((key) => {
    const info = ctx.bySemester[key];
    if (!info?.common.on) return;
    bandList(info.common).forEach((b, bi) => {
      const t = (info.bandTimes[bi] || {})[k];
      const row = out[key];
      if (t !== undefined && row && t < row.length) row[t] = b.subjects.map((s) => s.name).join(" + ");
    });
  });
  return out;
}

/** 학기가 여럿이면 열 이름에 학기를 붙입니다("1학기 A타임") — 하나뿐이면 굳이 안 붙입니다. */
function timeColumnLabel(ctx: StudentRowsContext, key: string, t: number): string {
  const label = timeLabel(ctx, t) + "타임";
  return ctx.semesterKeys.length > 1 ? `${key} ${label}` : label;
}

/** 엑셀에 붙여넣을 TSV(순번/학번/반/이름 + 학기별 타임열 + 미배정). */
export function studentsTSV(
  ctx: StudentRowsContext,
  assign: Assignment,
  sectionLabels?: Map<string, string>,
): string {
  const header = [
    "순번",
    "학번",
    "반",
    "이름",
    ...ctx.semesterKeys.flatMap((key) =>
      Array.from({ length: ctx.bySemester[key]?.ownTimes ?? ctx.numTimes }, (_, t) => timeColumnLabel(ctx, key, t)),
    ),
    "미배정",
  ].join("\t");
  const lines = ctx.students.map((st, i) => {
    const bySem = studentRowsBySemester(ctx, assign, i, sectionLabels);
    return [
      st.no,
      st.id,
      classLabel(classKey(st.id)),
      st.name,
      ...ctx.semesterKeys.flatMap((key) => bySem[key]),
      assign.unassigned[i].map((s) => ctx.subjects[s].name).join(", "),
    ].join("\t");
  });
  return [header, ...lines].join("\n");
}

/** 선택과목 변경 탭(TimetableStep)이 입력으로 받는 형태로 변환. 키는 "A타임" 같은 라벨. */
export function toStudentTimeData(ctx: StudentRowsContext, assign: Assignment): StudentTimeData[] {
  return ctx.students.map((st, i) => {
    const row = studentRow(ctx, assign, i);
    const timeSlotMap: Record<string, string> = {};
    row.forEach((subject, t) => {
      timeSlotMap[timeLabel(ctx, t) + "타임"] = subject;
    });
    return { id: st.id, name: st.name, timeSlotMap };
  });
}
