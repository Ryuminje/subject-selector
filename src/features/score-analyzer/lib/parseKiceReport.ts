// 한국교육과정평가원 "대학수학능력시험 6월·9월 모의평가 성적통지표" 한 쪽 → Report.
// 교육청 연합학력평가 양식(parseReport.ts)과 다르게 한 쪽에 학생 1명, 영역이 가로 열로 늘어서고
// 원점수·석차는 없습니다(표준점수·백분위·등급·응시자수만 있음).

import type { TextItem } from "./parseReport";
import type { AreaKey, AreaScore, Report } from "./types";

const compact = (s: string) => s.replace(/\s+/g, "");
const num = (s: string | undefined | null) => {
  if (s == null) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

// 열 경계(이 양식의 고정 위치). 왼쪽부터: 한국사 | 국어 | 수학 | 영어 | 탐구1 | 탐구2 | 제2외국어/한문
const BOUNDS = [156, 207, 258, 317, 397, 480];
const COLS: (AreaKey | "제2외국어")[] = ["한국사", "국어", "수학", "영어", "탐구1", "탐구2", "제2외국어"];
const colOf = (x: number) => COLS[BOUNDS.filter((b) => x >= b).length];

const ROW_LABELS: Record<string, "select" | "std" | "pct" | "grade" | "takers"> = {
  선택과목: "select",
  표준점수: "std",
  백분위: "pct",
  등급: "grade",
  응시자수: "takers",
};

export function parseKiceReportPage(all: TextItem[]): Report | null {
  const items = all.filter((i) => i.str.trim() !== "");
  const title = items.find((i) => /모의평가/.test(compact(i.str)) && /성적통지표/.test(compact(i.str)));
  const headLabel = items.find((i) => compact(i.str) === "수험번호");
  if (!title || !headLabel) return null;

  const tm = compact(title.str).match(/(\d{4})학년도.*?(\d{1,2})월모의평가/);
  if (!tm) return null;
  // 수능 학년도는 시험을 치르는 해보다 1 큽니다(2027학년도 6월 모의평가는 2026년 6월에 실시).
  const month = Number(tm[2]);
  const year = Number(tm[1]) - 1;

  // 머리: 수험번호 줄과 그 아래 값 줄
  const headY = headLabel.y;
  const headRow = items.filter((i) => Math.abs(i.y - headY) <= 3);
  const valueRow = items.filter((i) => i.y < headY - 5 && i.y > headY - 40);
  const labelX = (t: string) => headRow.find((i) => compact(i.str) === t)?.x;
  const xName = labelX("성");
  const xSex = labelX("성별");
  const xSchool = headRow.find((i) => compact(i.str).startsWith("학교명"))?.x;
  const xClass = labelX("반");
  const xNum = labelX("번호");
  if (xName == null || xSex == null || xClass == null || xNum == null) return null;

  const name = compact(valueRow.filter((i) => i.x >= xName - 6 && i.x < xSex - 6).map((i) => i.str).join(""));
  const school = compact(
    valueRow
      .filter((i) => xSchool != null && i.x >= xSchool - 10 && i.x < xClass - 10)
      .map((i) => i.str)
      .join(""),
  );
  const near = (x: number) =>
    valueRow.filter((i) => Math.abs(i.x - x) <= 14 && /^\d+$/.test(i.str.trim())).sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
  const classNo = num(near(xClass)?.str.trim());
  const stuNum = num(near(xNum)?.str.trim());
  if (!name || classNo == null || stuNum == null) return null;

  // 표: 왼쪽 라벨(선택과목·표준점수·백분위·등급·응시자수)이 있는 줄만 읽습니다.
  const rows: Partial<Record<"select" | "std" | "pct" | "grade" | "takers", TextItem[]>> = {};
  const tableItems = items.filter((i) => i.y < headY - 40 && i.y > 400);
  const ys = [...new Set(tableItems.map((i) => i.y))].sort((a, b) => b - a);
  for (const y of ys) {
    const line = tableItems.filter((i) => Math.abs(i.y - y) <= 3);
    const label = compact(line.filter((i) => i.x < 108).map((i) => i.str).join(""));
    const kind = ROW_LABELS[label];
    if (kind && !rows[kind]) rows[kind] = line.filter((i) => i.x >= 108);
  }
  if (!rows.grade) return null;

  const cell = (kind: keyof typeof rows, col: string) =>
    rows[kind]?.filter((i) => colOf(i.x) === col).map((i) => i.str.trim()).join(" ") || null;

  const areas: AreaScore[] = [];
  for (const col of COLS) {
    if (col === "제2외국어") continue; // 아직 지원하지 않는 영역(화면에서 다루지 않음)
    const gradeText = cell("grade", col);
    const grade = gradeText && /^\d$/.test(gradeText) ? Number(gradeText) : null;
    if (grade == null) continue; // 미응시("-")
    const sel = cell("select", col);
    const selected = sel && sel !== "-" ? compact(sel) : "";
    const subject =
      col === "국어"
        ? selected ? `국어(${selected})` : "국어"
        : col === "수학"
          ? selected ? `수학(${selected})` : "수학"
          : col === "영어" || col === "한국사"
            ? col
            : selected || col;
    areas.push({
      area: col,
      subject,
      maxScore: null,
      raw: null,
      range: null,
      standard: num(cell("std", col)),
      classRank: null,
      schoolRank: null,
      percentile: num(cell("pct", col)),
      grade,
      takers: num(cell("takers", col)),
    });
  }
  if (!areas.length) return null;
  // 보기 좋은 순서: 국어, 수학, 영어, 한국사, 탐구1, 탐구2
  const order: AreaKey[] = ["국어", "수학", "영어", "한국사", "탐구1", "탐구2"];
  areas.sort((a, b) => order.indexOf(a.area) - order.indexOf(b.area));

  return {
    examKey: `${year}-${month}-3`,
    examTitle: `${tm[1]}학년도 대학수학능력시험 ${month}월 모의평가`,
    year,
    month,
    level: 3,
    takenOn: "",
    school,
    classNo,
    num: stuNum,
    name,
    areas,
  };
}
