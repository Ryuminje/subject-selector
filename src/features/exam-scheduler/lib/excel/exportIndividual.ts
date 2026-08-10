/**
 * 학생 개인별 시간표 — 구 버전 `generate_individual_timetable()`(excel_logic.py:901-1150)의 이식본.
 *
 * 인쇄해서 나눠 주는 문서입니다. 학생 한 명당 같은 표를 두 벌 찍고 사이에 절취선을 넣어,
 * 담임 선생님이 위쪽을 보관하고 아래쪽을 학생에게 줍니다. 학생마다 쪽을 나눕니다.
 *
 *   <2학년 개인시간표(담임보관용)>   학번: 1반 1번   이름: 학생11
 *   ┌──────────────┬───────────────────────┬───────────┐
 *   │ 구분         │       7.6(월)         │  7.7(화)  │
 *   │              │  1교시    │  2교시    │  1교시    │
 *   ├──────────────┼───────────┼───────────┼───────────┤
 *   │ 응시 과목명  │  국어     │  자습     │  자습     │
 *   │ 시험교실     │  2-1      │  2-1      │  2-1      │
 *   │ 좌석번호     │  1        │  1        │  1        │
 *   └──────────────┴───────────┴───────────┴───────────┘
 *   - - - - -  < 절 취 선 >  - - - - -
 *   (같은 표 한 벌 더)
 *
 * 서식은 `format.ts`의 공통 서식을 쓰지 않습니다. 인쇄용이라 행 높이·여백·쪽 나눔이
 * 따로 필요하고, 구 버전도 이 출력만 별도로 다뤘습니다.
 */

import ExcelJS from 'exceljs';
import {
  cleanClassName,
  cleanStudentNumber,
  makeRosterKey,
  makeStudentKey,
  periodLabel,
  toSortNumber,
} from '../domain/normalize';
import { WEEKDAY_LABELS } from '../domain/constants';
import type { GradeGroup, StudentKey } from '../domain/types';
import { buildResults } from '../scheduling/buildResults';
import { buildStudySeatNumbers } from '../scheduling/study';
import { displayWidth } from './format';
import { triggerDownload } from './exportResults';

/** 한 학생당 두 벌을 찍습니다. 위는 담임이 보관하고 아래는 학생에게 줍니다. */
const COPY_TYPES = ['담임보관용', '학생보관용'] as const;

const LABELS = [
  "응시 과목명\n(자습인 경우 '자습')",
  '시험교실\n(또는 자습 교실)',
  '좌석번호',
] as const;

const DASHED_LINE = `${'- '.repeat(20)} < 절 취 선 > ${' -'.repeat(20)}`;

const THIN_BORDER = {
  top: { style: 'thin' as const },
  left: { style: 'thin' as const },
  bottom: { style: 'thin' as const },
  right: { style: 'thin' as const },
};

const CENTER_WRAP = {
  horizontal: 'center' as const,
  vertical: 'middle' as const,
  wrapText: true,
};

interface StudentBrief {
  className: string;
  number: string;
  name: string;
}

/** `2026-07-06` → `7.6(월)` */
function formatDateHeader(date: string): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return date;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(dt.getTime())) return date;
  const weekday = WEEKDAY_LABELS[(dt.getDay() + 6) % 7];
  return `${dt.getMonth() + 1}.${dt.getDate()}(${weekday})`;
}

/**
 * 표에 그릴 칸을 정합니다. 시험이 하나도 없는 날은 통째로 빼고,
 * 남은 날은 그 날 시험이 있는 교시만큼 칸을 차지합니다.
 */
function planColumns(group: GradeGroup) {
  const columns: Array<{ period: number; day: number }> = [];
  const daySpans: Array<{ date: string; span: number }> = [];

  for (let day = 0; day < group.numDays; day += 1) {
    const periods: number[] = [];
    for (let period = 0; period < group.numPeriods; period += 1) {
      if ((group.timetable[period]?.[day] ?? '').trim()) periods.push(period);
    }
    if (periods.length === 0) continue;

    for (const period of periods) columns.push({ period, day });
    daySpans.push({ date: group.dates[day] ?? '', span: periods.length });
  }

  return { columns, daySpans };
}

/**
 * 열 너비를 정합니다. 공통 서식과 계산이 다릅니다 —
 * 줄바꿈이 있는 칸은 가장 긴 줄만 보고, 제목·절취선 줄은 아예 빼며, 최소 10을 보장합니다.
 */
