// 학생 명단 — 입학년도별로 누적해 관리하는 전교생 명단.
// 한 학생(행)에 1·2·3학년 때의 학번을 칸으로 쌓아 두면, 해마다 명단을 올릴 때마다 칸이 채워지고
// 학번이 바뀌어도 같은 학생으로 이어 붙일 수 있습니다. 상태(재학·전출·퇴학·전입)로 제외·추가를 관리합니다.
//
// 학년 계산: 작업 학년도 W(수강신청을 받는 해, 예: 2027)에서 올해(= W-1학년도) 학번의 첫 글자가 학년 g 이면
// 입학년도는 W - g 입니다(W=2027, 현 1학년 → 2026 입학).

import * as XLSX from "xlsx-js-style";
import { isStudentId, type PromotionEntry } from "../../main-survey/lib/promotion";

export type StudentStatus = "재학" | "전출" | "퇴학" | "전입";
export const STUDENT_STATUSES: StudentStatus[] = ["재학", "전출", "퇴학", "전입"];
/** 모든 탭에서 빠지는 상태 */
export const isExcluded = (s: { status: StudentStatus }) => s.status === "전출" || s.status === "퇴학";

export interface RosterStudent {
  /** 상태 변경·삭제용 고유 번호(학번이 바뀌어도 같은 학생) */
  key: string;
  /** 입학년도 */
  cohort: number;
  name: string;
  /** 학년별 학번(누적). ids[1] = 1학년 때 학번 … */
  ids: { 1?: string; 2?: string; 3?: string };
  status: StudentStatus;
}

export interface ParsedRosterRow {
  oldId: string;
  newId: string;
  name: string;
}

export interface ParseRosterResult {
  rows: ParsedRosterRow[];
  /** 읽은 시트 이름들 */
  sheets: string[];
  /** 학번이 숫자 4자리 이상이 아니라 건너뛴 줄 수(빈 줄 제외) */
  skipped: number;
}

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** 학번 첫 글자 = 학년(1~3). 아니면 0. */
export const gradeOfId = (id: string): number => {
  const g = Number(id[0]);
  return g >= 1 && g <= 3 ? g : 0;
};

/** 올해(W-1학년도) 학번 oldId → 입학년도 */
export const cohortOfOldId = (oldId: string, workYear: number): number => workYear - gradeOfId(oldId);

/** 작업 학년도에서 본 입학년도의 학년(올해 기준): 1·2·3. 0 이하 = 아직 입학 전(예비 1학년), 4 이상 = 졸업 */
export const currentGradeOfCohort = (cohort: number, workYear: number): number => workYear - cohort;

// ───────── 읽기 ─────────

const cellStr = (v: unknown) => String(v ?? "").trim();

/** 한 시트의 행들 → 이전학번·진급학번·이름. 머리글이 있으면 이름으로 열을 찾고, 없으면 이 순서로 읽는다. */
function rowsOfSheet(rows: unknown[][]): { out: ParsedRosterRow[]; skipped: number } {
  let oc = 0, nc = 1, pc = 2;
  let start = 0;
  for (let r = 0; r < Math.min(6, rows.length); r++) {
    const row = rows[r] ?? [];
    const texts = row.map(cellStr);
    const hasId = texts.some((t) => t.includes("학번"));
    const hasName = texts.some((t) => /이름|성명/.test(t));
    if (hasId && hasName) {
      texts.forEach((t, i) => {
        if (/이전|기존|현재|옛/.test(t) && t.includes("학번")) oc = i;
        else if (/진급|변경|새|신/.test(t) && t.includes("학번")) nc = i;
        else if (/이름|성명/.test(t)) pc = i;
      });
      start = r + 1;
      break;
    }
  }
  const out: ParsedRosterRow[] = [];
  let skipped = 0;
  for (let r = start; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const oldId = cellStr(row[oc]);
    const newRaw = cellStr(row[nc]);
    const name = cellStr(row[pc]);
    if (!oldId && !newRaw && !name) continue;
    if (!isStudentId(oldId)) { skipped++; continue; }
    out.push({ oldId, newId: isStudentId(newRaw) ? newRaw : "", name });
  }
  return { out, skipped };
}

