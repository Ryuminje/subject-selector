/**
 * 통합 시험 시간표 엑셀 — 구 버전 `generate_excel_schedules()`(excel_logic.py:362-380)의 이식본.
 *
 * 학년마다 시트를 하나씩 만들고, 그 학년의 배정 결과를 그대로 적습니다.
 * 이 파일이 시험 감독 배치와 좌석표의 원본이 됩니다.
 */

import ExcelJS from 'exceljs';
import type { GradeGroup, ResultRow, StudentKey } from '../domain/types';
import { buildResults } from '../scheduling/buildResults';
import { applySheetFormatting, safeSheetName } from './format';

/**
 * 출력 열 구성. 구 버전이 내부 계산용 열을 떨어낸 뒤 남긴 것과 같습니다.
 *
 * 구 버전은 명단 엑셀의 열을 그대로 흘려보내고 정해진 몇 개만 버리는 방식이라,
 * 나이스 표준 열(학년도·학기·학년·편제명)이 아닌 열이 명단에 있으면 그것도 출력에
 * 남았습니다. 새 버전은 아래 목록으로 고정합니다.
 */
export const RESULT_COLUMNS = [
  '반',
  '번호',
  '성명',
  '개설과목(학점)',
  '개설강의실',
  '시험교실',
  '좌석번호',
  '과목별',
  '시험시간',
] as const;

/** 결과 한 행을 엑셀 셀 값으로 폅니다. 좌석번호·과목별은 숫자로 씁니다. */
export function toSheetRow(row: ResultRow): (string | number)[] {
  return [
    row.className,
    row.number,
    row.name,
    row.courseTitle,
    row.courseRoom,
    row.examRoom,
    row.seatNo,
    row.subjectSeq,
    row.examTime,
  ];
}

export interface ExportResultsOptions {
  /** 학년 id → 제외 학생 키 */
  excludedKeysByGroup?: Record<string, ReadonlySet<StudentKey>>;
}

/**
 * 학년별 시트를 담은 통합 결과 워크북을 만듭니다.
 * 배정 결과가 하나도 없으면 `null`을 돌려줍니다(빈 파일을 만들지 않기 위함).
 */
export async function buildResultsWorkbook(
  groups: GradeGroup[],
  options: ExportResultsOptions = {},
): Promise<ExcelJS.Workbook | null> {
  const workbook = new ExcelJS.Workbook();
  let wrote = false;

  for (const group of groups) {
    const rows = buildResults(
      group,
      options.excludedKeysByGroup?.[group.id] ?? new Set(),
    );
    if (rows.length === 0) continue;

    const sheet = workbook.addWorksheet(safeSheetName(group.name));
    sheet.addRow([...RESULT_COLUMNS]);
    for (const row of rows) sheet.addRow(toSheetRow(row));
    applySheetFormatting(sheet);
    wrote = true;
  }

  return wrote ? workbook : null;
}

/** 통합 결과 엑셀을 만들어 내려받습니다. 브라우저에서만 호출하세요. */
export async function downloadResultsExcel(
  groups: GradeGroup[],
  fileName = '전체학년_최종_시험시간표.xlsx',
  options: ExportResultsOptions = {},
): Promise<boolean> {
  const workbook = await buildResultsWorkbook(groups, options);
  if (!workbook) return false;

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    fileName,
  );
  return true;
}

/** Blob을 파일로 저장시킵니다. 출력 기능들이 공통으로 씁니다. */
export function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
