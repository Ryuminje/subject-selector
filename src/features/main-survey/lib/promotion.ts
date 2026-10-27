// 진급(학번 변경) 반영. 표·통계·타임 배정이 전부 본조사 원본 행(rawSheetData)의 학번에서 다시 계산되므로
// 행의 학번 칸만 새 학번으로 바꾸고, 원래 학번은 행에 __oldId 로 남긴다(이전 이수 이력 매칭·되돌리기·엑셀 출력용).

import * as XLSX from "xlsx-js-style";

export interface PromotionEntry {
  oldId: string;
  name: string;
  newId: string;
}

export type RawRow = Record<string, unknown>;

export const isStudentId = (s: string) => /^\d{4,}$/.test(s);
const norm = (s: string) => s.replace(/\s+/g, "");

const idKeyOf = (row: RawRow) => Object.keys(row).find(k => k.includes("학번"));
const nameKeyOf = (row: RawRow) => Object.keys(row).find(k => k.includes("이름") || k.includes("성명"));

/** 원본 설문 파일에서의 학번(= 진급 전 학번). 이미 진급 적용한 행은 __oldId 가 그 값이다. */
export function originalIdOf(row: RawRow): string {
  if (row.__oldId) return String(row.__oldId).trim();
  const k = idKeyOf(row);
  return k ? String(row[k] ?? "").trim() : "";
}

export function currentIdOf(row: RawRow): string {
  const k = idKeyOf(row);
  return k ? String(row[k] ?? "").trim() : "";
}

export function nameOf(row: RawRow): string {
  const k = nameKeyOf(row);
  return k ? String(row[k] ?? "").trim() : "";
}

// ───────── 명단 읽기 ─────────

function entryFrom(oldId: unknown, name: unknown, newId: unknown): PromotionEntry | null {
  const o = String(oldId ?? "").trim();
  const n = String(newId ?? "").trim();
  if (!isStudentId(o) || !isStudentId(n)) return null;
  return { oldId: o, name: String(name ?? "").trim(), newId: n };
}

/** 엑셀·CSV 파일: 첫 시트. 머리글이 있으면 이름으로 열을 찾고, 없으면 이전학번·이름·진급학번 순서로 읽는다. */
export function parsePromotionFile(buf: ArrayBuffer): PromotionEntry[] {
  const wb = XLSX.read(buf, { type: "array" });
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  let oc = 0, nc = 1, pc = 2;
  const head = rows[0] ?? [];
  if (head.length && !isStudentId(String(head[0] ?? "").trim())) {
    head.forEach((h, i) => {
      const t = String(h ?? "");
      if (/이전|기존|현재|옛/.test(t) && t.includes("학번")) oc = i;
      else if (/진급|변경|새|신/.test(t) && t.includes("학번")) pc = i;
      else if (/이름|성명/.test(t)) nc = i;
    });
  }
  return rows.map(r => entryFrom(r[oc], r[nc], r[pc])).filter((e): e is PromotionEntry => !!e);
}

/** 붙여넣은 글: 줄마다 "이전학번 이름 진급학번"(탭·쉼표·공백 구분). 머리글 줄은 건너뛴다. */
export function parsePromotionText(text: string): PromotionEntry[] {
  return text
    .split(/\r?\n/)
    .map(line => {
      const t = line.trim().split(/[\t,]+|\s+/).filter(Boolean);
      if (t.length < 3) return null;
      return entryFrom(t[0], t.slice(1, -1).join(" "), t[t.length - 1]);
    })
    .filter((e): e is PromotionEntry => !!e);
}

// ───────── 점검 ─────────

export type ReviewStatus = "match" | "nameMismatch" | "missing";

export interface ReviewRow {
  /** 진급 전 학번(행을 식별하는 키) */
  key: string;
  name: string;
  status: ReviewStatus;
  /** 명단에 적힌 이름(이름 불일치일 때 비교용) */
  listName?: string;
  /** 모달에서 고칠 수 있는 진급학번. 비어 있으면 학번을 바꾸지 않는다. */
  newId: string;
  remove: boolean;
}

export interface PromotionReview {
  rows: ReviewRow[];
  /** 명단에는 있으나 설문에 없는 학생 */
  unusedEntries: PromotionEntry[];
}

export function reviewPromotion(rawRows: RawRow[], entries: PromotionEntry[]): PromotionReview {
  const byOld = new Map<string, PromotionEntry>();
  entries.forEach(e => byOld.set(e.oldId, e));
  const used = new Set<string>();
  const rows: ReviewRow[] = rawRows.map(r => {
    const key = originalIdOf(r);
    const name = nameOf(r);
    const e = byOld.get(key);
    if (!e) return { key, name, status: "missing", newId: "", remove: false };
    used.add(key);
    const same = !e.name || norm(e.name) === norm(name);
    return { key, name, status: same ? "match" : "nameMismatch", listName: e.name, newId: e.newId, remove: false };
  });
  return { rows, unusedEntries: entries.filter(e => !used.has(e.oldId)) };
}

/** 적용 후 학번이 겹치는 학생(삭제 표시한 행은 제외). 학번 → 그 학번을 쓰는 학생 이름들. */
export function findDuplicateIds(rows: ReviewRow[]): Map<string, string[]> {
  const seen = new Map<string, string[]>();
  rows.filter(r => !r.remove).forEach(r => {
    const id = r.newId.trim() || r.key;
    seen.set(id, [...(seen.get(id) ?? []), r.name || r.key]);
  });
  return new Map([...seen].filter(([, names]) => names.length > 1));
}

// ───────── 적용 / 되돌리기 ─────────

export interface PromotionDecision {
  key: string;
  newId: string;
  remove: boolean;
}

/** 학번을 바꾸고 삭제 표시한 학생은 뺀다. 결과는 새 학번 순서로 정렬한다. */
export function applyPromotion(rawRows: RawRow[], decisions: PromotionDecision[]): RawRow[] {
  const byKey = new Map(decisions.map(d => [d.key, d]));
  const out: RawRow[] = [];
  for (const row of rawRows) {
    const d = byKey.get(originalIdOf(row));
    if (!d) { out.push(row); continue; }
    if (d.remove) continue;
    const idKey = idKeyOf(row) ?? "학번";
    const key = d.key;
    const nid = d.newId.trim() || key;
    const next: RawRow = { ...row, [idKey]: nid };
    if (nid !== key) next.__oldId = key; else delete next.__oldId;
    out.push(next);
  }
  return out.sort((a, b) => Number(currentIdOf(a)) - Number(currentIdOf(b)));
}

/** 진급 적용을 되돌린다(삭제했던 학생은 돌아오지 않는다). */
export function undoPromotion(rawRows: RawRow[]): RawRow[] {
  return rawRows
    .map(row => {
      if (!row.__oldId) return row;
      const idKey = idKeyOf(row) ?? "학번";
      const next: RawRow = { ...row, [idKey]: String(row.__oldId) };
      delete next.__oldId;
      return next;
    })
    .sort((a, b) => Number(currentIdOf(a)) - Number(currentIdOf(b)));
}

export const hasPromoted = (rawRows: RawRow[]) => rawRows.some(r => !!r.__oldId);

/** 학번에서 반 수를 센다(업로드 때와 같은 규칙: 5자리는 2~3번째, 4자리는 2번째 글자가 반). */
export function countClasses(rawRows: RawRow[]): number {
  const set = new Set<string>();
  rawRows.forEach(r => {
    const id = currentIdOf(r);
    if (id.length >= 5) set.add(id.substring(1, 3));
    else if (id.length === 4) set.add(id.substring(1, 2));
  });
  return set.size;
}
