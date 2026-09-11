// 학생 × 타임 표 → .xlsx (xlsx-js-style). survey 계열 훅들과 같은 라이브러리/패턴.

import * as XLSX from "xlsx-js-style";
import type { Assignment } from "../types";
import { classKey, classLabel } from "./bands";
import { studentRow, timeLabel, type StudentRowsContext } from "./studentRows";

const HEADER_STYLE = {
  font: { bold: true },
  fill: { fgColor: { rgb: "EEEEEE" } },
  alignment: { horizontal: "center", vertical: "center" },
};

/** 학생별 타임 배정표를 엑셀 파일로 내려받습니다. */
export function exportStudentTimesXlsx(
  ctx: StudentRowsContext,
  assign: Assignment,
  fileName: string,
): void {
  const header = [
    "순번",
    "학번",
    "반",
    "이름",
    ...Array.from({ length: ctx.numTimes }, (_, t) => timeLabel(ctx, t) + "타임"),
    "미배정",
  ];
  const aoa: (string | number)[][] = [header];
  ctx.students.forEach((st, i) => {
    aoa.push([
      st.no,
      st.id,
      classLabel(classKey(st.id)),
      st.name,
      ...studentRow(ctx, assign, i),
      assign.unassigned[i].map((s) => ctx.subjects[s].name).join(", "),
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const range = XLSX.utils.decode_range(ws["!ref"]!);
  for (let c = range.s.c; c <= range.e.c; c++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[ref]) ws[ref].s = HEADER_STYLE;
  }
  ws["!cols"] = header.map((h, c) =>
    c < 4 ? { wch: c === 1 ? 12 : 8 } : { wch: Math.max(10, h.length + 2) },
  );

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "학생별 타임");
  XLSX.writeFile(wb, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
}
