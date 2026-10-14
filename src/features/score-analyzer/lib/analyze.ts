// 분석 계산: 평균등급, 백분위 평균, 영역 강약, 수능 최저 시뮬레이션. 화면과 분리해 둔 순수 함수입니다.

import { AREA_ORDER, type AreaKey, type Report } from "./types";

export interface Options {
  included: Record<AreaKey, boolean>;
  /** 탐구 2과목을 1과목(둘의 평균)으로 셉니다. */
  inquiryMerge: boolean;
}

export const DEFAULT_OPTIONS: Options = {
  included: { 국어: true, 수학: true, 영어: true, 한국사: true, 탐구1: true, 탐구2: true },
  inquiryMerge: true,
};

export const gradeOf = (r: Report, a: AreaKey) => r.areas.find((x) => x.area === a)?.grade ?? null;
export const areaOf = (r: Report, a: AreaKey) => r.areas.find((x) => x.area === a) ?? null;

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null);
const round2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100);

/** 반영 과목의 평균등급 */
export function meanGrade(r: Report, o: Options): number | null {
  const picks: number[] = [];
  const inq: number[] = [];
  for (const a of AREA_ORDER) {
    const g = gradeOf(r, a);
    if (!o.included[a] || g == null) continue;
    if (o.inquiryMerge && (a === "탐구1" || a === "탐구2")) inq.push(g);
    else picks.push(g);
  }
  if (inq.length) picks.push(mean(inq)!);
  return round2(mean(picks));
}

/** 국어·수학·탐구(2과목 평균) 백분위의 평균 */
export function percentileMean(r: Report): number | null {
  const p = (a: AreaKey) => areaOf(r, a)?.percentile ?? null;
  const inq = [p("탐구1"), p("탐구2")].filter((v): v is number => v != null);
  const parts = [p("국어"), p("수학"), inq.length ? mean(inq) : null].filter((v): v is number => v != null);
  return round2(mean(parts));
}

export interface Extreme {
  area: AreaKey;
  subject: string;
  grade: number;
}

/** 등급이 가장 좋은/나쁜 영역(같으면 백분위로 가림). 한국사는 절대평가라 빼고 봅니다. */
export function extremes(r: Report): { best: Extreme | null; worst: Extreme | null } {
  const rows = r.areas
    .filter((a) => a.area !== "한국사" && a.grade != null)
    .map((a) => ({ area: a.area, subject: a.subject, grade: a.grade as number, pct: a.percentile ?? -1 }));
  if (!rows.length) return { best: null, worst: null };
  const sorted = [...rows].sort((x, y) => x.grade - y.grade || y.pct - x.pct);
  const pick = (e: (typeof rows)[number]): Extreme => ({ area: e.area, subject: e.subject, grade: e.grade });
  return { best: pick(sorted[0]), worst: pick(sorted[sorted.length - 1]) };
}

export interface MinRow {
  label: string;
  count: number;
  limit: number;
  current: number | null;
  ok: boolean | null;
  note: string;
}

const MIN_RULES: [number, number][] = [
  [2, 4],
  [2, 5],
  [2, 6],
  [3, 6],
  [3, 7],
  [3, 8],
  [3, 9],
  [4, 10],
  [4, 11],
];

/** 수능 최저 시뮬레이션: 국·수·영·탐 중 좋은 N개 등급의 합이 기준 이하인지 */
export function csatMin(r: Report, inquiryMode: "best" | "avg"): MinRow[] {
  const g = (a: AreaKey) => gradeOf(r, a);
  const pool: number[] = [];
  for (const a of ["국어", "수학", "영어"] as AreaKey[]) {
    const v = g(a);
    if (v != null) pool.push(v);
  }
  const inq = [g("탐구1"), g("탐구2")].filter((v): v is number => v != null);
  if (inq.length) pool.push(inquiryMode === "best" ? Math.min(...inq) : (mean(inq) as number));
  pool.sort((a, b) => a - b);

  return MIN_RULES.map(([count, limit]) => {
    const label = `${count}개 합 ${limit}`;
    if (pool.length < count) return { label, count, limit, current: null, ok: null, note: "영역이 부족해 계산할 수 없습니다." };
    const current = round2(pool.slice(0, count).reduce((s, v) => s + v, 0)) as number;
    const diff = round2(limit - current) as number;
    if (diff >= 0)
      return {
        label,
        count,
        limit,
        current,
        ok: true,
        note: diff === 0 ? "여유 없음 — 한 등급만 떨어져도 못 맞춥니다." : `여유 ${diff}등급 — 합이 ${diff}등급 늘어도 버팁니다.`,
      };
    return { label, count, limit, current, ok: false, note: `${-diff}등급 부족 — 합을 ${-diff}등급 줄여야 합니다.` };
  });
}

/** 같은 영역의 회차별 등급 흐름: 최근 - 직전. 음수면 등급이 좋아진 것. */
export function trendOf(reports: Report[], a: AreaKey): number | null {
  const gs = reports.map((r) => gradeOf(r, a)).filter((v): v is number => v != null);
  if (gs.length < 2) return null;
  return gs[gs.length - 1] - gs[gs.length - 2];
}
