/**
 * 학년 통합 자습 명단 — 구 버전 `generate_grade_study_excel()`(excel_logic.py:1394-1608)의 이식본.
 *
 * 교시마다 시트를 하나씩 만들고, 자습실을 가로로 늘어놓습니다.
 * 감독 선생님이 교실 앞에 붙여 두고 출석을 확인하는 용도라 서식이 까다롭습니다.
 *
 *        A        B      C       D      E
 *   1          [  2-5  ]     [  2-6  ]      ← 자습실명 (2칸 병합)
 *   2  순번    학번   이름    학번   이름
 *   3   1      10103  홍길동  10201  김철수
 *   …
 *   n  총원    [  14  ]      [  13  ]       ← 인원 (2칸 병합)
 *
 * 이 출력은 `format.ts`의 공통 서식을 쓰지 않습니다. 구 버전이 여기만 다른 색과
 * 고정 열 너비를 쓰기 때문입니다.
 */

import ExcelJS from 'exceljs';
import { buildStudentNumber, periodLabel } from '../domain/normalize';
import type { GradeGroup, StudyAssignment } from '../domain/types';
import { triggerDownload } from './exportResults';
import { safeSheetName } from './format';

const HEADER_FILL = 'FFE8F0FE';
const SUB_HEADER_FILL = 'FFF1F3F4';
const SUM_FILL = 'FFF8F9FA';

const THIN_BORDER = {
  top: { style: 'thin' as const },
  left: { style: 'thin' as const },
  bottom: { style: 'thin' as const },
  right: { style: 'thin' as const },
};

const CENTER = { horizontal: 'center' as const, vertical: 'middle' as const };

interface StudyStudent {
  hakbun: string;
  name: string;
}

/** 자습실 이름 안의 첫 숫자로 정렬합니다. 숫자가 없으면 맨 뒤로 보냅니다. */
function roomSortKey(room: string): number {
  const m = String(room).match(/(\d+)/);
  return m ? Number(m[1]) : 999;
}

/** 시트 이름: `2026-06-23` + `2교시` → `6월 23일 2교시` */
function sheetTitleFor(date: string, period: string): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return `${date} ${period}`;
  return `${Number(m[2])}월 ${Number(m[3])}일 ${period}`;
}

/**
 * 시트를 만들 교시를 고릅니다.
 * **시간표에 무언가 적힌 교시만** 대상입니다 — 구 버전과 같은 조건이라,
 * 시간표가 빈 교시에 자습을 배정해 두었더라도 이 명단에는 나오지 않습니다.
 */
function validSlots(group: GradeGroup): Array<[date: string, period: string]> {
  const slots: Array<[string, string]> = [];

  for (let day = 0; day < group.numDays; day += 1) {
    const date = String(group.dates[day] ?? '').trim();
    if (!date) continue;

    for (let p = 0; p < group.numPeriods; p += 1) {
      if ((group.timetable[p]?.[day] ?? '').trim()) {
        slots.push([date, periodLabel(p)]);
      }
    }
  }

  return slots.sort(
    ([dateA, periodA], [dateB, periodB]) =>
      (dateA < dateB ? -1 : dateA > dateB ? 1 : 0) ||
      (Number(periodA.match(/\d+/)?.[0] ?? 0) - Number(periodB.match(/\d+/)?.[0] ?? 0)),
  );
}

/** 자습실별로 학생을 묶고 학번순으로 정렬합니다. */
function groupByRoom(
  assignments: StudyAssignment[],
  gradePrefix: string,
): Map<string, StudyStudent[]> {
  const byRoom = new Map<string, StudyStudent[]>();

  for (const a of assignments) {
    const room = String(a.room ?? '').trim();
    if (!room) continue;

    const student: StudyStudent = {
      hakbun: buildStudentNumber(gradePrefix, a.className, a.number),
      name: String(a.name ?? '').trim(),
    };
    const bucket = byRoom.get(room);
    if (bucket) bucket.push(student);
    else byRoom.set(room, [student]);
  }

  for (const students of byRoom.values()) {
    students.sort((a, b) => (a.hakbun < b.hakbun ? -1 : a.hakbun > b.hakbun ? 1 : 0));
  }

  return byRoom;
}

