/**
 * 문자열 정규화. 구 버전 `excel_logic.py`에서 그대로 옮겨온 순수 함수들입니다.
 *
 * 이 파일의 동작은 기존 결과와 100% 일치해야 합니다. 실제 명단의 표기 흔들림
 * (로마숫자, 공백, 괄호 주석 등)을 오래 겪으며 다듬어진 규칙이라, 개선하고 싶더라도
 * 회귀 테스트 없이는 손대지 마세요.
 */

import { WEEKDAY_LABELS } from './constants';
import type { StudentKey } from './types';

/**
 * 개설과목(학점) → 과목명.
 * 괄호와 그 안의 내용을 지웁니다. "물리학Ⅰ(4)" → "물리학Ⅰ"
 *
 * 원본: `get_subject_name()`
 */
export function getSubjectName(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\(.*?\)/g, '').trim();
}

/** 전각 로마숫자 → ASCII. 같은 과목이 "물리학Ⅰ"과 "물리학I"로 섞여 들어옵니다. */
const ROMAN_NUMERALS: ReadonlyArray<readonly [string, string]> = [
  ['Ⅰ', 'I'],
  ['Ⅱ', 'II'],
  ['Ⅲ', 'III'],
  ['Ⅳ', 'IV'],
  ['Ⅴ', 'V'],
  ['Ⅵ', 'VI'],
];

/**
 * 시간표 칸의 과목명과 명단의 과목명을 맞대보기 위한 비교용 키를 만듭니다.
 * 대문자화 → 공백 제거 → 괄호/대괄호 제거 → 로마숫자 치환 순서를 지켜야 합니다.
 * (괄호를 먼저 지우면 "물리 (4)"처럼 괄호 앞 공백이 남는 경우가 달라집니다.)
 *
 * 원본: `normalize_subject_for_compare()`
 */
export function normalizeSubjectKey(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  let v = String(value).toUpperCase();
  v = v.replace(/\s+/g, '');
  v = v.replace(/\(.*?\)/g, '');
  v = v.replace(/\[.*?\]/g, '');
  for (const [from, to] of ROMAN_NUMERALS) {
    v = v.split(from).join(to);
  }
  return v;
}

/**
 * 강의실 표기를 "학년-반" 형태로 통일합니다.
 * 자습 배정에서 "이 교실이 시험에 쓰이고 있는가"를 판단하는 데 쓰이므로,
 * 표기가 하나로 모이지 않으면 빈 교실 계산이 틀어집니다.
 *
 *   "2학년 1반" → "2-1"
 *   "2-01"      → "2-1"
 *   "1반" / "1" → `${gradePrefix}-1`
 *   그 외        → 원본 문자열 그대로
 *
 * 원본: `normalize_room_for_empty_check()`
 */
export function normalizeRoom(
  roomValue: unknown,
  gradePrefix: string,
): string | null {
  if (roomValue === null || roomValue === undefined || roomValue === '') return null;
  const room = String(roomValue).trim();
  if (!room) return null;

  const gradeClass = room.match(/(\d+)\s*학년\s*(\d+)\s*반/);
  if (gradeClass) {
    return `${gradeClass[1]}-${parseInt(gradeClass[2], 10)}`;
  }

  const dashed = room.match(/(\d+)\s*-\s*(\d+)/);
  if (dashed) {
    return `${dashed[1]}-${parseInt(dashed[2], 10)}`;
  }

  const bareClass = room.match(/^(\d+)\s*반?$/);
  if (bareClass) {
    return `${gradePrefix}-${parseInt(bareClass[1], 10)}`;
  }

  return room;
}

/**
 * 학년 이름에서 교실 번호 접두사를 뽑습니다. "1학년" → "1"
 * 숫자가 없으면 구 버전과 동일하게 "1"로 떨어집니다.
 */
export function extractGradePrefix(groupName: string): string {
  const m = groupName.match(/(\d+)/);
  return m ? m[1] : '1';
}

