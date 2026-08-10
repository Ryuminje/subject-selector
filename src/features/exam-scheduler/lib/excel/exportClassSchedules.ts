/**
 * 학급별 시험 시간표 — 구 버전 `generate_class_excel_schedules()`(excel_logic.py:857-895)의 이식본.
 *
 * 통합 결과와 열 구성은 같고, 시트만 "전체" + 반별로 쪼갭니다.
 * 담임 선생님께 반별로 나눠 드리는 용도입니다.
 */

import ExcelJS from 'exceljs';
import { toSortNumber } from '../domain/normalize';
import type { GradeGroup, StudentKey } from '../domain/types';
import { buildResults } from '../scheduling/buildResults';
import { RESULT_COLUMNS, toSheetRow, triggerDownload } from './exportResults';
import { applySheetFormatting, safeSheetName } from './format';

/**
 * 한 학년의 학급별 워크북을 만듭니다.
 * 배정 결과가 없으면 `null`입니다.
 */
export async function buildClassWorkbook(
  group: GradeGroup,
  excludedKeys: ReadonlySet<StudentKey> = new Set(),
): Promise<ExcelJS.Workbook | null> {
  const rows = buildResults(group, excludedKeys);
  if (rows.length === 0) return null;

  const workbook = new ExcelJS.Workbook();

  const addSheet = (name: string, sheetRows: typeof rows) => {
    const sheet = workbook.addWorksheet(safeSheetName(name));
    sheet.addRow([...RESULT_COLUMNS]);
    for (const row of sheetRows) sheet.addRow(toSheetRow(row));
    applySheetFormatting(sheet);
  };

  addSheet('전체', rows);

  // 반은 숫자로 묶고 정렬합니다. "1반"과 "1"이 섞여 들어와도 한 반으로 모입니다.
  const byClassNumber = new Map<number, typeof rows>();
  for (const row of rows) {
    const key = toSortNumber(row.className);
    const bucket = byClassNumber.get(key);
    if (bucket) bucket.push(row);
    else byClassNumber.set(key, [row]);
  }

  for (const [, classRows] of [...byClassNumber.entries()].sort(([a], [b]) => a - b)) {
    // 시트 이름은 그 반 첫 학생의 표기를 그대로 씁니다.
    addSheet(String(classRows[0].className), classRows);
  }

  return workbook;
}

/** 학급별 시간표 엑셀을 내려받습니다. 브라우저에서만 호출하세요. */
export async function downloadClassSchedules(
  group: GradeGroup,
  excludedKeys: ReadonlySet<StudentKey> = new Set(),
): Promise<boolean> {
  const workbook = await buildClassWorkbook(group, excludedKeys);
  if (!workbook) return false;

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${group.name}_학급별_시험시간표.xlsx`,
  );
  return true;
}
