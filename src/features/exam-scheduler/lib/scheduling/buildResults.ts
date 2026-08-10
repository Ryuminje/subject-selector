/**
 * 시험실 배정과 좌석번호 계산 — 구 버전 `build_result_df()`(excel_logic.py:239-360)의 이식본.
 *
 * 통합 시간표, 학급별, 개인별, 시험지 봉투 표지가 전부 이 함수의 결과에서 나옵니다.
 * 정렬 순서가 곧 좌석번호이므로 순서를 바꾸면 전교생의 자리가 바뀝니다.
 * 수정할 때는 `npm run test`로 골든 파일과 대조하세요.
 */

import {
  formatExamTime,
  makeRosterKey,
  makeStudentKey,
  normalizeRoom,
  normalizeSubjectKey,
  periodLabel,
  splitTimetableCell,
  toSortNumber,
} from '../domain/normalize';
import type { GradeGroup, ResultRow, StudentKey, StudentRecord } from '../domain/types';

/** 시간표 한 칸에서 펼쳐진 시험 슬롯 하나. */
interface ExamSlot {
  subjectKey: string;
  examDate: string;
  examPeriod: string;
}

/** 정렬이 끝날 때까지만 필요한 내부 필드를 얹은 작업용 행. */
interface WorkingRow extends ResultRow {
  /** 분반 안에서의 순번. 분반이 아니면 0. */
  splitOrder: number;
  classSortNum: number;
  numberSortNum: number;
  /** 모든 정렬 키가 같을 때 원래 순서를 유지하기 위한 값. */
  originalIndex: number;
  subjectKey: string;
}

/**
 * 파이썬 문자열 비교와 같은 결과를 내는 비교자.
 *
 * `localeCompare`를 쓰면 안 됩니다. 한국어 로케일 정렬은 코드포인트 순서와 달라
 * 구 버전과 다른 좌석 배치가 나옵니다.
 */
