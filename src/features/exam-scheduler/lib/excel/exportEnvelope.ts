/**
 * 시험지 봉투 표지 `.xls` — 구 버전 `download_envelope_excel()`(excel_logic.py:546-583)의 이식본.
 *
 * **반드시 `.xls`(BIFF8)로 나가야 합니다.** 한글(HWP) 메일머지의 데이터 원본이라,
 * `.xlsx`로 바꾸면 기존 한글 서식 파일이 데이터를 읽지 못합니다.
 * 열 구성(`과목명 | 시험실 | 타임/반`)도 바꾸면 안 됩니다.
 *
 * BIFF8은 ExcelJS가 쓰지 못하므로 이 파일만 SheetJS를 씁니다.
 */

import * as XLSX from 'xlsx';
import type { GradeGroup, StudentKey } from '../domain/types';
import { buildEnvelopeRows } from '../scheduling/envelope';
import { triggerDownload } from './exportResults';

export const ENVELOPE_SHEET_NAME = '시험지봉투표지';
export const ENVELOPE_COLUMNS = ['과목명', '시험실', '타임/반'] as const;

/** 구 버전 xlwt가 쓰던 열 너비. 단위는 문자 폭입니다. */
const COLUMN_WIDTHS = [25, 15, 15];

/**
 * 봉투 표지 워크북을 만듭니다. 표지에 담을 줄이 없으면 `null`입니다.
 *
 * 구 버전은 머리글을 굵게 하고 가운데 정렬했지만, SheetJS 커뮤니티 판은 셀 서식을
 * 쓰지 못합니다. 메일머지는 값만 읽으므로 기능에는 영향이 없습니다.
 */
export function buildEnvelopeWorkbook(
  groups: GradeGroup[],
  excludedKeysByGroup: Record<string, ReadonlySet<StudentKey>> = {},
): XLSX.WorkBook | null {
  const rows = buildEnvelopeRows(groups, excludedKeysByGroup);
  if (rows.length === 0) return null;

  const table = [
    [...ENVELOPE_COLUMNS],
    ...rows.map((row) => [row.subject, row.examRoom, row.timeClass]),
  ];

  const sheet = XLSX.utils.aoa_to_sheet(table);
  sheet['!cols'] = COLUMN_WIDTHS.map((wch) => ({ wch }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, ENVELOPE_SHEET_NAME);
  return workbook;
}

/** 봉투 표지를 `.xls`로 내려받습니다. 브라우저에서만 호출하세요. */
export function downloadEnvelope(
  groups: GradeGroup[],
  excludedKeysByGroup: Record<string, ReadonlySet<StudentKey>> = {},
): boolean {
  const workbook = buildEnvelopeWorkbook(groups, excludedKeysByGroup);
  if (!workbook) return false;

  // biff8이 곧 Excel 97-2003 `.xls`입니다. 한글이 읽을 수 있는 형식입니다.
  const data = XLSX.write(workbook, { bookType: 'biff8', type: 'array' }) as ArrayBuffer;

  triggerDownload(
    new Blob([data], { type: 'application/vnd.ms-excel' }),
    '시험지_봉투_표지.xls',
  );
  return true;
}
