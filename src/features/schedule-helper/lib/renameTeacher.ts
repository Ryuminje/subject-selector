// 교사 이름을 바꿀 때 쓰는 순수 함수 모음(DB·React 없음 — 그래서 검증 스크립트로 시험할 수 있습니다).
//
// 왜 이렇게 흩어져 있나: 교사 이름은 Teacher.id 같은 번호가 아니라 **글자 그대로** 여러 곳에
// 저장돼 있습니다(시간표 JSON, 교체 기록, 저장해 둔 보강 세트, 협의회 묶음, 이수증 명단…).
// 한 곳만 바꾸면 나머지가 옛 이름을 가리켜 조용히 어긋나므로, "이름이 들어 있는 모양"마다
// 하나씩 바꾸는 함수를 두고 이름 바꾸기 라우트가 전부 한 트랜잭션에서 부릅니다.

import type { ScheduleRow } from "./sheetData";

/**
 * correct = 이름 정정(오타·개명): 같은 사람이라 설정을 그대로 둡니다.
 * replace = 후임 교체(휴직 대체): 다른 사람이라 교체 불가 요일 같은 개인 설정을 비웁니다.
 */
export type RenameMode = "correct" | "replace";

export interface ScheduleCore {
  teachers: string[];
  days: string[];
  periods: number[];
  tableData: ScheduleRow[];
}

/** 이름 목록에서 from을 to로. to가 이미 있으면 한 번만 남깁니다(순서는 먼저 나온 쪽 기준). */
export function renameInNames(names: string[], from: string, to: string): { names: string[]; changed: number } {
  let changed = 0;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const next = name === from ? to : name;
    if (name === from) changed += 1;
    if (seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return { names: out, changed };
}

/** 시간표 본체. cells는 그 교사 행에 들어 있던 수업 칸 수(영향 미리보기용). */
export function renameInSchedule(core: ScheduleCore, from: string, to: string): { core: ScheduleCore; cells: number } {
  let cells = 0;
  const tableData = core.tableData.map((row) => {
    if (row.teacher !== from) return row;
    cells = Object.entries(row).filter(([key, value]) => key !== "teacher" && value).length;
    return { ...row, teacher: to };
  });
  return {
    core: { ...core, teachers: renameInNames(core.teachers, from, to).names, tableData },
    cells,
  };
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** JSON으로 저장된 이름 배열(`["김A","이B"]`) — blockedTeachers, 협의회 묶음, 이수증 명단. */
export function renameInJsonNames(raw: string | null, from: string, to: string): { raw: string | null; changed: number } {
  if (raw === null) return { raw, changed: 0 };
  const list = parseJson<unknown>(raw, null);
  if (!Array.isArray(list)) return { raw, changed: 0 };
  const result = renameInNames(list.filter((v): v is string => typeof v === "string"), from, to);
  return { raw: result.changed > 0 ? JSON.stringify(result.names) : raw, changed: result.changed };
}

/** 이름이 `absentTeacher`·`partnerTeacher` 필드로 들어 있는 객체 배열 — 교체 기록, 저장된 보강 세트. */
export function renameInTeacherFields(raw: string, from: string, to: string): { raw: string; changed: number } {
  const list = parseJson<unknown>(raw, null);
  if (!Array.isArray(list)) return { raw, changed: 0 };
  let changed = 0;
  const next = list.map((item) => {
    if (!item || typeof item !== "object") return item;
    const entry = { ...(item as Record<string, unknown>) };
    for (const key of ["absentTeacher", "partnerTeacher"]) {
      if (entry[key] === from) {
        entry[key] = to;
        changed += 1;
      }
    }
    return entry;
  });
  return { raw: changed > 0 ? JSON.stringify(next) : raw, changed };
}

/** 서버를 거치지 않고 화면 메모리에만 있는 항목(보강원 트레이)의 교사 이름을 바꿉니다. */
export function renameInEntryObjects<T extends { absentTeacher: string; partnerTeacher: string }>(
  entries: T[],
  from: string,
  to: string,
): T[] {
  return entries.map((entry) => ({
    ...entry,
    absentTeacher: entry.absentTeacher === from ? to : entry.absentTeacher,
    partnerTeacher: entry.partnerTeacher === from ? to : entry.partnerTeacher,
  }));
}

/** `{ 연수 제목: 이름[] }` — 이수증 세션의 연수별 명단. */
export function renameInTitleRosters(raw: string | null, from: string, to: string): { raw: string | null; changed: number } {
  if (raw === null) return { raw, changed: 0 };
  const record = parseJson<unknown>(raw, null);
  if (!record || typeof record !== "object" || Array.isArray(record)) return { raw, changed: 0 };
  let changed = 0;
  const next: Record<string, unknown> = {};
  for (const [title, names] of Object.entries(record as Record<string, unknown>)) {
    if (!Array.isArray(names)) {
      next[title] = names;
      continue;
    }
    const result = renameInNames(names.filter((v): v is string => typeof v === "string"), from, to);
    changed += result.changed;
    next[title] = result.names;
  }
  return { raw: changed > 0 ? JSON.stringify(next) : raw, changed };
}

/**
 * "이름 바꾼 내역"(원래 이름 → 현재 이름)에 이번 변경을 반영합니다.
 * A→B 다음에 B→C를 하면 내역은 A→C 하나로 이어 붙고, 원래 이름으로 되돌리면 항목이 사라집니다.
 */
export function recordRename(rawMap: string, from: string, to: string): string {
  const map = parseJson<Record<string, string>>(rawMap, {});
  const origins = Object.keys(map).filter((key) => map[key] === from);
  if (origins.length === 0) origins.push(from);
  for (const origin of origins) {
    if (origin === to) delete map[origin];
    else map[origin] = to;
  }
  return JSON.stringify(map);
}

/**
 * 새로 업로드한 시간표에 이름 바꾼 내역을 적용합니다. 새 파일에 이미 현재 이름이 있으면(같은 사람이
 * 두 줄이 되므로) 그 항목은 건너뛰고 skipped에 담아 알립니다.
 */
export function applyRenameMap(
  parsed: { teachers: string[]; tableData: ScheduleRow[] },
  rawMap: string,
): { teachers: string[]; tableData: ScheduleRow[]; applied: number; skipped: string[] } {
  const map = parseJson<Record<string, string>>(rawMap, {});
  let teachers = parsed.teachers;
  let tableData = parsed.tableData;
  let applied = 0;
  const skipped: string[] = [];
  for (const [origin, current] of Object.entries(map)) {
    if (!teachers.includes(origin)) continue;
    if (teachers.includes(current)) {
      skipped.push(origin);
      continue;
    }
    teachers = renameInNames(teachers, origin, current).names;
    tableData = tableData.map((row) => (row.teacher === origin ? { ...row, teacher: current } : row));
    applied += 1;
  }
  return { teachers, tableData, applied, skipped };
}

/** 동명이인 확인 때 미리 채워 줄 구분 이름 — "이영희(2)", 그것도 있으면 "(3)". */
export function suggestDistinctName(name: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  for (let n = 2; ; n += 1) {
    const candidate = `${name}(${n})`;
    if (!taken.has(candidate)) return candidate;
  }
}