function compareCodePoints(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** 시간표 격자를 (과목키 → 시험일자·교시) 목록으로 펼칩니다. */
function expandTimetable(group: GradeGroup): Map<string, ExamSlot[]> {
  const byKey = new Map<string, ExamSlot[]>();

  for (let period = 0; period < group.numPeriods; period += 1) {
    for (let day = 0; day < group.numDays; day += 1) {
      const cell = (group.timetable[period]?.[day] ?? '').trim();
      if (!cell) continue;

      const examDate = group.dates[day] ?? '';
      const examPeriod = periodLabel(period);

      for (const subjectKey of splitTimetableCell(cell)) {
        const slot: ExamSlot = { subjectKey, examDate, examPeriod };
        const existing = byKey.get(subjectKey);
        if (existing) existing.push(slot);
        else byKey.set(subjectKey, [slot]);
      }
    }
  }

  return byKey;
}

/**
 * 학생 한 명의 시험실을 정합니다. 우선순위는 **합반 → 분반 → 일반**입니다.
 *
 * 반환값의 두 번째 항목은 분반 안에서의 순번으로, 정렬에 쓰입니다.
 * 수동 배정(`roomMappings`)에 빈 문자열이 들어 있으면 그 빈 값이 그대로 이깁니다.
 * 키 자체가 없을 때만 강의실 이름에서 자동으로 유추합니다.
 */
export function assignExamRoom(
  group: GradeGroup,
  record: StudentRecord,
): [examRoom: string, splitOrder: number] {
  const subject = record.subject;

  const merge = group.mergeMappings[subject];
  if (merge) {
    return [group.roomMappings[`${subject}_${merge.mergedRoom}`] ?? '', 0];
  }

  const splitRooms = group.splitMappings[subject];
  if (splitRooms) {
    const key = makeRosterKey(record.className, record.number, record.name);
    for (const room of splitRooms) {
      const orderIndex = room.studentKeys.indexOf(key);
      if (orderIndex === -1) continue;

      const assigned =
        group.roomMappings[`${subject}_${room.name}`] ??
        normalizeRoom(room.name, group.gradePrefix) ??
        '';
      return [assigned, orderIndex];
    }
    // 어느 분반에도 속하지 않은 학생은 시험실이 비어 결과에서 눈에 띄게 둡니다.
    return ['', 0];
  }

  const assigned =
    group.roomMappings[`${subject}_${record.courseRoom}`] ??
    normalizeRoom(record.courseRoom, group.gradePrefix) ??
    '';
  return [assigned, 0];
}

/**
 * 한 학년의 시험 배정 결과를 만듭니다.
 *
 * @param excludedKeys 시험 대상에서 뺄 학생 키. `makeRosterKey`가 아니라
 *   `makeStudentKey`로 만든 키를 씁니다(제외 명단은 명단 원본 표기를 그대로 씁니다).
 */
export function buildResults(
  group: GradeGroup,
  excludedKeys: ReadonlySet<StudentKey> = new Set(),
): ResultRow[] {
  if (group.records.length === 0) return [];

  const slotsBySubject = expandTimetable(group);
  const rows: WorkingRow[] = [];

  for (const record of group.records) {
    if (
      excludedKeys.size > 0 &&
      excludedKeys.has(makeStudentKey(record.className, record.number, record.name))
    ) {
      continue;
    }

    // 저장해 둔 작업 내역의 비교키가 낡았을 수 있어 여기서 다시 계산합니다.
    const subjectKey = normalizeSubjectKey(record.subject);
    const slots = slotsBySubject.get(subjectKey);
    if (!slots) continue; // 시간표에 없는 과목 — 구 버전도 결과에서 뺍니다.

    const [examRoom, splitOrder] = assignExamRoom(group, record);

    for (const slot of slots) {
      // 날짜가 비어 있는 시험일은 아직 정해지지 않은 것이므로 결과에 넣지 않습니다.
      if (!slot.examDate) continue;

      rows.push({
        className: record.className,
        number: record.number,
        name: record.name,
        courseTitle: record.courseTitle,
        subject: record.subject,
        courseRoom: record.courseRoom,
        examDate: slot.examDate,
        examPeriod: slot.examPeriod,
        examRoom,
        seatNo: 0,
        subjectSeq: 0,
        examTime: formatExamTime(slot.examDate, slot.examPeriod),
        splitOrder,
        classSortNum: toSortNumber(record.className),
        numberSortNum: toSortNumber(record.number),
        originalIndex: rows.length,
        subjectKey,
      });
    }
  }

  if (rows.length === 0) return [];

  // 이 순서가 좌석번호를 결정합니다. 바꾸지 마세요.
  // 교시는 구 버전과 같이 문자열로 비교합니다 — 교시가 10개를 넘으면 "10교시"가
  // "2교시"보다 앞에 오지만, 구 버전 동작을 그대로 유지하기 위한 것입니다.
  rows.sort(
    (a, b) =>
      compareCodePoints(a.examDate, b.examDate) ||
      compareCodePoints(a.examPeriod, b.examPeriod) ||
      compareCodePoints(a.examRoom, b.examRoom) ||
      compareCodePoints(a.courseRoom, b.courseRoom) ||
      a.splitOrder - b.splitOrder ||
      a.classSortNum - b.classSortNum ||
      a.numberSortNum - b.numberSortNum ||
      a.originalIndex - b.originalIndex,
  );

  const seatCounters = new Map<string, number>();
  const subjectCounters = new Map<string, number>();

  for (const row of rows) {
    const seatKey = `${row.examDate}|${row.examPeriod}|${row.examRoom}`;
    const seat = (seatCounters.get(seatKey) ?? 0) + 1;
    seatCounters.set(seatKey, seat);
    row.seatNo = seat;

    const seq = (subjectCounters.get(row.subjectKey) ?? 0) + 1;
    subjectCounters.set(row.subjectKey, seq);
    row.subjectSeq = seq;
  }

  return rows.map((row) => ({
    className: row.className,
    number: row.number,
    name: row.name,
    courseTitle: row.courseTitle,
    subject: row.subject,
    courseRoom: row.courseRoom,
    examDate: row.examDate,
    examPeriod: row.examPeriod,
    examRoom: row.examRoom,
    seatNo: row.seatNo,
    subjectSeq: row.subjectSeq,
    examTime: row.examTime,
  }));
}
