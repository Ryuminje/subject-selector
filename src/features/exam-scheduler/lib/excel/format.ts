/**
 * 출력 엑셀 공통 서식 — 구 버전 `format_excel_file()`(excel_logic.py:210-238)의 이식본.
 *
 * 모든 출력물이 같은 모양이어야 하므로 서식은 이 파일 한 곳에서만 정합니다.
 * openpyxl로 하던 일을 ExcelJS로 옮긴 것이라 값(색상 코드, 너비 계산식)을 바꾸면
 * 기존에 뽑아 둔 파일과 모양이 달라집니다.
 */

import type ExcelJS from 'exceljs';

/** 머리글 행 배경색. openpyxl의 `E0F2FA`에 알파를 붙인 값입니다. */
export const HEADER_FILL_ARGB = 'FFE0F2FA';

const THIN_BORDER = {
  top: { style: 'thin' as const },
  left: { style: 'thin' as const },
  bottom: { style: 'thin' as const },
  right: { style: 'thin' as const },
};

/**
 * 셀 값의 표시 폭을 셉니다.
 *
 * 한글은 영문보다 넓으므로 가중치를 다르게 줍니다(구 버전과 같은 1.8 / 1.1).
 * 정확한 계산은 아니지만, 실제 명단에서 열 너비가 어긋나지 않을 만큼은 맞습니다.
 */
export function displayWidth(value: string): number {
  let width = 0;
  for (const char of value) {
    width += char.charCodeAt(0) > 127 ? 1.8 : 1.1;
  }
  return width;
}

/** 열에 들어갈 값들을 보고 너비를 정합니다. 가장 긴 값 + 여유 2. */
export function columnWidthFor(values: readonly string[]): number {
  let max = 0;
  for (const value of values) {
    const width = displayWidth(value);
    if (width > max) max = width;
  }
  return max + 2;
}

/**
 * 시트 전체에 공통 서식을 입힙니다.
 * 모든 셀은 가운데 정렬 + 얇은 테두리, 1행은 배경색, 열 너비는 내용에 맞춰 자동.
 */
export function applySheetFormatting(sheet: ExcelJS.Worksheet): void {
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = THIN_BORDER;
      if (rowNumber === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: HEADER_FILL_ARGB },
        };
      }
    });
  });

  sheet.columns.forEach((column) => {
    const values: string[] = [];
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      if (cell.value !== null && cell.value !== undefined) {
        values.push(String(cell.value));
      }
    });
    column.width = columnWidthFor(values);
  });
}

/** 엑셀 시트 이름 제한(31자)에 맞춰 자릅니다. */
export function safeSheetName(name: string): string {
  return String(name).slice(0, 31);
}
