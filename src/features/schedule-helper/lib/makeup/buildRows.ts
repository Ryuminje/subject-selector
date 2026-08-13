// 트레이에 담긴 항목들을 보강원 문서의 줄로 바꿉니다.
//
// 여기서 하는 일이 두 가지입니다.
//  1) 요일 → 실제 날짜 계산. 시간표에는 "화요일 2교시"만 있고 달력 날짜가 없는데,
//     날짜 없는 보강원은 결재가 안 나므로 사용자가 고른 기준일이 속한 주에서 뽑아냅니다.
//  2) 교체를 두 줄로 펼치기. 교체는 서로 맞바꾸는 것이라 문서에 두 줄이 나가야 합니다.

import type { ClassSlot, MakeupDoc, MakeupEntry, MakeupRow } from "./types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "YYYY-MM-DD" → Date. `new Date("2026-08-20")`은 UTC로 읽혀 하루가 밀릴 수 있어 직접 조립합니다. */
export function parseDate(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date → "YYYY-MM-DD" (로컬 기준) */
export function formatDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 시간표의 요일 이름("월")을 Date.getDay() 값(1)으로. 못 알아보면 -1. */
export function weekdayIndex(day: string): number {
  return WEEKDAYS.indexOf(day.replace("요일", "").trim());
}

/** 그 날짜의 요일 이름 ("2026-08-20" → "목") */
export function weekdayOf(iso: string): string {
  const date = parseDate(iso);
  return date ? WEEKDAYS[date.getDay()] : "";
}

/**
 * 기준일이 속한 주(월요일 시작)에서 해당 요일의 날짜를 구합니다.
 * 기준일이 목요일이어도 "화요일" 수업은 그 주의 화요일로 잡힙니다 — 결강이 하루에 몰려도
 * 교체 상대의 수업은 다른 요일인 경우가 대부분이라 이 계산이 필요합니다.
 */
export function dateForWeekday(baseIso: string, day: string): string {
  const base = parseDate(baseIso);
  const target = weekdayIndex(day);
  if (!base || target < 0) return "";

  // 월요일을 주의 시작으로 봅니다 (일요일이 0이라 그대로 쓰면 주가 어긋납니다).
  const toMonday = (idx: number) => (idx + 6) % 7;
  const monday = new Date(base);
  monday.setDate(base.getDate() - toMonday(base.getDay()));

  const result = new Date(monday);
  result.setDate(monday.getDate() + toMonday(target));
  return formatDate(result);
}

/** 항목의 결강일 — 사용자가 고쳤으면 그 값, 아니면 기준일에서 계산 */
export function absentDateOf(entry: MakeupEntry, baseDate: string): string {
  return entry.absentDateOverride || dateForWeekday(baseDate, entry.absent.day);
}

/** 항목의 교체일 — 교체가 아니면 빈 문자열 */
export function exchangeDateOf(entry: MakeupEntry, baseDate: string): string {
  if (!entry.exchange) return "";
  return entry.exchangeDateOverride || dateForWeekday(baseDate, entry.exchange.day);
}

const className = (slot: ClassSlot) => `${slot.grade}-${slot.classNum}`;

/**
 * 트레이 항목 하나를 문서 줄로. 보강은 1줄, 교체는 2줄입니다.
 *
 * 교체의 두 번째 줄은 방향이 반대입니다 — 상대의 수업에 내가 들어가는 것이므로
 * from/to가 뒤집힙니다. 이걸 뒤집지 않으면 문서에 같은 사람이 두 번 들어가는
 * 것처럼 찍혀서 결재 단계에서 반려됩니다.
 */
export function rowsForEntry(entry: MakeupEntry, baseDate: string): MakeupRow[] {
  const absentDate = absentDateOf(entry, baseDate);
  const first: MakeupRow = {
    kindLabel: entry.kind === "swap" ? "교체" : "보강",
    date: absentDate,
    weekday: entry.absent.day,
    period: entry.absent.period,
    className: className(entry.absent),
    subject: entry.absent.subject,
    fromTeacher: entry.absentTeacher,
    toTeacher: entry.partnerTeacher,
  };

  if (entry.kind !== "swap" || !entry.exchange) return [first];

  const second: MakeupRow = {
    kindLabel: "교체",
    date: exchangeDateOf(entry, baseDate),
    weekday: entry.exchange.day,
    period: entry.exchange.period,
    className: className(entry.exchange),
    subject: entry.exchange.subject,
    fromTeacher: entry.partnerTeacher,
    toTeacher: entry.absentTeacher,
  };
  return [first, second];
}

export function buildDoc(params: {
  schoolName: string;
  writerTeacher: string;
  baseDate: string;
  reason: string;
  entries: MakeupEntry[];
}): MakeupDoc {
  const rows = params.entries.flatMap((entry) => rowsForEntry(entry, params.baseDate));
  // 날짜 → 교시 순으로 정렬해야 결재자가 읽기 좋습니다.
  rows.sort((a, b) => (a.date === b.date ? a.period - b.period : a.date.localeCompare(b.date)));

  return {
    schoolName: params.schoolName,
    writerTeacher: params.writerTeacher,
    baseDate: params.baseDate,
    reason: params.reason,
    rows,
    createdAt: new Date().toISOString(),
  };
}

/** "2026-08-20" → "2026년 8월 20일(목)" — 문서에 찍히는 형태 */
export function koreanDate(iso: string): string {
  const date = parseDate(iso);
  if (!date) return iso;
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일(${WEEKDAYS[date.getDay()]})`;
}