/** 엑셀·CSV 파일: 모든 시트를 읽는다(학년별로 시트가 나뉘어 있어도 됨). */
export function parseRosterWorkbook(buf: ArrayBuffer): ParseRosterResult {
  const wb = XLSX.read(buf, { type: "array" });
  const rows: ParsedRosterRow[] = [];
  const sheets: string[] = [];
  let skipped = 0;
  for (const name of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1 });
    const r = rowsOfSheet(grid);
    if (r.out.length) sheets.push(name);
    rows.push(...r.out);
    skipped += r.skipped;
  }
  return { rows, sheets, skipped };
}

/** 붙여넣은 글: 줄마다 "이전학번 진급학번 이름"(탭·쉼표·공백 구분). 진급학번이 없으면 "이전학번 이름". */
export function parseRosterText(text: string): ParseRosterResult {
  const grid = text
    .split(/\r?\n/)
    .map((line) => {
      const t = line.trim().split(/[\t,]+|\s+/).filter(Boolean);
      if (t.length < 2) return [] as string[];
      if (t.length >= 3 && isStudentId(t[1])) return [t[0], t[1], t.slice(2).join(" ")];
      return [t[0], "", t.slice(1).join(" ")];
    })
    .filter((r) => r.length);
  const r = rowsOfSheet(grid);
  return { rows: r.out, sheets: [], skipped: r.skipped };
}

// ───────── 누적 병합 ─────────

export interface MergeResult {
  roster: RosterStudent[];
  added: number;
  updated: number;
  /** 학년을 알 수 없는 학번(첫 글자가 1~3이 아님)이라 건너뛴 수 */
  invalid: number;
}

/**
 * 올린 행들을 기존 명단에 누적한다. 같은 입학년도에서 이전학번이 같은 학생은 갱신(진급학번 칸 채움),
 * 없으면 새로 만든다. 상태는 건드리지 않는다.
 */
export function mergeRoster(existing: RosterStudent[], incoming: ParsedRosterRow[], workYear: number): MergeResult {
  const roster = existing.map((s) => ({ ...s, ids: { ...s.ids } }));
  let added = 0, updated = 0, invalid = 0;
  for (const row of incoming) {
    const g = gradeOfId(row.oldId) as 1 | 2 | 3 | 0;
    if (!g) { invalid++; continue; }
    const cohort = workYear - g;
    let s =
      roster.find((x) => x.cohort === cohort && x.ids[g] === row.oldId) ??
      roster.find((x) => x.cohort === cohort && !x.ids[g] && row.name && x.name === row.name);
    if (!s) {
      s = { key: newKey(), cohort, name: row.name, ids: {}, status: "재학" };
      roster.push(s);
      added++;
    } else {
      updated++;
    }
    s.ids[g] = row.oldId;
    if (row.name) s.name = row.name;
    if (row.newId && g < 3) s.ids[(g + 1) as 2 | 3] = row.newId;
  }
  return { roster, added, updated, invalid };
}

/** 전입생 한 명 추가: 올해 학번(첫 글자가 학년)과 이름. 진급학번은 있으면 같이. */
export function addTransferStudent(
  roster: RosterStudent[],
  input: { name: string; oldId: string; newId?: string },
  workYear: number,
): { roster: RosterStudent[]; error?: string } {
  const name = input.name.trim();
  const oldId = input.oldId.trim();
  const newId = (input.newId ?? "").trim();
  if (!name) return { roster, error: "이름을 입력해 주세요." };
  if (!isStudentId(oldId) || !gradeOfId(oldId)) return { roster, error: "학번은 숫자 4자리 이상이고 첫 글자가 학년(1~3)이어야 합니다." };
  if (newId && !isStudentId(newId)) return { roster, error: "진급학번은 숫자 4자리 이상이어야 합니다." };
  const g = gradeOfId(oldId) as 1 | 2 | 3;
  const cohort = workYear - g;
  if (roster.some((s) => s.cohort === cohort && s.ids[g] === oldId)) return { roster, error: `이미 명단에 있는 학번입니다: ${oldId}` };
  const ids: RosterStudent["ids"] = { [g]: oldId };
  if (newId && g < 3) ids[(g + 1) as 2 | 3] = newId;
  return { roster: [...roster, { key: newKey(), cohort, name, ids, status: "전입" }] };
}

