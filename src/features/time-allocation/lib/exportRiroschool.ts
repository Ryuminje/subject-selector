// 본조사 원본 엑셀(매트릭스)의 선택 표시(1)를 배정된 타임 문자(A/B/C…)로 바꿔 내려받습니다.
// 리로스쿨 업로드용 — 새 표를 만들지 않고 업로드했던 원본 파일을 그대로 열어 셀 값만
// 덮어써서 열 구성·서식·메타 열(순번/성별/과정/지정과목…)을 유지합니다.
// 선택과목 변경 탭의 useChangeExports.ts handleDownloadRiroschool 와 같은 방식입니다.

import * as XLSX from "xlsx-js-style";
import type { Assignment } from "../types";
import { timeLabel, type StudentRowsContext } from "./studentRows";
import { bandList, classKey } from "./bands";

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
  /** 신청했지만 배정이 없어 원본 값을 그대로 둔 칸 수(변경용 파일은 비움) */
  unassigned: number;
  /** output: "binary" 일 때 엑셀 내용(바이너리 문자열) */
  binary?: string;
}

export function exportRiroschoolXlsx(
  fileDataUrl: string,
  ctx: StudentRowsContext,
  assign: Assignment,
  fileName: string,
  sectionLabels?: Map<string, string>,
  opts: {
    /** 설문 매트릭스에 없는 반 고정 공통과목(논술, 체육 + 진로 등 구획)도 열로 덧붙인다 — 선택과목 변경 탭용 */
    includeBands?: boolean;
    /** "1학기"/"2학기" 처럼 학기를 고르면 그 학기(와 1~2학기 과목)만 남기고 다른 학기 과목 칸은 비운다.
     *  학기마다 같은 타임 문자(A, B…)를 쓰므로, 한 파일에 섞이면 변경 탭이 서로 덮어쓰는 걸 막기 위함. */
    semester?: string;
    /** "binary" 면 파일을 저장하지 않고 결과에 엑셀 내용(binary)을 담아 돌려준다 */
    output?: "file" | "binary";
  } = {},
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
  const colSemester = new Map<number, string>(); // 열 → 그 열의 학기 라벨("" = 학기 구분 없음)
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
    colSemester.set(c, sem);
  }
  // 학기를 골랐으면 다른 학기의 과목 열은 처리 대상에서 빼고(아래에서 값을 비운다), 구획도 그 학기만 쓴다
  const keepSemester = (sem: string) => !opts.semester || !sem || sem === "1~2학기" || sem === opts.semester;
  const droppedCols = [...colSemester].filter(([, sem]) => !keepSemester(sem)).map(([c]) => c);
  droppedCols.forEach((c) => colSubject.delete(c));

  const studentRowOf = new Map<string, number>();
  ctx.students.forEach((st, i) => studentRowOf.set(String(st.id).trim(), i));

  const res: RiroschoolResult = { rows: 0, filled: 0, unassigned: 0 };
  const sheetRowOf = new Map<number, number>(); // 학생 인덱스 → 시트 행 번호(구획 열을 채울 때 씀)
  for (let r = dataStart; r < grid.length; r++) {
    const row = grid[r];
    if (!Array.isArray(row)) continue;
    const i = studentRowOf.get(cell(row, idCol));
    if (i === undefined) continue;
    sheetRowOf.set(i, r);
    // 고르지 않은 학기의 과목 칸은 값을 비운다(원본의 선택 표시 1이 남아 변경 탭이 타임 "1"로 읽는 것도 막는다)
    droppedCols.forEach((c) => {
      if (cell(row, c)) ws[XLSX.utils.encode_cell({ r, c })] = { t: "s", v: "" };
    });
    let touched = false;
    colSubject.forEach((subjIdx, c) => {
      const raw = cell(row, c);
      if (!raw || !PICKED.includes(raw.toLowerCase())) return;
      const t = assign.byStudent[i].get(subjIdx);
      if (t === undefined) {
        res.unassigned++;
        // 선택과목 변경용 파일은 변경 탭이 모든 칸을 타임 문자로 읽으므로, 배정이 없는 과목의 원본 표시(1)를 비워 가짜 타임 "1"이 생기지 않게 한다
        if (opts.includeBands) ws[XLSX.utils.encode_cell({ r, c })] = { t: "s", v: "" };
        return;
      }
      const label = sectionLabels?.get(`${i}|${subjIdx}`) ?? timeLabel(ctx, t);
      ws[XLSX.utils.encode_cell({ r, c })] = { t: "s", v: label };
      res.filled++;
      touched = true;
    });
    if (touched) res.rows++;
  }

  if (opts.includeBands) {
    // 구획(반 고정 공통과목)은 반마다 타임이 달라 설문 매트릭스에 열이 없다. 구획마다 열을 하나씩 만들어
    // 각 학생의 구획 타임 문자를 적는다. 머리글·서식은 과목 열을 따라 한다.
    const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
    let c0 = range.e.c + 1;
    const styleCol = [...colSubject.keys()][0] ?? SUBJECT_MATRIX_START_COL;
    const put = (r: number, c: number, v: string) => {
      const s = ws[XLSX.utils.encode_cell({ r, c: styleCol })]?.s;
      ws[XLSX.utils.encode_cell({ r, c })] = { t: "s", v, ...(s ? { s } : {}) };
    };
    ctx.semesterKeys.forEach((key) => {
      const info = ctx.bySemester[key];
      if (!info?.common.on || !keepSemester(key)) return;
      bandList(info.common).forEach((b, bi) => {
        const label = b.subjects.map((s) => s.name).join(" + ");
        if (multiRow) {
          put(headerRow, c0, `공통과목 ${key}`);
          put(headerRow + 1, c0, label);
        } else {
          put(headerRow, c0, label);
        }
        ctx.students.forEach((st, i) => {
          const r = sheetRowOf.get(i);
          const t = (info.bandTimes[bi] || {})[classKey(st.id)];
          if (r === undefined || t === undefined) return;
          put(r, c0, timeLabel(ctx, t));
          res.filled++;
        });
        c0++;
      });
    });
    ws["!ref"] = XLSX.utils.encode_range({ s: range.s, e: { r: range.e.r, c: c0 - 1 } });
  }

  if (opts.output === "binary") {
    // 파일로 저장하지 않고 엑셀 내용(바이너리 문자열)을 돌려준다 — 선택과목 변경 탭이 업로드한 파일처럼 그대로 받는다
    return { ...res, binary: XLSX.write(wb, { type: "binary", bookType: "xlsx" }) as string };
  }
  XLSX.writeFile(wb, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
  return res;
}
