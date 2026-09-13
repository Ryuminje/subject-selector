// 본조사 원본 엑셀(매트릭스)의 선택 표시(1)를 배정된 타임 문자(A/B/C…)로 바꿔 내려받습니다.
// 리로스쿨 업로드용 — 새 표를 만들지 않고 업로드했던 원본 파일을 그대로 열어 셀 값만
// 덮어써서 열 구성·서식·메타 열(순번/성별/과정/지정과목…)을 유지합니다.
// 선택과목 변경 탭의 useChangeExports.ts handleDownloadRiroschool 와 같은 방식입니다.

import * as XLSX from "xlsx-js-style";
import type { Assignment } from "../types";
import { timeLabel, type StudentRowsContext } from "./studentRows";

/** 과목 매트릭스 시작 열 — 본조사 업로드 파서(useMainUploads.ts)와 같은 가정입니다. */
const SUBJECT_MATRIX_START_COL = 7;
/** 본조사 파서가 "선택했다"로 보는 셀 값들. */
const PICKED = ["1", "y", "o", "이수", "참여"];

const norm = (s: string) => s.replace(/\s+/g, "").trim();
const semNorm = (s: string) => norm(s).replace(/[~-]/g, "");

export interface RiroschoolResult {
  /** 값을 바꾼 학생 수 */
  rows: number;
  /** 타임 문자를 채운 칸 수 */
  filled: number;
  /** 신청했지만 배정이 없어 원본 값을 그대로 둔 칸 수 */
  unassigned: number;
}

export function exportRiroschoolXlsx(
  fileDataUrl: string,
  ctx: StudentRowsContext,
  assign: Assignment,
  fileName: string,
): RiroschoolResult {
  const base64 = fileDataUrl.slice(fileDataUrl.indexOf(",") + 1);
  const wb = XLSX.read(base64, { type: "base64", cellStyles: true });
  const ws = wb.Sheets[wb.SheetNames.length > 1 ? wb.SheetNames[1] : wb.SheetNames[0]];
  // range: 0 — 행 인덱스를 시트 절대 행 번호와 맞춰야 아래에서 같은 좌표로 되쓸 수 있습니다.
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, range: 0 });
  const cell = (row: unknown[] | undefined, c: number) => String(row?.[c] ?? "").trim();

  let headerRow = -1;
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    if (!Array.isArray(row)) continue;
    const has = (kw: string[]) => row.some((c) => kw.some((k) => String(c ?? "").includes(k)));
    if (has(["학번"]) && has(["이름", "성명"])) {
      headerRow = r;
      break;
    }
  }
  if (headerRow < 0) throw new Error("원본 엑셀에서 '학번'·'이름' 헤더를 찾지 못했습니다.");

  const row1 = grid[headerRow] as unknown[];
  const row2 = grid[headerRow + 1] as unknown[] | undefined;
  const idCol = row1.findIndex((h) => String(h ?? "").includes("학번"));
  const multiRow =
    !!row2 && !cell(row2, idCol) && row2.some((c) => String(c ?? "").trim().length > 0);
  const dataStart = headerRow + (multiRow ? 2 : 1);

  const byKey = new Map<string, number>();
  const byName = new Map<string, number>();
  ctx.subjects.forEach((s) => {
    byKey.set(`${semNorm(s.semester ?? "")}|${norm(s.name)}`, s.idx);
    if (!byName.has(norm(s.name))) byName.set(norm(s.name), s.idx);
  });

  // 시트 열 → 과목 idx. 병합된 상위 헤더(학기·교과군)는 앞 값으로 채워가며 복원합니다.
  const colSubject = new Map<number, number>();
  const width = Math.max(row1.length, row2?.length ?? 0);
  let parent = "";
  for (let c = 0; c < width; c++) {
    const v1 = cell(row1, c);
    if (v1) parent = v1;
    if (c < SUBJECT_MATRIX_START_COL) continue;
    const head = multiRow ? parent : v1;
    if (head.includes("지정")) continue;
    const name = multiRow ? cell(row2, c) || v1 : v1;
    if (!name) continue;
    const sem =
      head.includes("1~2학기") || head.includes("1-2학기")
        ? "1~2학기"
        : head.includes("1학기")
          ? "1학기"
          : head.includes("2학기")
            ? "2학기"
            : "";
    const idx = byKey.get(`${semNorm(sem)}|${norm(name)}`) ?? byName.get(norm(name));
    if (idx !== undefined) colSubject.set(c, idx);
  }

  const studentRowOf = new Map<string, number>();
  ctx.students.forEach((st, i) => studentRowOf.set(String(st.id).trim(), i));

  const res: RiroschoolResult = { rows: 0, filled: 0, unassigned: 0 };
  for (let r = dataStart; r < grid.length; r++) {
    const row = grid[r];
    if (!Array.isArray(row)) continue;
    const i = studentRowOf.get(cell(row, idCol));
    if (i === undefined) continue;
    let touched = false;
    colSubject.forEach((subjIdx, c) => {
      const raw = cell(row, c);
      if (!raw || !PICKED.includes(raw.toLowerCase())) return;
      const t = assign.byStudent[i].get(subjIdx);
      if (t === undefined) {
        res.unassigned++;
        return;
      }
      ws[XLSX.utils.encode_cell({ r, c })] = { t: "s", v: timeLabel(ctx, t) };
      res.filled++;
      touched = true;
    });
    if (touched) res.rows++;
  }

  XLSX.writeFile(wb, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
  return res;
}
