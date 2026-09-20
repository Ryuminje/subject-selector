// 구획 교사 배치표 → .xlsx. time-allocation/lib/exportExcel.ts 와 같은 라이브러리·패턴입니다.

import * as XLSX from "xlsx-js-style";
import type { PlanResult } from "./teacherPlan";

const HEADER_STYLE = {
  font: { bold: true },
  fill: { fgColor: { rgb: "EEEEEE" } },
  alignment: { horizontal: "center", vertical: "center" },
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** 타임 × 반 배치표 + 교사별 시수 시트. 칸은 "과목 / 교사" 두 줄입니다. */
export function exportTeacherPlanXlsx(plan: PlanResult, classes: number, fileName: string): void {
  const header = ["타임", ...Array.from({ length: classes }, (_, c) => `${c + 1}반`)];
  const aoa: string[][] = [header];
  plan.grid.forEach((row, t) => {
    aoa.push([`${LETTERS[t] ?? t + 1}타임`, ...row.map((cell) => `${cell.subject}\n${cell.teacher}`)]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const range = XLSX.utils.decode_range(ws["!ref"]!);
  for (let c = range.s.c; c <= range.e.c; c++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[ref]) ws[ref].s = HEADER_STYLE;
  }
  // 두 줄짜리 칸이라 줄바꿈을 켜 둡니다.
  for (let r = 1; r <= range.e.r; r++) {
    for (let c = 1; c <= range.e.c; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (ws[ref]) ws[ref].s = { alignment: { wrapText: true, horizontal: "center", vertical: "center" } };
    }
  }
  ws["!cols"] = header.map((h, c) => ({ wch: c === 0 ? 10 : Math.max(12, h.length + 6) }));
  ws["!rows"] = aoa.map((_, r) => (r === 0 ? { hpt: 20 } : { hpt: 30 }));

  const loadAoa: (string | number)[][] = [["교사", "시수", "겸임"]];
  [...plan.load.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, h]) => loadAoa.push([name, h, plan.multiSubject.includes(name) ? "겸임" : ""]));
  const wsLoad = XLSX.utils.aoa_to_sheet(loadAoa);
  ["A1", "B1", "C1"].forEach((ref) => {
    if (wsLoad[ref]) wsLoad[ref].s = HEADER_STYLE;
  });
  wsLoad["!cols"] = [{ wch: 14 }, { wch: 8 }, { wch: 8 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "구획 배치표");
  XLSX.utils.book_append_sheet(wb, wsLoad, "교사별 시수");
  XLSX.writeFile(wb, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
}
