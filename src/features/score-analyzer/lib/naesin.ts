// 내신 분석 계산(순수 함수). 계산식은 견본 출력(성적 돋보기 내신)과 실제 자료로 맞춰 본 것입니다.
//  - 평균등급 = Σ(석차등급 × 학점) ÷ Σ학점 (석차등급이 있는 과목만)
//  - 소수 등급(1.64 등) = 등급 안에서의 위치. 정규분포로 상위 비율을 추정해 구합니다.
//  - "앞에 약 N명" = 추정 석차 − 한 등급 위 컷 석차

import type { CourseRecord } from "./neis";

/** 9등급 누적 비율(%) 경계: 4, 11, 23, 40, 60, 77, 89, 96, 100 */
export const CUTS = [4, 11, 23, 40, 60, 77, 89, 96, 100] as const;

// 표준정규분포 누적확률(Abramowitz–Stegun 7.1.26)
function cdf(z: number) {
  const t = 1 / (1 + (0.3275911 * Math.abs(z)) / Math.SQRT2);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}
const upperTail = (z: number) => 1 - cdf(z);

/** 상위 p(0~1) 에 해당하는 z. 이분법으로 구합니다. */
function zForTail(p: number) {
  let lo = -6;
  let hi = 6;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (upperTail(mid) > p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export const isGraded = (c: CourseRecord) => c.rankGrade != null && (c.credit ?? 0) > 0;

export function weightedAverage(courses: CourseRecord[]): { avg: number | null; credits: number; count: number } {
  const g = courses.filter(isGraded);
  const credits = g.reduce((s, c) => s + (c.credit ?? 0), 0);
  if (!credits) return { avg: null, credits: 0, count: g.length };
  const sum = g.reduce((s, c) => s + (c.rankGrade as number) * (c.credit ?? 0), 0);
  return { avg: sum / credits, credits, count: g.length };
}

export type Group = "국어" | "수학" | "영어" | "사회" | "과학" | "제2외국어" | "예체능·기타";
export const GROUPS: Group[] = ["국어", "수학", "영어", "사회", "과학", "제2외국어", "예체능·기타"];

export function groupOf(subject: string): Group {
  const s = subject.replace(/\s+/g, "");
  if (/영어/.test(s)) return "영어";
  if (/(국어|문학|독서|화법|언어와매체|매체|작문|고전)/.test(s)) return "국어";
  if (/(수학|미적분|확률|기하|대수)/.test(s)) return "수학";
  if (/(일본어|중국어|독일어|프랑스어|스페인어|러시아어|아랍어|베트남어|한문)/.test(s)) return "제2외국어";
  if (/(한국사|사회|지리|역사|세계사|경제|정치|윤리|도덕|법과)/.test(s)) return "사회";
  if (/(과학|물리|화학|생명|지구)/.test(s)) return "과학";
  return "예체능·기타";
}

export interface Combo {
  key: string;
  label: string;
  has: (g: Group) => boolean;
}

export const COMBOS: Combo[] = [
  { key: "all", label: "전과목", has: () => true },
  { key: "kem", label: "국영수", has: (g) => g === "국어" || g === "영어" || g === "수학" },
  { key: "kems", label: "국영수사", has: (g) => g === "국어" || g === "영어" || g === "수학" || g === "사회" },
  { key: "kemsci", label: "국영수과", has: (g) => g === "국어" || g === "영어" || g === "수학" || g === "과학" },
];

export function termsOf(courses: CourseRecord[]) {
  return [...new Set(courses.map((c) => `${c.year}-${c.term}`))]
    .map((k) => ({ key: k, year: Number(k.split("-")[0]), term: Number(k.split("-")[1]) }))
    .sort((a, b) => a.year - b.year || a.term - b.term);
}

export function comboSummary(courses: CourseRecord[]) {
  return COMBOS.map((cb) => ({ ...cb, ...weightedAverage(courses.filter((c) => cb.has(groupOf(c.subject)))) }));
}

/** 조합별 학기 평균과 그 학기까지의 누적 평균 */
export function comboTrend(courses: CourseRecord[]) {
  const terms = termsOf(courses);
  return COMBOS.map((cb) => {
    const mine = courses.filter((c) => cb.has(groupOf(c.subject)));
    const perTerm = terms.map((t) => weightedAverage(mine.filter((c) => c.year === t.year && c.term === t.term)).avg);
    const cumulative = terms.map((t) =>
      weightedAverage(mine.filter((c) => c.year < t.year || (c.year === t.year && c.term <= t.term))).avg,
    );
    return { key: cb.key, label: cb.label, perTerm, cumulative };
  });
}

export function groupSummary(courses: CourseRecord[]) {
  const overall = weightedAverage(courses).avg;
  return GROUPS.map((g) => {
    const w = weightedAverage(courses.filter((c) => groupOf(c.subject) === g));
    const diff = overall != null && w.avg != null ? Math.round((w.avg - overall) * 100) / 100 : null;
    const tag = diff == null ? null : diff <= -0.3 ? ("강점" as const) : diff >= 0.3 ? ("약점" as const) : null;
    return { group: g, ...w, diff, tag };
  }).filter((r) => r.count > 0);
}

export interface Estimate {
  /** 상위 비율(%) */
  pct: number;
  /** 소수 등급(1.64) */
  fractional: number;
  estRank: number;
  /** 한 등급 위 컷 석차(이 안에 들어야 함) */
  cutRank: number | null;
  /** 추월해야 할 인원 */
  ahead: number | null;
  /** 같은 등급 인원 */
  sameGrade: number | null;
  /** 한 등급 올리려면 더 받아야 하는 점수. 음수면 이미 커트라인 점수를 넘긴 "여유"입니다. */
  needScore: number | null;
  /** 한 등급 위 커트라인에서 얼마나 떨어져 있는지(0=커트라인에 붙음, 1=등급 맨 아래). 막대 길이는 1 − 이 값. */
  position: number;
}

export function estimateCourse(c: CourseRecord): Estimate | null {
  if (c.raw == null || c.avg == null || c.sd == null || c.sd <= 0 || c.takers == null) return null;
  const z = (c.raw - c.avg) / c.sd;
  const p = Math.min(100, Math.max(0, upperTail(z) * 100));
  let idx = CUTS.findIndex((cut) => p <= cut);
  if (idx < 0) idx = 8;
  const lo = idx === 0 ? 0 : CUTS[idx - 1];
  const position = (p - lo) / (CUTS[idx] - lo);
  const g = c.rankGrade;
  let fractional = idx + 1 + position;
  if (g != null) fractional = Math.min(g + 0.99, Math.max(g, fractional));
  fractional = Math.round(fractional * 100) / 100;

  let estRank = Math.max(1, Math.round((p / 100) * c.takers));
  let cutRank: number | null = null;
  let ahead: number | null = null;
  let sameGrade: number | null = null;
  let needScore: number | null = null;
  let closeness = position;
  if (g != null && g > 1) {
    const upper = CUTS[g - 2];
    cutRank = Math.max(1, Math.floor((upper / 100) * c.takers));
    // 견본 출력과 맞춘 규칙: (등급 아래 경계를 반올림한 석차) − (위 경계를 내린 석차)
    const bandEnd = Math.round((CUTS[g - 1] / 100) * c.takers);
    sameGrade = bandEnd - Math.floor((upper / 100) * c.takers);
    // 학교 기록의 석차등급은 확정된 사실이므로 추정 석차를 그 등급 범위 안으로 맞춥니다.
    // (점수 분포가 종 모양이 아니면 추정이 기록보다 좋게/나쁘게 나올 수 있어, 그대로 쓰면 기록과 모순됩니다.)
    const lo = cutRank + 1;
    const hi = Math.max(lo, bandEnd);
    estRank = Math.min(hi, Math.max(lo, estRank));
    ahead = estRank - cutRank; // 항상 1 이상
    // 커트라인 점수: 경계 z 값은 정규분포표처럼 소수 둘째 자리로 씁니다.
    const zCut = Math.round(zForTail(upper / 100) * 100) / 100;
    const cutScore = c.avg + zCut * c.sd;
    // 음수 = 점수 모형으로는 이미 커트라인을 넘긴 여유(기록 등급과 추정이 어긋난 경우)
    needScore = Math.round((cutScore - c.raw) * 10) / 10;
    closeness = sameGrade > 0 ? Math.min(1, Math.max(0, (estRank - cutRank) / sameGrade)) : 1;
  }
  return { pct: p, fractional, estRank, cutRank, ahead, sameGrade, needScore, position: closeness };
}

/** "한 등급만 올리면 되는 과목": 가까운 순(앞에 있는 학생이 적은 순) */
export function improvementList(courses: CourseRecord[]) {
  return courses
    .filter((c) => isGraded(c) && (c.rankGrade as number) > 1)
    .map((c) => ({ course: c, est: estimateCourse(c) }))
    .filter((x): x is { course: CourseRecord; est: Estimate } => x.est != null && x.est.ahead != null)
    .sort((a, b) => (a.est.ahead as number) - (b.est.ahead as number) || (a.est.needScore as number) - (b.est.needScore as number));
}

export interface SimRow {
  /** 남은 학기 평균등급 */
  grade: number;
  final: number;
}

/** 남은 학점을 어떤 등급으로 채우면 최종 평균이 얼마가 되는지 */
export function simulate(courses: CourseRecord[], remainingCredits: number) {
  const base = weightedAverage(courses);
  const S = base.avg == null ? 0 : base.avg * base.credits;
  const C = base.credits;
  const rows: SimRow[] = [1, 1.5, 2, 2.5, 3, 4, 5].map((g) => ({
    grade: g,
    final: Math.round(((S + g * remainingCredits) / (C + remainingCredits)) * 100) / 100,
  }));
  const needFor = (target: number) => {
    if (!remainingCredits) return null;
    const need = (target * (C + remainingCredits) - S) / remainingCredits;
    return Math.round(need * 100) / 100;
  };
  return { baseAvg: base.avg, baseCredits: C, rows, needFor };
}