function styleCell(
  cell: ExcelJS.Cell,
  options: { bold?: boolean; fill?: string } = {},
): void {
  cell.alignment = CENTER;
  cell.border = THIN_BORDER;
  if (options.bold) cell.font = { bold: true };
  if (options.fill) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: options.fill } };
  }
}

/**
 * 학년 통합 자습 명단 워크북을 만듭니다.
 * 자습 학생이 한 명도 없는 교시는 시트를 만들지 않고, 시트가 하나도 없으면 `null`입니다.
 */
export async function buildStudyListWorkbook(
  group: GradeGroup,
): Promise<ExcelJS.Workbook | null> {
  if (group.studyAssignments.length === 0) return null;

  const workbook = new ExcelJS.Workbook();

  for (const [date, period] of validSlots(group)) {
    const slot = `${date} ${period}`;
    const assignments = group.studyAssignments.filter((a) => a.timeSlot === slot);
    if (assignments.length === 0) continue;

    const byRoom = groupByRoom(assignments, group.gradePrefix);
    const rooms = [...byRoom.keys()].sort((a, b) => roomSortKey(a) - roomSortKey(b));
    if (rooms.length === 0) continue;

    const sheet = workbook.addWorksheet(safeSheetName(sheetTitleFor(date, period)));

    // 1행 — 자습실 이름을 2칸씩 병합해 얹습니다.
    rooms.forEach((room, index) => {
      const start = 2 + index * 2;
      sheet.mergeCells(1, start, 1, start + 1);
      sheet.getCell(1, start).value = room;
      styleCell(sheet.getCell(1, start), { bold: true, fill: HEADER_FILL });
      styleCell(sheet.getCell(1, start + 1), { fill: HEADER_FILL });
    });

    // 2행 — 머리글
    sheet.getCell(2, 1).value = '순번';
    styleCell(sheet.getCell(2, 1), { bold: true, fill: SUB_HEADER_FILL });
    rooms.forEach((_, index) => {
      const start = 2 + index * 2;
      sheet.getCell(2, start).value = '학번';
      sheet.getCell(2, start + 1).value = '이름';
      styleCell(sheet.getCell(2, start), { bold: true, fill: SUB_HEADER_FILL });
      styleCell(sheet.getCell(2, start + 1), { bold: true, fill: SUB_HEADER_FILL });
    });

    // 3행부터 — 자습실을 가로로 나란히, 짧은 쪽은 빈칸으로 채웁니다.
    const maxLength = Math.max(...rooms.map((room) => byRoom.get(room)!.length));

    for (let i = 0; i < maxLength; i += 1) {
      const rowIndex = 3 + i;
      sheet.getCell(rowIndex, 1).value = i + 1;
      styleCell(sheet.getCell(rowIndex, 1));

      rooms.forEach((room, index) => {
        const start = 2 + index * 2;
        const student = byRoom.get(room)![i];
        sheet.getCell(rowIndex, start).value = student ? student.hakbun : '';
        sheet.getCell(rowIndex, start + 1).value = student ? student.name : '';
        styleCell(sheet.getCell(rowIndex, start));
        styleCell(sheet.getCell(rowIndex, start + 1));
      });
    }

    // 마지막 행 — 자습실별 총원
    const sumRow = 3 + maxLength;
    sheet.getCell(sumRow, 1).value = '총원';
    styleCell(sheet.getCell(sumRow, 1), { bold: true, fill: SUM_FILL });

    rooms.forEach((room, index) => {
      const start = 2 + index * 2;
      sheet.mergeCells(sumRow, start, sumRow, start + 1);
      sheet.getCell(sumRow, start).value = byRoom.get(room)!.length;
      styleCell(sheet.getCell(sumRow, start), { bold: true, fill: SUM_FILL });
      styleCell(sheet.getCell(sumRow, start + 1), { fill: SUM_FILL });
    });

    sheet.getColumn(1).width = 8;
    for (let c = 2; c < 2 + rooms.length * 2; c += 1) {
      sheet.getColumn(c).width = 12;
    }
  }

  return workbook.worksheets.length > 0 ? workbook : null;
}

/** 학년 통합 자습 명단을 내려받습니다. 브라우저에서만 호출하세요. */
export async function downloadStudyList(group: GradeGroup): Promise<boolean> {
  const workbook = await buildStudyListWorkbook(group);
  if (!workbook) return false;

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${group.name}_통합_자습명단.xlsx`,
  );
  return true;
}