// ───────── 다른 탭이 쓰는 형태로 ─────────

/**
 * 진급 학번 적용(본조사)용 명단 — 올해 학번(ids[g]) → 진급학번(ids[g+1]). 전출·퇴학은 빼고,
 * 올해 학년(g = W - 입학년도)의 쌍만 낸다(지난해 쌍은 올해 설문의 학번과 안 맞으므로).
 */
export function rosterToPromotionEntries(roster: RosterStudent[], workYear: number): PromotionEntry[] {
  const out: PromotionEntry[] = [];
  for (const s of roster) {
    if (isExcluded(s)) continue;
    const g = currentGradeOfCohort(s.cohort, workYear);
    if (g < 1 || g > 2) continue;
    const oldId = s.ids[g as 1 | 2];
    const newId = s.ids[(g + 1) as 2 | 3];
    if (oldId && newId) out.push({ oldId, name: s.name, newId });
  }
  return out;
}

// ───────── 다른 탭의 데이터와 대조 / 제외 ─────────

/** 대조에 쓸 학번: old = 올해(이전) 학번, new = 진급 학번 */
export type IdBasis = "old" | "new";
export interface FileStudent {
  id: string;
  name: string;
}

/** 학생의 학번을 기준(old/new)에 맞춰 꺼낸다. 예비 1학년(입학 예정)은 1학년 학번 칸을 쓴다. */
export function idOfStudent(s: RosterStudent, basis: IdBasis, workYear: number): string | undefined {
  const g = currentGradeOfCohort(s.cohort, workYear);
  let slot = g <= 0 ? 1 : basis === "old" ? g : g + 1;
  if (slot < 1) slot = 1;
  return slot > 3 ? undefined : s.ids[slot as 1 | 2 | 3];
}

export interface ReconcileResult {
  /** 이 입학년도 명단이 있는가(없으면 대조하지 않음) */
  hasRoster: boolean;
  matched: number;
  /** 명단(재학·전입)에 있는데 파일에 없음 */
  missing: RosterStudent[];
  /** 파일에는 있는데 명단에 없음 */
  unknown: FileStudent[];
  /** 전출·퇴학으로 표시했는데 파일에 있음(다른 탭 계산에서는 빠집니다) */
  excludedInFile: { file: FileStudent; student: RosterStudent }[];
  /** 학번은 같은데 이름이 다름 */
  nameMismatch: { file: FileStudent; student: RosterStudent }[];
  /** 이 기준 학번이 명단에 비어 있어 대조할 수 없는 학생 */
  noId: RosterStudent[];
}

const normName = (s: string) => s.replace(/\s+/g, "");

/** 파일(탭이 가진 학생들)과 명단을 대조한다. cohort = 그 학년 화면의 입학년도 */
export function reconcileRoster(
  roster: RosterStudent[],
  files: FileStudent[],
  cohort: number,
  basis: IdBasis,
  workYear: number,
): ReconcileResult {
  const inCohort = roster.filter((s) => s.cohort === cohort);
  const res: ReconcileResult = { hasRoster: inCohort.length > 0, matched: 0, missing: [], unknown: [], excludedInFile: [], nameMismatch: [], noId: [] };
  if (!inCohort.length) return res;
  const byId = new Map<string, RosterStudent>();
  for (const s of inCohort) {
    const id = idOfStudent(s, basis, workYear);
    if (id) byId.set(id, s);
    else res.noId.push(s);
  }
  const seen = new Set<string>();
  for (const f of files) {
    const s = byId.get(f.id);
    if (!s) {
      res.unknown.push(f);
      continue;
    }
    seen.add(s.key);
    if (isExcluded(s)) res.excludedInFile.push({ file: f, student: s });
    else if (s.name && f.name && normName(s.name) !== normName(f.name)) res.nameMismatch.push({ file: f, student: s });
    else res.matched++;
  }
  res.missing = inCohort.filter((s) => !isExcluded(s) && !seen.has(s.key) && idOfStudent(s, basis, workYear));
  return res;
}

