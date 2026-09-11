// 학생 × 타임 표 → .xlsx (xlsx-js-style). survey 계열 훅들과 같은 라이브러리/패턴.

import * as XLSX from "xlsx-js-style";
import type { Assignment } from "../types";
import { classKey, classLabel } from "./bands";
import { studentRowsBySemester, timeLabel, type StudentRowsContext } from "./studentRows";

const HEADER_STYLE = {
  font: { bold: true },
  fill: { fgColor: { rgb: "EEEEEE" } },
  alignment: { horizontal: "center", vertical: "center" },
};

/** 학생별 타임 배정표를 엑셀 파일로 내려받습니다. 1학기/2학기는 서로 다른 타임이라
 *  학기가 여럿이면 위 줄에 "1학기"/"2학기" 머리글을 합쳐 붙이고 그 아래에 A/B/C…를 둡니다. */
export function exportStudentTimesXlsx(
  ctx: StudentRowsContext,
  assign: Assignment,
  fileName: string,
): void {
  const multiSemester = ctx.semesterKeys.length > 1;
  const widthOf = (key: string) => ctx.bySemester[key]?.ownTimes ?? ctx.numTimes;
  const FIXED_COLS = 4; // 순번/학번/반/이름

  const timeHeader = ["순번", "학번", "반", "이름"];
  ctx.semesterKeys.forEach((key) => {
    for (let t = 0; t < widthOf(key); t++) timeHeader.push(timeLabel(ctx, t) + "타임");
  });
  timeHeader.push("미배정");

  const aoa: (string | number)[][] = [];
  let headerRowIdx = 0;
  if (multiSemester) {
    const semesterRow = ["", "", "", ""];
    ctx.semesterKeys.forEach((key) => {
      semesterRow.push(key, ...Array(widthOf(key) - 1).fill(""));
    });
    semesterRow.push("");
    aoa.push(semesterRow);
    headerRowIdx = 1;
  }
  aoa.push(timeHeader);

  ctx.students.forEach((st, i) => {
    const bySem = studentRowsBySemester(ctx, assign, i);
    aoa.push([
      st.no,
      st.id,
      classLabel(classKey(st.id)),
      st.name,
      ...ctx.semesterKeys.flatMap((key) => bySem[key]),
      assign.unassigned[i].map((s) => ctx.subjects[s].name).join(", "),
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const range = XLSX.utils.decode_range(ws["!ref"]!);
  for (let r = 0; r <= headerRowIdx; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (ws[ref]) ws[ref].s = HEADER_STYLE;
    }
  }
  if (multiSemester) {
    const merges: XLSX.Range[] = [];
    let c = FIXED_COLS;
    ctx.semesterKeys.forEach((key) => {
      const w = widthOf(key);
      if (w > 1) merges.push({ s: { r: 0, c }, e: { r: 0, c: c + w - 1 } });
      c += w;
    });
    ws["!merges"] = merges;
  }
  ws["!cols"] = timeHeader.map((h, c) =>
    c < FIXED_COLS ? { wch: c === 1 ? 12 : 8 } : { wch: Math.max(10, h.length + 2) },
  );

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "학생별 타임");
  XLSX.writeFile(wb, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
}
