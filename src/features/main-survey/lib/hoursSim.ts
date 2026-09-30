// 7단계 "교과별 시수 조정" — 6단계와 완전히 따로 쓰는 연습판의 데이터와 계산.
// 계산 규칙은 6단계(useMainClassSummary 의 categorySummaryData)와 같습니다:
//   과목별 시수 = 운영학점 × 개설반, 학기 합계 = 과목별 시수 합 − 수석교사 감축, 평균 = 합계 ÷ 교사 수.

import type { CategorySummaryRow } from "../hooks/useMainClassSummary";

export type SimType = "지정" | "선택";

export interface SimSubject {
  id: string;
  grade: string; // "1" | "2" | "3"
  subject: string;
  type: SimType;
  credits: number;
  classes: number;
}

export interface SimCategory {
  id: string;
  name: string;
  teachers: number;
  reduction: number; // 수석교사 감축 시수(학기마다 뺌)
  sem1: SimSubject[];
  sem2: SimSubject[];
}

/** 이름을 붙여 저장해 둔 7단계 표 한 벌(「1안」, 「2안」 …). */
export interface SimPlan {
  id: string;
  name: string;
  savedAt: string; // ISO 시각
  cats: SimCategory[];
}

let seq = 0;
export const simId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

const hoursOf = (list: SimSubject[]) => list.reduce((acc, s) => acc + s.credits * s.classes, 0);
const avg = (hours: number, teachers: number) => (teachers > 0 ? (hours / teachers).toFixed(1) : "0.0");

export function totalsOf(c: SimCategory) {
  const sem1TotalOriginal = hoursOf(c.sem1);
  const sem2TotalOriginal = hoursOf(c.sem2);
  const sem1Total = Math.max(0, sem1TotalOriginal - c.reduction);
  const sem2Total = Math.max(0, sem2TotalOriginal - c.reduction);
  const yearTotal = sem1Total + sem2Total;
  return {
    sem1TotalOriginal,
    sem2TotalOriginal,
    sem1Total,
    sem2Total,
    yearTotal,
    sem1Avg: avg(sem1Total, c.teachers),
    sem2Avg: avg(sem2Total, c.teachers),
    yearAvg: `${avg(yearTotal, c.teachers)} (${c.teachers > 0 ? (yearTotal / c.teachers / 2).toFixed(1) : "0.0"})`,
  };
}

// ── 안 비교 ──

/** 비교의 기준 — 「6단계 결과 가져오기」를 누른 순간의 6단계 표(이후 6단계가 바뀌어도 그대로). */
export interface SimBaseline {
  savedAt: string; // ISO 시각
  cats: SimCategory[];
}

export type AvgMetric = "sem1" | "sem2" | "year";

const round1 = (x: number) => Math.round(x * 10) / 10;

/** 교사 1인당 평균시수(감축 뺀 뒤). 교과가 없거나 교사 수가 0이면 낼 수 없어 null. 증감이 화면 숫자와 맞도록 소수 첫째 자리로 반올림합니다. */
export function avgOf(c: SimCategory | undefined, m: AvgMetric): number | null {
  if (!c || c.teachers <= 0) return null;
  const t = totalsOf(c);
  const hours = m === "sem1" ? t.sem1Total : m === "sem2" ? t.sem2Total : t.yearTotal;
  return round1(hours / c.teachers);
}

/** 여러 표에 나오는 교과 이름을 처음 나온 순서대로(기준을 앞에 넣으면 기준 순서가 우선). */
export function categoryNames(lists: SimCategory[][]): string[] {
  const names: string[] = [];
  for (const cats of lists) for (const c of cats) if (!names.includes(c.name.trim())) names.push(c.name.trim());
  return names;
}

export const findCategory = (cats: SimCategory[], name: string) => cats.find((c) => c.name.trim() === name);

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "±0");

/**
 * 기준 교과와 안의 교과가 무엇이 다른지 사람이 읽는 문장으로 돌려줍니다.
 * 과목은 학기·학년·과목명이 같으면 같은 과목으로 봅니다(이름을 바꾸면 삭제 + 추가로 나옴).
 */
