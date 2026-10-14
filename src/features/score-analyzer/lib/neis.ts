// 학교생활기록부 "교과학습발달상황" 일람표(NEIS 출력 PDF) → 학생별 과목 기록.
//
// 이 PDF 는 표를 옆으로 눕힌 모양입니다: 과목이 가로(x)로 늘어서고 항목(석차등급·성취도·원점수…)이 세로(y)로 쌓입니다.
// 학생·학기·학년의 경계는 글자가 아니라 표의 세로선 길이로 구분합니다.
//   - 세로선이 맨 아래(성명·번호 줄)까지 닿는 선 = 학생 경계
//   - 학기 줄까지 닿는 선 = 학기 경계, 학년 줄까지 닿는 선 = 학년 경계
//   - 그 아래(과목 줄부터)만 있는 선 = 과목(열) 경계
// 한 학생은 보통 2쪽에 걸치고, 다음 학생이 같은 쪽 오른쪽에서 시작합니다. 이름+번호가 같으면 같은 학생으로 합칩니다.

import type { TextItem } from "./parseReport";

export interface VLine {
  x: number;
  /** 선의 아래 끝 y */
  lo: number;
  /** 선의 위 끝 y */
  hi: number;
}

export interface CourseRecord {
  year: number;
  term: number;
  subject: string;
  credit: number | null;
  /** 석차등급(1~9). P(이수) 과목이나 등급이 없는 과목은 null */
  rankGrade: number | null;
  passFail: boolean;
  /** 성취도 문자(A~E, P) */
  achievement: string | null;
  takers: number | null;
  raw: number | null;
  avg: number | null;
  sd: number | null;
}

export interface NeisStudent {
  classNo: number | null;
  level: number | null;
  num: number;
  name: string;
  courses: CourseRecord[];
}

interface Fragment {
  num: number;
  name: string;
  courses: CourseRecord[];
}

export interface NeisPage {
  level: number | null;
  classNo: number | null;
  fragments: Fragment[];
}

