/**
 * 명단 엑셀 읽기.
 *
 * 구 버전 `load_excels()`를 옮긴 것입니다. pandas의 `read_excel(path, header=1)`이
 * 하던 일을 ExcelJS로 직접 합니다.
 *
 * 파일은 브라우저에서 ArrayBuffer로 읽으므로 서버로 전송되지 않습니다.
 */

import ExcelJS from 'exceljs';
import {
  REQUIRED_COLUMNS,
  ROSTER_HEADER_ROW_INDEX,
} from '../domain/constants';
import { getSubjectName, normalizeSubjectKey } from '../domain/normalize';
import type { StudentRecord } from '../domain/types';

export interface ParsedRoster {
  /** 학년 이름 (예: "1학년"). 추출 실패 시 파일명을 씁니다. */
  groupName: string;
  records: StudentRecord[];
}

export interface ParseRosterResult {
  rosters: ParsedRoster[];
  /** 파일 단위로 발생한 오류. 한 파일이 실패해도 나머지는 계속 읽습니다. */
  errors: string[];
}

/** 엑셀 셀 값을 표시용 문자열로 만듭니다. 수식·리치텍스트·날짜를 모두 다룹니다. */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((t) => t.text).join('').trim();
    }
    if ('text' in value && typeof value.text === 'string') return value.text.trim();
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
    if ('formula' in value) return '';
  }
  return String(value).trim();
}

/** 시트의 첫 워크시트를 헤더 + 데이터 행 배열로 펼칩니다. */
function readSheet(worksheet: ExcelJS.Worksheet): {
  headers: string[];
  rows: string[][];
} {
  const table: string[][] = [];
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const values: string[] = [];
    // ExcelJS의 row.values는 1-based라 index 0이 비어 있습니다.
    const raw = row.values as ExcelJS.CellValue[];
    for (let c = 1; c < raw.length; c += 1) {
      values.push(cellText(raw[c]));
    }
    table.push(values);
  });

  const headers = (table[ROSTER_HEADER_ROW_INDEX] ?? []).map((h) => h.trim());
  const rows = table
    .slice(ROSTER_HEADER_ROW_INDEX + 1)
    .filter((r) => r.some((cell) => cell !== ''));

  return { headers, rows };
}

/**
 * 엑셀 파일 하나를 학년 명단으로 파싱합니다.
 *
 * 학년 이름은 구 버전과 동일하게 **첫 데이터 행의 3번째 열**에서 숫자를 뽑아 정합니다
 * (`df.iloc[0, 2]`). 나이스 명단에서 이 자리가 학년 열이기 때문입니다.
 * 숫자를 못 찾으면 확장자를 뗀 파일명을 그대로 씁니다.
 */
export async function parseRosterFile(file: File): Promise<ParsedRoster> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('시트를 찾을 수 없습니다.');

  const { headers, rows } = readSheet(worksheet);

  const missing = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
  if (missing.length > 0) {
    throw new Error(`필수 열 누락: ${missing.join(', ')}`);
  }
  if (rows.length === 0) {
    throw new Error('데이터 행이 없습니다.');
  }

  const colIndex = (name: string) => headers.indexOf(name);
  const idx = {
    className: colIndex('반'),
    number: colIndex('번호'),
    name: colIndex('성명'),
    courseTitle: colIndex('개설과목(학점)'),
    courseRoom: colIndex('개설강의실'),
  };

  const records: StudentRecord[] = rows.map((row) => {
    const courseTitle = row[idx.courseTitle] ?? '';
    const subject = getSubjectName(courseTitle);

    const extra: Record<string, string> = {};
    headers.forEach((header, i) => {
      if (!header) return;
      if (Object.values(idx).includes(i)) return;
      extra[header] = row[i] ?? '';
    });

    return {
      className: row[idx.className] ?? '',
      number: row[idx.number] ?? '',
      name: row[idx.name] ?? '',
      courseTitle,
      subject,
      subjectKey: normalizeSubjectKey(subject),
      courseRoom: row[idx.courseRoom] ?? '',
      extra,
    };
  });

  const gradeCell = rows[0]?.[2] ?? '';
  const gradeMatch = gradeCell.match(/(\d+)/);
  const groupName = gradeMatch
    ? `${gradeMatch[1]}학년`
    : file.name.replace(/\.[^.]+$/, '');

  return { groupName, records };
}

/** 여러 파일을 한 번에 읽습니다. 실패한 파일은 errors에 모아 돌려줍니다. */
export async function parseRosterFiles(files: File[]): Promise<ParseRosterResult> {
  const rosters: ParsedRoster[] = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      rosters.push(await parseRosterFile(file));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push(`'${file.name}' ${message}`);
    }
  }

  return { rosters, errors };
}