export function diffCategory(base: SimCategory | undefined, plan: SimCategory | undefined): string[] {
  if (!base && !plan) return [];
  if (!base) return ["기준에 없던 교과(이 안에서 새로 만듦)"];
  if (!plan) return ["이 안에서 지운 교과"];
  const out: string[] = [];
  if (base.teachers !== plan.teachers) out.push(`교사 수 ${base.teachers}→${plan.teachers}`);
  if (base.reduction !== plan.reduction) out.push(`수석교사 감축 ${base.reduction}→${plan.reduction}`);

  (["sem1", "sem2"] as const).forEach((sem) => {
    const semLabel = sem === "sem1" ? "1학기" : "2학기";
    const key = (s: SimSubject) => `${s.grade}|${s.subject.trim()}`;
    const left = [...plan[sem]]; // 짝을 찾으면 여기서 빼서 같은 이름 과목이 여러 줄이어도 하나씩 맞춥니다.
    for (const b of base[sem]) {
      const i = left.findIndex((p) => key(p) === key(b));
      const label = `${b.grade}학년 ${b.subject || "(이름 없음)"}`;
      if (i < 0) {
        out.push(`${semLabel} ${label} 삭제 (${signed(-b.credits * b.classes)})`);
        continue;
      }
      const p = left.splice(i, 1)[0];
      const parts: string[] = [];
      if (b.type !== p.type) parts.push(`${b.type}→${p.type}`);
      if (b.credits !== p.credits) parts.push(`학점 ${b.credits}→${p.credits}`);
      if (b.classes !== p.classes) parts.push(`반 ${b.classes}→${p.classes}`);
      if (parts.length) {
        const d = p.credits * p.classes - b.credits * b.classes;
        out.push(`${semLabel} ${label}: ${parts.join(", ")}${d ? ` (${signed(d)})` : ""}`);
      }
    }
    for (const p of left) out.push(`${semLabel} ${p.grade}학년 ${p.subject || "(이름 없음)"} 추가 (${signed(p.credits * p.classes)})`);
  });
  return out.length ? out : ["변경 없음"];
}

/** 여러 교과의 1년 시수 합(안 버튼에 비교용으로 표시). */
export const yearTotalOf = (cats: SimCategory[]) => cats.reduce((acc, c) => acc + totalsOf(c).yearTotal, 0);

/** 엑셀 내보내기용 — 6단계 행 모양으로 바꿔 같은 엑셀 함수를 씁니다. 과목이 없는 교과도 빈 줄 하나로 남깁니다. */
export function toSummaryRows(cats: SimCategory[]): CategorySummaryRow[] {
  const rows: CategorySummaryRow[] = [];
  const cell = (s: SimSubject | undefined) =>
    s
      ? { gradeLabel: s.grade, subject: s.subject, credits: s.credits, subjectHours: s.credits * s.classes, isElective: s.type === "선택", classCount: s.classes }
      : null;
  for (const c of cats) {
    const t = totalsOf(c);
    const n = Math.max(1, c.sem1.length, c.sem2.length);
    for (let i = 0; i < n; i++) {
      rows.push({ category: c.name, isFirstRow: i === 0, rowSpan: n, reduction: c.reduction, ...t, sem1: cell(c.sem1[i]), sem2: cell(c.sem2[i]) });
    }
  }
  return rows;
}

/** 6단계 표를 복사해 7단계의 시작점으로 씁니다. 화면에 보이는 반 수(손으로 고친 값 포함)를 그대로 가져옵니다. */
export function fromSummaryRows(
  rows: CategorySummaryRow[],
  teacherCounts: { [category: string]: number },
  headTeacherReductions: { [category: string]: number },
  manualClassCounts: { [subjectKey: string]: number },
): SimCategory[] {
  const cats: SimCategory[] = [];
  const toSubject = (s: NonNullable<CategorySummaryRow["sem1"]>, sem: 1 | 2): SimSubject => {
    const key = `${s.gradeLabel}_${s.subject}_${sem}${s.isSplit ? "_split" : ""}`;
    return {
      id: simId(),
      grade: s.gradeLabel,
      subject: s.subject,
      type: s.isElective ? "선택" : "지정",
      credits: s.credits,
      classes: manualClassCounts[key] ?? s.classCount,
    };
  };
  for (const row of rows) {
    if (row.isFirstRow) {
      cats.push({
        id: simId(),
        name: row.category,
        teachers: teacherCounts[row.category] || 0,
        reduction: headTeacherReductions[row.category] || 0,
        sem1: [],
        sem2: [],
      });
    }
    const cat = cats[cats.length - 1];
    if (row.sem1) cat.sem1.push(toSubject(row.sem1, 1));
    if (row.sem2) cat.sem2.push(toSubject(row.sem2, 2));
  }
  return cats;
}