/** 반/번호에서 숫자만 뽑아 정렬용 값으로 만듭니다. 뽑히지 않으면 0. */
export function toSortNumber(value: unknown): number {
  const m = String(value ?? '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/** "3반" → "3" 처럼 반 표기에서 군더더기를 떼어냅니다. */
export function cleanClassName(value: unknown): string {
  return String(value ?? '').replace(/반/g, '').trim();
}

/** "12번" → "12" 처럼 번호 표기에서 군더더기를 떼어냅니다. */
export function cleanStudentNumber(value: unknown): string {
  return String(value ?? '').replace(/번/g, '').trim();
}

/**
 * 학생을 사람이 읽는 "1반 2번 홍길동" 형태로 표시합니다.
 * 반·번호 값에 이미 "반"/"번"이 붙어 있어도(실제 명단 엑셀에서 흔함) 중복 표기되지
 * 않도록 먼저 떼어내고 다시 붙입니다.
 *
 * 원본: 구 버전이 화면·엑셀에 표시하기 전 `ban = ...replace('반', '')`,
 * `num = ...replace('번', '')`로 항상 정리하던 패턴 (excel_logic.py 여러 곳).
 */
export function formatStudentLabel(
  className: unknown,
  number: unknown,
  name: unknown,
): string {
  return `${cleanClassName(className)}반 ${cleanStudentNumber(number)}번 ${String(name ?? '').trim()}`;
}

/** 학생 식별 키를 만듭니다. 반/번호/성명 세 값으로 한 명을 특정합니다. */
export function makeStudentKey(
  className: unknown,
  number: unknown,
  name: unknown,
): StudentKey {
  return [
    String(className ?? '').trim(),
    String(number ?? '').trim(),
    String(name ?? '').trim(),
  ].join('|');
}

/**
 * 명단 행에서 학생 키를 만듭니다. "3반"/"3", "12번"/"12" 처럼 표기가 흔들려도
 * 같은 키가 나오도록 접미사를 떼고 만듭니다.
 *
 * 분반(`SplitRoom.studentKeys`) 저장과 조회는 **반드시 이 함수를 통해야** 합니다.
 * 양쪽이 다른 방식으로 키를 만들면 분반 학생을 못 찾아 시험실이 빈칸이 됩니다.
 */
export function makeRosterKey(
  className: unknown,
  number: unknown,
  name: unknown,
): StudentKey {
  return makeStudentKey(
    cleanClassName(className),
    cleanStudentNumber(number),
    name,
  );
}

/**
 * 학번을 만듭니다. 학년 1자리 + 반 2자리 + 번호 2자리 (예: 2학년 3반 7번 → `20307`).
 * 명단의 반·번호 표기가 흔들려도 숫자만 뽑아 씁니다.
 *
 * 자습 명단의 정렬 기준이자 개인 시간표의 자습 좌석번호 기준이므로,
 * 두 출력이 어긋나지 않도록 이 함수 하나만 씁니다.
 */
export function buildStudentNumber(
  gradePrefix: string,
  className: unknown,
  number: unknown,
): string {
  const grade = /^\d+$/.test(gradePrefix) ? Number(gradePrefix) : 1;
  const classNo = Number(String(className ?? '').match(/(\d+)/)?.[1] ?? 1);
  const studentNo = Number(String(number ?? '').match(/(\d+)/)?.[1] ?? 1);
  return `${grade}${String(classNo).padStart(2, '0')}${String(studentNo).padStart(2, '0')}`;
}

/** `${date} ${period}` 형태의 교시 슬롯 키. 자습 배정이 이 키로 묶입니다. */
export function makeTimeSlot(date: string, period: string): string {
  return `${date} ${period}`;
}

/** 0-based 교시 인덱스 → "1교시" */
export function periodLabel(periodIndex: number): string {
  return `${periodIndex + 1}교시`;
}

/**
 * 표시용 시험시간을 만듭니다. "2026-06-22" + "3교시" → "6/22(월) 3교시"
 * 날짜 파싱에 실패하면 원본을 그대로 이어붙입니다.
 *
 * 원본: `format_exam_time()`
 */
export function formatExamTime(date: string, period: string): string {
  const dateStr = String(date ?? '').trim();
  const periodStr = String(period ?? '').trim();
  if (!dateStr) return '';

  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return `${dateStr} ${periodStr}`;

  const [, year, month, day] = m;
  const dt = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(dt.getTime())) return `${dateStr} ${periodStr}`;

  // JS의 getDay()는 일요일이 0, 구 버전 Python weekday()는 월요일이 0입니다.
  const weekday = WEEKDAY_LABELS[(dt.getDay() + 6) % 7];
  return `${dt.getMonth() + 1}/${dt.getDate()}(${weekday}) ${periodStr}`;
}

/**
 * 시간표 한 칸("국어/문학")을 과목 비교키 목록으로 펼칩니다.
 * 빈 값은 걸러냅니다.
 */
export function splitTimetableCell(cell: string): string[] {
  return String(cell ?? '')
    .split('/')
    .map(normalizeSubjectKey)
    .filter(Boolean);
}

/**
 * 시간표 칸에 적힌 과목 표기에서 대괄호 코드를 뗍니다. "생활과 윤리[12]" → "생활과 윤리"
 * 시험실 배정 화면에서 시간표 과목 버튼의 표시 이름을 만드는 데 씁니다.
 *
 * 원본: `cleanSubjectName()`
 */
export function stripSubjectCode(value: unknown): string {
  return String(value ?? '')
    .replace(/\s*\[\d+\]/g, '')
    .trim();
}
