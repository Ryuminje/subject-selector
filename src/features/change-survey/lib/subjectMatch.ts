import type { StudentTimeData } from "../../../types";
import type { TimetableGradeData } from "../types";

// 선택과목 변경 탭 전체가 과목명을 비교할 때 쓰는 단 하나의 규칙입니다.
// 공백·로마 숫자 표기·대소문자와 시간표 칸 끝의 분반 번호("심화 영어2")만 흡수하고,
// 그 밖에는 **완전히 같을 때만** 같은 과목으로 봅니다. 예전의 "한쪽이 다른 쪽을 포함하면
// 같은 과목" 규칙은 '심화 영어'와 '심화 영어 독해와 작문'을 같은 과목으로 묶어 명단이
// 섞이고 자동 변경 배정까지 잘못된 타임을 후보로 보는 버그를 냈습니다.
export function normalizeSubject(subject: string): string {
  return subject
    .replace(/\s+/g, "")
    .replace(/Ⅰ/g, "I")
    .replace(/Ⅱ/g, "II")
    .replace(/Ⅲ/g, "III")
    .replace(/Ⅳ/g, "IV")
    .replace(/\d+$/, "")
    .toLowerCase();
}

export function sameSubject(a: string, b: string): boolean {
  const na = normalizeSubject(a);
  return na !== "" && na === normalizeSubject(b);
}

/** 2단계에 업로드한 학생 데이터에 실제로 나오는 과목명(가나다순) — 입력 자동완성 후보. */
export function subjectOptionsOf(students: StudentTimeData[]): string[] {
  const set = new Set<string>();
  students.forEach((s) => Object.values(s.timeSlotMap).forEach((v) => v && set.add(v)));
  return [...set].sort((a, b) => a.localeCompare(b, "ko"));
}

/**
 * 변경 신청(5단계) 후보 — 학생 데이터 과목에 시간표에만 열린 과목(현재 수강생 0명)을 더합니다.
 * 시간표 칸 끝의 분반 번호는 떼고, 같은 과목(sameSubject)은 학생 데이터 쪽 표기를 남깁니다.
 */
export function changeSubjectOptionsOf(
  students: StudentTimeData[],
  gradeTimetable: TimetableGradeData,
): string[] {
  const out = subjectOptionsOf(students);
  Object.values(gradeTimetable).forEach((row) =>
    Object.values(row ?? {}).forEach((cell) => {
      const name = (cell?.subject ?? "").trim().replace(/[\d\s]+$/, "");
      if (name && !out.some((o) => sameSubject(o, name))) out.push(name);
    }),
  );
  return out.sort((a, b) => a.localeCompare(b, "ko"));
}

/** 후보가 없으면(데이터 미업로드) 판단할 수 없으므로 true — 빨간 표시를 띄우지 않습니다. */
export function isKnownSubject(subject: string, options: string[]): boolean {
  if (!subject.trim() || options.length === 0) return true;
  return options.some((o) => sameSubject(o, subject));
}

export function subjectExistsInSlot(
  subject: string,
  slot: string,
  gradeTimetable: TimetableGradeData,
  gradeCols: string[],
): boolean {
  return gradeCols.some((col) => sameSubject(gradeTimetable[slot]?.[col]?.subject ?? "", subject));
}

export function findSlotsWithSubject(
  subject: string,
  gradeTimetable: TimetableGradeData,
  gradeTimeSlots: string[],
  gradeCols: string[],
): string[] {
  if (!subject.trim()) return [];
  return gradeTimeSlots.filter((slot) => subjectExistsInSlot(subject, slot, gradeTimetable, gradeCols));
}