function columnWidth(values: string[]): number {
  let max = 0;
  for (const value of values) {
    // 제목과 절취선은 열 하나에 걸쳐 병합되므로 너비 계산에서 뺍니다.
    if (value.startsWith('<') || value.startsWith('-')) continue;
    for (const line of value.split('\n')) {
      const width = displayWidth(line);
      if (width > max) max = width;
    }
  }
  return Math.max(max + 3, 10);
}

/** 학생 한 명을 특정하는 키. 반·번호의 "반"/"번" 표기를 떼고 만듭니다. */
function studentKeyOf(student: StudentBrief): string {
  return [
    cleanClassName(student.className),
    cleanStudentNumber(student.number),
    String(student.name).trim(),
  ].join('_');
}

export async function buildIndividualWorkbook(
  group: GradeGroup,
  excludedKeys: ReadonlySet<StudentKey> = new Set(),
): Promise<ExcelJS.Workbook | null> {
  const { columns, daySpans } = planColumns(group);
  if (columns.length === 0) return null;

  // 시험 배정: 학생 + 일자 + 교시 → 과목·교실·좌석
  const examLookup = new Map<
    string,
    { subject: string; room: string; seat: string }
  >();
  for (const row of buildResults(group, excludedKeys)) {
    const key = [
      studentKeyOf(row),
      row.examDate.trim(),
      row.examPeriod.trim(),
    ].join('_');
    examLookup.set(key, {
      subject: row.subject,
      room: row.examRoom,
      // 구 버전이 문자열로 담았습니다. 자습 좌석과 형이 달라지는데 그대로 둡니다.
      seat: String(row.seatNo),
    });
  }

  // 자습 배정: 학생 → 교시슬롯 → 교실
  const studyLookup = new Map<string, Map<string, string>>();
  for (const a of group.studyAssignments) {
    const key = studentKeyOf(a);
    let slots = studyLookup.get(key);
    if (!slots) {
      slots = new Map();
      studyLookup.set(key, slots);
    }
    slots.set(a.timeSlot, a.room);
  }

  // 자습 좌석번호는 학년 전체를 보고 매겨야 합니다. 통합 자습명단의 순번과 같은 값입니다.
  const studySeats = buildStudySeatNumbers(group);

  // 학생 목록 — 중복 수강 기록을 한 명으로 묶고 반·번호 순으로 세웁니다.
  const seen = new Set<string>();
  const students: StudentBrief[] = [];
  for (const record of group.records) {
    if (
      excludedKeys.size > 0 &&
      excludedKeys.has(makeStudentKey(record.className, record.number, record.name))
    ) {
      continue;
    }
    const brief = {
      className: cleanClassName(record.className),
      number: cleanStudentNumber(record.number),
      name: String(record.name).trim(),
    };
    const key = studentKeyOf(brief);
    if (seen.has(key)) continue;
    seen.add(key);
    students.push(brief);
  }
  if (students.length === 0) return null;

  students.sort(
    (a, b) =>
      toSortNumber(a.className) - toSortNumber(b.className) ||
      toSortNumber(a.number) - toSortNumber(b.number),
  );

  // 반별로 시트를 나눕니다.
  const byClass = new Map<string, StudentBrief[]>();
  for (const student of students) {
    const bucket = byClass.get(student.className);
    if (bucket) bucket.push(student);
    else byClass.set(student.className, [student]);
  }

  const workbook = new ExcelJS.Workbook();
  const lastColumn = columns.length + 1;

  for (const [className, classStudents] of byClass) {
    const sheet = workbook.addWorksheet(`${className}반`);
    sheet.pageSetup.margins = {
      left: 0.25,
      right: 0.25,
      top: 0.75,
      bottom: 0.75,
      header: 0.3,
      footer: 0.3,
    };

    let currentRow = 1;

    for (const student of classStudents) {
      const key = studentKeyOf(student);

      for (const copyType of COPY_TYPES) {
        const titleRow = currentRow;
        const headDateRow = currentRow + 1;
        const headPeriodRow = currentRow + 2;
        const subjectRow = currentRow + 3;
        const roomRow = currentRow + 4;
        const seatRow = currentRow + 5;

        const title = sheet.getCell(titleRow, 1);
        title.value =
          `<${group.name} 개인시간표(${copyType})>     ` +
          `학번: ${student.className}반 ${student.number}번     이름: ${student.name}`;
        title.font = { bold: true, size: 12 };
        sheet.mergeCells(titleRow, 1, titleRow, lastColumn);

        const divider = sheet.getCell(headDateRow, 1);
        divider.value = '구분';
        divider.alignment = CENTER_WRAP;
        divider.border = THIN_BORDER;
        divider.font = { bold: true };
        sheet.mergeCells(headDateRow, 1, headPeriodRow, 1);

        // 날짜 머리글 — 그 날 교시 수만큼 가로로 병합합니다.
        let column = 2;
        for (const { date, span } of daySpans) {
          const cell = sheet.getCell(headDateRow, column);
          cell.value = formatDateHeader(date);
          cell.alignment = CENTER_WRAP;
          cell.font = { bold: true };
          sheet.mergeCells(headDateRow, column, headDateRow, column + span - 1);
          // 병합된 칸도 하나하나 테두리를 둘러야 인쇄했을 때 선이 이어집니다.
          for (let i = column; i < column + span; i += 1) {
            sheet.getCell(headDateRow, i).border = THIN_BORDER;
          }
          column += span;
        }

        // 교시 머리글
        column = 2;
        for (const { period } of columns) {
          const time = group.periodTimes[period] ?? '';
          const cell = sheet.getCell(headPeriodRow, column);
          cell.value = time ? `${periodLabel(period)}\n${time}` : periodLabel(period);
          cell.alignment = CENTER_WRAP;
          cell.border = THIN_BORDER;
          cell.font = { bold: true };
          column += 1;
        }

        sheet.getRow(headPeriodRow).height = 35;
        sheet.getRow(subjectRow).height = 40;
        sheet.getRow(roomRow).height = 30;
        sheet.getRow(seatRow).height = 25;

        LABELS.forEach((label, i) => {
          const cell = sheet.getCell(subjectRow + i, 1);
          cell.value = label;
          cell.alignment = CENTER_WRAP;
          cell.border = THIN_BORDER;
          cell.font = { bold: true };
        });

        column = 2;

        for (const { period, day } of columns) {
          const date = group.dates[day] ?? '';
          const periodText = periodLabel(period);
          const slot = `${date} ${periodText}`;
          const exam = examLookup.get(`${key}_${date}_${periodText}`);

          let subject: string;
          let room: string;
          let seat: string | number;

          if (exam) {
            subject = exam.subject;
            room = exam.room;
            seat = exam.seat;
          } else {
            subject = '자습';
            room = studyLookup.get(key)?.get(slot) ?? '';
            // 그 자습실 안에서 학번순으로 매긴 번호. 통합 자습명단의 순번과 같습니다.
            seat = room
              ? (studySeats.get(
                  `${slot}|${room}|${makeRosterKey(student.className, student.number, student.name)}`,
                ) ?? '')
              : '';
          }

          [subject, room, seat].forEach((value, i) => {
            const cell = sheet.getCell(subjectRow + i, column);
            cell.value = value;
            cell.alignment = CENTER_WRAP;
            cell.border = THIN_BORDER;
          });

          column += 1;
        }

        currentRow += 7;

        if (copyType === '담임보관용') {
          const dash = sheet.getCell(currentRow, 1);
          dash.value = DASHED_LINE;
          dash.alignment = CENTER_WRAP;
          sheet.mergeCells(currentRow, 1, currentRow, lastColumn);
          currentRow += 2;
        } else {
          // 학생마다 새 쪽에서 시작하도록 끊습니다.
          sheet.getRow(currentRow - 1).addPageBreak();
        }
      }
    }

    for (let c = 1; c <= lastColumn; c += 1) {
      const values: string[] = [];
      sheet.getColumn(c).eachCell({ includeEmpty: false }, (cell) => {
        if (cell.value !== null && cell.value !== undefined) {
          values.push(String(cell.value));
        }
      });
      sheet.getColumn(c).width = columnWidth(values);
    }
  }

  return workbook;
}

/** 개인별 시간표를 내려받습니다. 브라우저에서만 호출하세요. */
export async function downloadIndividualTimetable(
  group: GradeGroup,
  excludedKeys: ReadonlySet<StudentKey> = new Set(),
): Promise<boolean> {
  const workbook = await buildIndividualWorkbook(group, excludedKeys);
  if (!workbook) return false;

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${group.name}_개인시간표.xlsx`,
  );
  return true;
}
