// 트레이에 담긴 항목들을 보강원 서식의 줄로 바꿉니다.
//
// 여기서 하는 일이 두 가지입니다.
//  1) 요일 → 실제 날짜 계산. 시간표에는 "화요일 2교시"만 있고 달력 날짜가 없는데,
//     날짜 없는 보강원은 결재가 안 나므로 사용자가 고른 기준일이 속한 주에서 뽑아냅니다.
//  2) 결강일별로 장 나누기. 서식에 "하루에 한 장씩 기재해 주십시오"라고 적혀 있습니다.
//
// 교체를 어떻게 적는지는 `types.ts`의 표 그림을 보세요 — **한 줄**입니다.

import type { ClassSlot, MakeupDoc, MakeupEntry, MakeupRow, MakeupSheet } from "./types";

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

/**
 * 항목의 결강일 — 사용자가 고쳤으면 그 값, 아니면 기준일에서 계산.
 *
 * 매개변수 타입을 `MakeupEntry` 전체가 아니라 필요한 필드만(Pick)으로 받습니다 —
 * 트레이 충돌 판정(useMakeupTray.ts)이 아직 id 없는 새 항목(Omit<MakeupEntry,"id">)에도
 * 이 함수를 그대로 써야 해서, id 유무와 무관하게 구조적으로 맞으면 넘길 수 있어야 합니다.
 */
export function absentDateOf(entry: Pick<MakeupEntry, "absent" | "absentDateOverride">, baseDate: string): string {
  return entry.absentDateOverride || dateForWeekday(baseDate, entry.absent.day);
}

/** 항목의 교체일 — 교체가 아니면 빈 문자열. (타입 이유는 absentDateOf 주석 참고) */
export function exchangeDateOf(entry: Pick<MakeupEntry, "exchange" | "exchangeDateOverride">, baseDate: string): string {
  if (!entry.exchange) return "";
  return entry.exchangeDateOverride || dateForWeekday(baseDate, entry.exchange.day);
}

const className = (slot: ClassSlot) => `${slot.grade}-${slot.classNum}`;

/**
 * 트레이 항목 하나를 서식의 한 줄로.
 *
 * 왼쪽 세 칸은 결강하는 내 수업이고, 교체라면 "교체대상" 칸에 내가 대신 갈 상대 수업이
 * 들어갑니다. 보강은 맞바꿈이 없으므로 교체대상 칸을 비웁니다("수업 교체의 경우만 기재").
 */
export function rowForEntry(entry: MakeupEntry, baseDate: string): MakeupRow {
  const row: MakeupRow = {
    kind: entry.kind,
    subject: entry.absent.subject,
    className: className(entry.absent),
    period: entry.absent.period,
    partnerTeacher: entry.partnerTeacher,
  };

  if (entry.kind === "swap" && entry.exchange) {
    row.exchangeDate = exchangeDateOf(entry, baseDate);
    row.exchangePeriod = entry.exchange.period;
    row.exchangeSubject = entry.exchange.subject;
  }
  return row;
}

/**
 * 트레이를 결강일별로 나눠 장을 만듭니다. 서식이 하루 한 장이기 때문입니다.
 * 장은 날짜순, 장 안의 줄은 교시순으로 정렬해야 결재자가 읽기 좋습니다.
 */
export function buildSheets(entries: MakeupEntry[], baseDate: string): MakeupSheet[] {
  const byDate = new Map<string, { entry: MakeupEntry; period: number }[]>();

  for (const entry of entries) {
    const date = absentDateOf(entry, baseDate);
    const bucket = byDate.get(date);
    const item = { entry, period: entry.absent.period };
    if (bucket) bucket.push(item);
    else byDate.set(date, [item]);
  }

  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, items]) => ({
      date,
      rows: items
        .sort((a, b) => a.period - b.period)
        .map(({ entry }) => rowForEntry(entry, baseDate)),
    }));
}

export function buildDoc(params: {
  schoolName: string;
  writerTeacher: string;
  baseDate: string;
  reason: string;
  reasonDetail?: string;
  entries: MakeupEntry[];
}): MakeupDoc {
  return {
    schoolName: params.schoolName,
    writerTeacher: params.writerTeacher,
    reason: params.reason,
    reasonDetail: params.reasonDetail,
    sheets: buildSheets(params.entries, params.baseDate),
    createdAt: new Date().toISOString(),
  };
}

/**
 * entries에 여러 결강 교사가 섞여 있어도 한 번에 처리합니다 — 서식이 "교 사" 한 명 명의로
 * 찍히는 문서라(buildDoc의 writerTeacher가 문서 전체에 하나), 교사별로 먼저 나누고 그 안에서
 * buildDoc을 그대로 재사용해 각자의 문서를 만듭니다. 결과는 교사 이름순으로 정렬됩니다.
 *
 * 여러 선생님이 한꺼번에 출장 가는 경우(수학여행 등)처럼, 한 사람이 여러 선생님 몫을
 * 트레이 하나에 같이 담아 처리할 수 있게 하는 게 이 함수의 존재 이유입니다.
 */
export function buildDocs(params: {
  schoolName: string;
  baseDate: string;
  reason: string;
  reasonDetail?: string;
  entries: MakeupEntry[];
}): MakeupDoc[] {
  const byTeacher = new Map<string, MakeupEntry[]>();
  for (const entry of params.entries) {
    const bucket = byTeacher.get(entry.absentTeacher);
    if (bucket) bucket.push(entry);
    else byTeacher.set(entry.absentTeacher, [entry]);
  }

  return [...byTeacher.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "ko"))
    .map(([writerTeacher, entries]) =>
      buildDoc({
        schoolName: params.schoolName,
        writerTeacher,
        baseDate: params.baseDate,
        reason: params.reason,
        reasonDetail: params.reasonDetail,
        entries,
      })
    );
}

/** "2026-08-20" → "2026년 8월 20일(목)" — 문서에 찍히는 형태 */
export function koreanDate(iso: string): string {
  const date = parseDate(iso);
  if (!date) return iso;
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일(${WEEKDAYS[date.getDay()]})`;
}