const compact = (s: string) => s.replace(/\s+/g, "");
const num = (s: string | undefined | null) => {
  if (s == null) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

/** pdf.js 의 연산 목록에서 세로선만 모읍니다. */
export function linesFromOperatorList(
  ops: { fnArray: ArrayLike<number>; argsArray: ArrayLike<unknown> },
  OPS: { save: number; restore: number; transform: number; constructPath: number },
): VLine[] {
  type M = [number, number, number, number, number, number];
  const mul = (m: M, n: M): M => [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
  const apply = (m: M, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

  let ctm: M = [1, 0, 0, 1, 0, 0];
  const stack: M[] = [];
  const segs: [[number, number], [number, number]][] = [];

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const a = ops.argsArray[i] as unknown[];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = mul(ctm, a as unknown as M);
    else if (fn === OPS.constructPath) {
      // pdf.js 6 형식: [그리기연산, [경로 숫자들], 범위]   경로: 0 moveTo(2) 1 lineTo(2) 2 curveTo(6) 3 quad(4) 4 close
      const raw = a[1] as unknown;
      const data = (Array.isArray(raw) && raw.length && typeof raw[0] === "object" ? raw[0] : raw) as ArrayLike<number> | undefined;
      if (!data || typeof data.length !== "number") continue;
      let k = 0;
      let cur: [number, number] | null = null;
      let start: [number, number] | null = null;
      while (k < data.length) {
        const c = data[k++];
        if (c === 0) {
          cur = [data[k], data[k + 1]];
          start = cur;
          k += 2;
        } else if (c === 1) {
          const nxt: [number, number] = [data[k], data[k + 1]];
          k += 2;
          if (cur) segs.push([apply(ctm, cur[0], cur[1]), apply(ctm, nxt[0], nxt[1])]);
          cur = nxt;
        } else if (c === 2) k += 6;
        else if (c === 3) k += 4;
        else if (c === 4) {
          if (cur && start) segs.push([apply(ctm, cur[0], cur[1]), apply(ctm, start[0], start[1])]);
          cur = start;
        } else break;
      }
    }
  }

  const byX = new Map<number, VLine>();
  for (const [p, q] of segs) {
    if (Math.abs(p[0] - q[0]) > 0.6 || Math.abs(p[1] - q[1]) < 6) continue;
    const x = Math.round(p[0] * 2) / 2;
    const lo = Math.min(p[1], q[1]);
    const hi = Math.max(p[1], q[1]);
    const cur = byX.get(x);
    if (cur) {
      cur.lo = Math.min(cur.lo, lo);
      cur.hi = Math.max(cur.hi, hi);
    } else byX.set(x, { x, lo, hi });
  }
  return [...byX.values()].sort((a, b) => a.x - b.x);
}

// y 위치 구간(2026년 양식 기준). 양식의 줄 높이는 모든 쪽에서 같습니다.
const Y = {
  rank: [650, 760] as const, // 석차등급(숫자 또는 P)
  achievement: [600, 650] as const, // 성취도 A(223)
  raw: [515, 548] as const, // 원점수/과목평균(표준편차)
  credit: [486, 506] as const, // 학점수
  subject: [335, 380] as const, // 과목명
  subjectMerged: [250, 275] as const, // 교과+과목이 한 덩어리로 찍히는 경우
  term: [220, 242] as const,
  year: [176, 196] as const,
  name: [100, 135] as const,
  number: [42, 70] as const,
};
const within = (y: number, r: readonly [number, number]) => y >= r[0] && y <= r[1];

export function parseNeisPage(all: TextItem[], lines: VLine[]): NeisPage | null {
  const items = all.filter((i) => i.str.trim() !== "");
  const labels = items.filter((i) => i.x < 200);
  if (!labels.some((i) => compact(i.str) === "석차등급") || !labels.some((i) => compact(i.str) === "성취도")) return null;

  let level: number | null = null;
  let classNo: number | null = null;
  for (const it of items) {
    const m = compact(it.str).match(/^(\d)학년(\d+)반$/);
    if (m) {
      level = Number(m[1]);
      classNo = Number(m[2]);
    }
  }

  // 자료 영역의 왼쪽 끝 = 라벨 글자("석차등급" 등) 오른쪽에서 처음 만나는 긴 세로선
  const labelRight = Math.max(...labels.filter((i) => ["석차등급", "성취도", "학점수", "과목"].includes(compact(i.str))).map((i) => i.x)) + 8;
  const full = lines.filter((l) => l.x > labelRight && l.lo <= 70 && l.hi >= 700);
  if (full.length < 2) return null;
  const termLines = lines.filter((l) => l.x >= full[0].x && l.lo <= 245 && l.hi >= 700).map((l) => l.x);
  const yearLines = lines.filter((l) => l.x >= full[0].x && l.lo <= 196 && l.hi >= 700).map((l) => l.x);
  const colLines = lines.filter((l) => l.x >= full[0].x && l.lo <= 275 && l.hi >= 700);

  const labelOf = (x0: number, x1: number, band: readonly [number, number]) =>
    items.find((i) => i.x >= x0 && i.x < x1 && within(i.y, band) && /^[1-3]$/.test(i.str.trim()))?.str.trim();

  const fragments: Fragment[] = [];
  for (let s = 0; s + 1 < full.length; s++) {
    const s0 = full[s].x;
    const s1 = full[s + 1].x;
    const nameParts = items.filter((i) => i.x >= s0 && i.x < s1 && within(i.y, Y.name));
    const numPart = items.find((i) => i.x >= s0 && i.x < s1 && within(i.y, Y.number) && /^\d+$/.test(i.str.trim()));
    const name = compact(nameParts.map((i) => i.str).join(""));
    const number = numPart ? Number(numPart.str.trim()) : null;
    if (!name || number == null) continue;

    // 이 학생 칸 안의 열 경계
    const xs = [...new Set([s0, s1, ...colLines.filter((l) => l.x > s0 && l.x < s1).map((l) => l.x)])].sort((a, b) => a - b);
    const courses: CourseRecord[] = [];
    for (let c = 0; c + 1 < xs.length; c++) {
      const x0 = xs[c];
      const x1 = xs[c + 1];
      if (x1 - x0 < 8) continue;
      const col = items.filter((i) => i.x >= x0 && i.x < x1);
      if (col.some((i) => compact(i.str).includes("이수학점"))) continue; // 합계 열

      // 학기·학년: 이 열을 감싸는 구간 안의 라벨
      const t0 = Math.max(...termLines.filter((x) => x <= x0));
      const t1 = Math.min(...termLines.filter((x) => x >= x1));
      const y0 = Math.max(...yearLines.filter((x) => x <= x0));
      const y1 = Math.min(...yearLines.filter((x) => x >= x1));
      const term = num(labelOf(t0, t1, Y.term));
      const year = num(labelOf(y0, y1, Y.year));

      const rankItem = col.find((i) => within(i.y, Y.rank));
      const achItem = col.find((i) => within(i.y, Y.achievement) && /^([A-E]\(\d+\)|P)$/.test(compact(i.str)));
      const rawItem = col.find((i) => within(i.y, Y.raw) && /^\d+(\.\d+)?\/\d+(\.\d+)?\(\d+(\.\d+)?\)$/.test(compact(i.str)));
      const creditItem = col.find((i) => within(i.y, Y.credit) && /^\d+$/.test(i.str.trim()));
      let subject = col
        .filter((i) => within(i.y, Y.subject))
        .map((i) => i.str.trim())
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      if (!subject) {
        // "사회(역사/도덕포함) 생활과 윤리"처럼 교과명 뒤에 과목명이 붙어 나옵니다.
        // 교과명은 괄호·슬래시가 든 첫 덩어리이므로 그것만 떼고 나머지를 과목명으로 씁니다
        // (예전에는 마지막 단어만 써서 "생활과 윤리"가 "윤리"로 잘렸습니다).
        const merged = col.find((i) => within(i.y, Y.subjectMerged) && /\s/.test(i.str.trim()));
        if (merged) {
          const tokens = merged.str.trim().split(/\s+/);
          const hasAreaPrefix = tokens.length >= 2 && /[()/·]/.test(tokens[0]);
          subject = (hasAreaPrefix ? tokens.slice(1) : tokens).join(" ");
        }
      }
      if (!subject || term == null || year == null) continue;

      const rankText = rankItem ? compact(rankItem.str) : "";
      const ach = achItem ? compact(achItem.str) : null;
      const achM = ach?.match(/^([A-E])\((\d+)\)$/);
      const rm = rawItem ? compact(rawItem.str).match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)\((\d+(?:\.\d+)?)\)$/) : null;

      courses.push({
        year,
        term,
        subject,
        credit: num(creditItem?.str.trim()),
        rankGrade: /^\d$/.test(rankText) ? Number(rankText) : null,
        passFail: rankText === "P" || ach === "P",
        achievement: achM ? achM[1] : ach,
        takers: achM ? Number(achM[2]) : null,
        raw: rm ? Number(rm[1]) : null,
        avg: rm ? Number(rm[2]) : null,
        sd: rm ? Number(rm[3]) : null,
      });
    }
    fragments.push({ num: number, name, courses });
  }
  return { level, classNo, fragments };
}

/** 쪽별 결과를 학생별로 합칩니다(같은 이름+번호 = 같은 학생). */
export function mergeNeisPages(pages: NeisPage[]): NeisStudent[] {
  const map = new Map<string, NeisStudent>();
  let level: number | null = null;
  let classNo: number | null = null;
  for (const p of pages) {
    level = p.level ?? level;
    classNo = p.classNo ?? classNo;
    for (const f of p.fragments) {
      const key = `${f.num}|${f.name}`;
      const st = map.get(key) ?? { classNo, level, num: f.num, name: f.name, courses: [] };
      st.courses.push(...f.courses);
      map.set(key, st);
    }
  }
  return [...map.values()].sort((a, b) => a.num - b.num);
}