/** 설문 원본 행들 → 대조용 학생 목록(빈 줄·합계 줄 제외). 학번은 지금 행에 적힌 값 그대로(진급 적용 후면 진급학번). */
export function fileStudentsFromRows(rows: Record<string, unknown>[]): FileStudent[] {
  const out: FileStudent[] = [];
  for (const r of rows) {
    const idKey = Object.keys(r).find((k) => k.includes("학번"));
    const nameKey = Object.keys(r).find((k) => k.includes("이름") || k.includes("성명"));
    const id = idKey ? String(r[idKey] ?? "").trim() : "";
    const name = nameKey ? String(r[nameKey] ?? "").trim() : "";
    if ((!id && !name) || /합계|총계/.test(id + name)) continue;
    out.push({ id, name });
  }
  return out;
}

/** 전출·퇴학 학생의 모든 학번(어느 학년 때 것이든) — 탭의 학생 행을 걸러낼 때 쓴다 */
export function excludedIdSet(roster: RosterStudent[]): Set<string> {
  const out = new Set<string>();
  for (const s of roster) {
    if (!isExcluded(s)) continue;
    Object.values(s.ids).forEach((id) => id && out.add(id));
  }
  return out;
}

/** 설문 원본 행이 제외 학생의 것인지(진급 적용 전후 학번 모두 확인) */
export function isExcludedRow(row: Record<string, unknown>, excluded: ReadonlySet<string>): boolean {
  if (excluded.size === 0) return false;
  const idKey = Object.keys(row).find((k) => k.includes("학번"));
  const cur = idKey ? String(row[idKey] ?? "").trim() : "";
  const old = row.__oldId ? String(row.__oldId).trim() : "";
  return (!!cur && excluded.has(cur)) || (!!old && excluded.has(old));
}

export interface CohortSummary {
  cohort: number;
  total: number;
  active: number;
  excluded: number;
  transferred: number;
}

export function summarizeByCohort(roster: RosterStudent[]): CohortSummary[] {
  const map = new Map<number, CohortSummary>();
  for (const s of roster) {
    const c = map.get(s.cohort) ?? { cohort: s.cohort, total: 0, active: 0, excluded: 0, transferred: 0 };
    c.total++;
    if (isExcluded(s)) c.excluded++;
    else c.active++;
    if (s.status === "전입") c.transferred++;
    map.set(s.cohort, c);
  }
  return [...map.values()].sort((a, b) => b.cohort - a.cohort);
}

/** 저장 파일에서 읽은 값을 안전하게 명단으로(모양이 맞지 않는 항목은 버린다). */
export function sanitizeRoster(raw: unknown): RosterStudent[] {
  if (!Array.isArray(raw)) return [];
  const out: RosterStudent[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Partial<RosterStudent>;
    if (typeof o.cohort !== "number" || typeof o.name !== "string") continue;
    const ids: RosterStudent["ids"] = {};
    ([1, 2, 3] as const).forEach((g) => {
      const v = o.ids?.[g];
      if (typeof v === "string" && v) ids[g] = v;
    });
    out.push({
      key: typeof o.key === "string" && o.key ? o.key : newKey(),
      cohort: o.cohort,
      name: o.name,
      ids,
      status: STUDENT_STATUSES.includes(o.status as StudentStatus) ? (o.status as StudentStatus) : "재학",
    });
  }
  return out;
}
