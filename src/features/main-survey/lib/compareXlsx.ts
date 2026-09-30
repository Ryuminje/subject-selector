// 7단계 「안 비교」 엑셀 — 화면 표와 같은 값을 시트 세 개(1학기 / 2학기 / 1년 학기당)로 만듭니다.

import * as XLSX from "xlsx-js-style";
import { avgOf, findCategory, type AvgMetric, type SimBaseline, type SimCategory } from "./hoursSim";

export const COMPARE_METRICS: { key: AvgMetric; label: string }[] = [
  { key: "sem1", label: "1학기 평균시수" },
  { key: "sem2", label: "2학기 평균시수" },
  { key: "year", label: "1년 평균시수(학기당)" },
];

export interface CompareColumn {
  key: string;
  name: string;
  cats: SimCategory[];
}

export const deltaOf = (v: number | null, b: number | null) => (v === null || b === null ? null : Math.round((v - b) * 10) / 10);

const FONT = { name: "맑은 고딕", sz: 11 };
const BORDER = {
  top: { style: "thin", color: { rgb: "A8A29E" } },
  bottom: { style: "thin", color: { rgb: "A8A29E" } },
  left: { style: "thin", color: { rgb: "A8A29E" } },
  right: { style: "thin", color: { rgb: "A8A29E" } },
};
const CENTER = { horizontal: "center", vertical: "center", wrapText: true };

/**
 * 값과 증감은 숫자 칸으로 넣습니다(엑셀에서 정렬·계산이 되도록). 증감은 표시 형식으로
 * "▲ 0.0 / ▼ 0.0 / 0.0"을 보여 주고 글자색·칸 색도 따로 칠해, 표시 형식을 지원하지 않는
 * 프로그램에서 열어도 +/− 부호와 색으로 늘고 준 것을 알 수 있게 합니다.
 */
export function buildCompareWorkbook(baseline: SimBaseline, columns: CompareColumn[], names: string[]) {
  const wb = XLSX.utils.book_new();
  for (const m of COMPARE_METRICS) {
    const aoa: (string | number | null)[][] = [
      ["교과", "교사 수(기준)", "기준(6단계)", ...columns.flatMap((c) => [c.name, ""])],
      ["", "", "", ...columns.flatMap(() => ["평균", "증감"])],
    ];
    const deltas: (number | null)[][] = [];
    for (const name of names) {
      const base = findCategory(baseline.cats, name);
      const b = avgOf(base, m.key);
      const row: (string | number | null)[] = [name, base ? base.teachers : "–", b ?? "–"];
      const rowDeltas: (number | null)[] = [];
      for (const c of columns) {
        const v = avgOf(findCategory(c.cats, name), m.key);
        const d = deltaOf(v, b);
        rowDeltas.push(d);
        row.push(v ?? "–", d ?? "–");
      }
      aoa.push(row);
      deltas.push(rowDeltas);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const range = XLSX.utils.decode_range(ws["!ref"]!);
    for (let r = 0; r <= range.e.r; r++) {
      for (let c = 0; c <= range.e.c; c++) {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (!ws[ref]) ws[ref] = { t: "s", v: "" };
        const cell = ws[ref];
        if (r < 2) {
          cell.s = { font: { ...FONT, bold: true }, fill: { fgColor: { rgb: "E7E5E4" } }, alignment: CENTER, border: BORDER };
          continue;
        }
        cell.s = { font: FONT, alignment: CENTER, border: BORDER };
        if (c === 2) cell.s.fill = { fgColor: { rgb: "FEF3C7" } }; // 기준 열
        if (cell.t === "n" && c >= 2) cell.z = "0.0";
        const isDelta = c >= 4 && (c - 4) % 2 === 0;
        if (isDelta && cell.t === "n") {
          const d = deltas[r - 2][(c - 4) / 2]!;
          cell.z = '"▲ "0.0;"▼ "0.0;"0.0"';
          if (d > 0) cell.s = { ...cell.s, font: { ...FONT, bold: true, color: { rgb: "DC2626" } }, fill: { fgColor: { rgb: "FEE2E2" } } };
          if (d < 0) cell.s = { ...cell.s, font: { ...FONT, bold: true, color: { rgb: "2563EB" } }, fill: { fgColor: { rgb: "DBEAFE" } } };
          if (d === 0) cell.s = { ...cell.s, font: { ...FONT, color: { rgb: "A8A29E" } } };
        }
      }
    }
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
      ...columns.map((_, i) => ({ s: { r: 0, c: 3 + i * 2 }, e: { r: 0, c: 4 + i * 2 } })),
    ];
    ws["!cols"] = [{ wch: 12 }, { wch: 11 }, { wch: 12 }, ...columns.flatMap(() => [{ wch: 10 }, { wch: 10 }])];
    XLSX.utils.book_append_sheet(wb, ws, m.label);
  }
  return wb;
}
