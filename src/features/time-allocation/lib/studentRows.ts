// 배정 결과 → 학생 × 타임 표 / TSV / StudentTimeData.
// prototypes/time-allocation/public/app.js 의 timeLabel/studentRow/studentsTSV 를 옮기고,
// 선택과목 변경 탭이 먹는 StudentTimeData 형태로 변환하는 toStudentTimeData 를 더했습니다.
// 1학기/2학기 반 고정 공통과목은 서로 독립이라 학기별로 순회해 채웁니다.

import type { Assignment, RosterStudent, RosterSubject, SemesterBandInfo } from "../types";
import type { StudentTimeData } from "../../../types";
import { bandList, classKey, classLabel } from "./bands";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export interface StudentRowsContext {
  numTimes: number;
  startLetter: number;
  subjects: RosterSubject[];
  students: RosterStudent[];
  /** semesterKeyOf(subject) → 그 학기의 공통과목 설정 + 타임 고정 결과. */
  bySemester: Record<string, SemesterBandInfo>;
}

export const timeLabel = (ctx: Pick<StudentRowsContext, "startLetter">, t: number): string =>
  LETTERS[(ctx.startLetter + t) % 26];

/** 학생 i 의 타임별 과목명 배열(선택과목 + 학기별 반 고정 공통과목). 길이 = numTimes. */
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

/** 엑셀에 붙여넣을 TSV(순번/학번/반/이름 + 타임열 + 미배정). */
export function studentsTSV(ctx: StudentRowsContext, assign: Assignment): string {
  const header = [
    "순번",
    "학번",
    "반",
    "이름",
    ...Array.from({ length: ctx.numTimes }, (_, t) => timeLabel(ctx, t) + "타임"),
    "미배정",
  ].join("\t");
  const lines = ctx.students.map((st, i) =>
    [
      st.no,
      st.id,
      classLabel(classKey(st.id)),
      st.name,
      ...studentRow(ctx, assign, i),
      assign.unassigned[i].map((s) => ctx.subjects[s].name).join(", "),
    ].join("\t"),
  );
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
