// 전국연합학력평가 성적통지표(학생용) 한 쪽의 글자 조각 → Report.
// 글자 조각의 좌표(x: 왼쪽에서, y: 아래에서)로 표의 칸을 찾습니다. 브라우저·node 어디서든 돌도록 순수 함수로 둡니다.

import type { AreaKey, AreaScore, Report } from "./types";

export interface TextItem {
  str: string;
  x: number;
  y: number;
}

// 머리줄을 못 찾았을 때 쓰는 기본 칸 위치(2026년 3월 양식 기준)
const DEFAULT_COLS = { max: 133, raw: 171, range: 207, std: 248, classRank: 281, schoolRank: 318, pct: 355, grade: 402, takers: 433 };

const num = (s: string | undefined): number | null => {
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

const compact = (s: string) => s.replace(/\s+/g, "");

function areaOf(name: string): Exclude<AreaKey, "탐구1" | "탐구2"> | "탐구" {
  if (name.includes("국어")) return "국어";
  if (name.includes("수학")) return "수학";
  if (name.includes("영어")) return "영어";
  if (name.includes("한국사")) return "한국사";
  return "탐구";
}

/** y 가 비슷한 조각끼리 한 줄로 묶습니다(위에서 아래 순서). */
function groupRows(items: TextItem[], tol = 3): TextItem[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: TextItem[][] = [];
  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last[0].y - it.y) <= tol) last.push(it);
    else rows.push([it]);
  }
  return rows.map((r) => r.sort((a, b) => a.x - b.x));
}

export function parseReportPage(all: TextItem[]): Report | null {
  const items = all.filter((i) => i.str.trim() !== "");
  if (!items.length) return null;

  // 머리: "학년 반 번호 성 명 실 시 일" 줄과 그 아래 값 줄
  const hGrade = items.find((i) => compact(i.str) === "학년" && i.x > 400);
  if (!hGrade) return null;
  const headY = hGrade.y;
  const headRow = items.filter((i) => Math.abs(i.y - headY) <= 3);
  const title = headRow
    .filter((i) => i.x < 300)
    .map((i) => i.str.trim())
    .join(" ");
  const tm = title.match(/(\d{4})\s*학년도\s*(\d{1,2})\s*월\s*고\s*(\d)/);
  if (!tm) return null;

  const valueRow = items.filter((i) => i.y < headY - 3 && i.y > headY - 25);
  const near = (x: number, w = 20) =>
    valueRow.filter((i) => Math.abs(i.x - x) <= w && /^\d+$/.test(i.str.trim())).sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
  const hClass = headRow.find((i) => compact(i.str) === "반");
  const hNum = headRow.find((i) => compact(i.str) === "번호");
  const hName = headRow.find((i) => compact(i.str) === "성");
  const hDate = headRow.find((i) => compact(i.str) === "실");
  const level = num(near(hGrade.x)?.str.trim()) ?? Number(tm[3]);
  const classNo = num(hClass ? near(hClass.x)?.str.trim() : undefined);
  const stuNum = num(hNum ? near(hNum.x)?.str.trim() : undefined);
  const name = compact(
    valueRow
      .filter((i) => hName && i.x >= hName.x - 8 && i.x < (hDate?.x ?? 740) - 4)
      .filter((i) => !/^\d+$/.test(i.str.trim()) && !/^\d{4}\./.test(i.str.trim()))
      .map((i) => i.str)
      .join(""),
  );
  const takenOn = valueRow.find((i) => /^\d{4}\.\s*\d+\.\s*\d+\./.test(i.str.trim()))?.str.trim() ?? "";
  const school = compact(
    valueRow
      .filter((i) => i.x > 300 && i.x < hGrade.x - 10)
      .map((i) => i.str)
      .join(""),
  );
  if (classNo == null || stuNum == null || !name) return null;

  // 칸 위치(머리 글자의 x). "득점"은 원점수 쪽과 표준점수 쪽 두 번 나옵니다.
  const hdr = items.find((i) => compact(i.str) === "학급석차");
  const cols = { ...DEFAULT_COLS };
  let tableTop = headY - 40;
  if (hdr) {
    tableTop = hdr.y - 3;
    const r = items.filter((i) => Math.abs(i.y - hdr.y) <= 3 && i.x < 460);
    const find = (s: string, nth = 0) => r.filter((i) => compact(i.str) === s)[nth]?.x;
    cols.max = find("배점") ?? cols.max;
    cols.raw = find("득점", 0) ?? cols.raw;
    cols.range = find("범위") ?? cols.range;
    cols.std = find("득점", 1) ?? cols.std;
    cols.classRank = find("학급석차") ?? cols.classRank;
    cols.schoolRank = find("학교석차") ?? cols.schoolRank;
    cols.pct = find("전국백분위") ?? cols.pct;
    cols.grade = find("등급") ?? cols.grade;
    cols.takers = items.find((i) => compact(i.str) === "응시자수")?.x ?? cols.takers;
  }
  const bottomMark = items.find((i) => compact(i.str).includes("보충학습이필요한문항번호"));
  const tableBottom = (bottomMark?.y ?? tableTop - 120) + 10;

  const colKeys = Object.keys(cols) as (keyof typeof cols)[];
  const colOf = (x: number) => colKeys.reduce((best, k) => (Math.abs(cols[k] - x) < Math.abs(cols[best] - x) ? k : best), colKeys[0]);

  const body = items.filter((i) => i.x < 460 && i.y <= tableTop && i.y >= tableBottom);
  const areas: AreaScore[] = [];
  let inquiryCount = 0;
  for (const row of groupRows(body)) {
    const nameParts = row.filter((i) => i.x < cols.max - 4);
    const rest = row.filter((i) => i.x >= cols.max - 4);
    const subject = compact(nameParts.map((i) => i.str).join(""));
    if (!subject || !rest.length) continue; // "탐 구" 같은 묶음 이름만 있는 줄

    const cell: Partial<Record<keyof typeof cols, string>> = {};
    let rawOnlyGrade: number | null = null;
    for (const it of rest) {
      const s = it.str.trim();
      if (compact(s).startsWith("원점수에의한등급")) {
        // "원점수에 의한 등급 ( 1 )" — 영어·한국사는 등급만 줍니다.
        rawOnlyGrade = num(rest.find((r) => r.x > it.x + 40 && /^\d$/.test(r.str.trim()))?.str.trim());
        continue;
      }
      if (/^[()]$/.test(s)) continue;
      const k = colOf(it.x);
      cell[k] = cell[k] ? `${cell[k]} ${s}` : s;
    }
    if (cell.raw == null) continue;

    const base = areaOf(subject);
    let area: AreaKey;
    if (base === "탐구") {
      inquiryCount += 1;
      area = inquiryCount === 1 ? "탐구1" : "탐구2";
    } else area = base;

    areas.push({
      area,
      subject,
      maxScore: num(cell.max),
      raw: num(cell.raw),
      range: cell.range ?? null,
      standard: num(cell.std),
      classRank: cell.classRank ?? null,
      schoolRank: cell.schoolRank ?? null,
      percentile: num(cell.pct),
      grade: rawOnlyGrade ?? num(cell.grade),
      takers: num(cell.takers),
    });
  }
  if (!areas.length) return null;

  const year = Number(tm[1]);
  const month = Number(tm[2]);
  return {
    examKey: `${year}-${month}-${tm[3]}`,
    examTitle: title,
    year,
    month,
    level,
    takenOn,
    school,
    classNo,
    num: stuNum,
    name,
    areas,
  };
}
