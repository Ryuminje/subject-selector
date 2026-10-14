// 수시·정시 통합: 한 학생의 내신(교과학습발달상황)과 모의고사(성적통지표)를 이어 붙여 성향을 판정합니다.
// 아래 기준값(성향 격차, 지원 가능 라인 구간, 전형 적합 지표 가중치)은 상담용 "참고" 값이며 화면에도 그렇게 적습니다.

import type { NeisStudent } from "./neis";
import { termsOf, weightedAverage } from "./naesin";
import { meanGrade, percentileMean, type Options } from "./analyze";
import { examLabel, type Report } from "./types";

export interface Person {
  key: string;
  classNo: number | null;
  num: number;
  name: string;
  naesin: NeisStudent | null;
  /** 시험 순서대로 */
  mock: Report[];
}

const personKey = (num: number, name: string) => `${num}|${name}`;

/** 두 자료를 번호+이름으로 이어 붙입니다. 한쪽에만 있어도 사람으로 남깁니다. */
export function buildPeople(naesin: NeisStudent[], reports: Report[]): Person[] {
  const map = new Map<string, Person>();
  for (const s of naesin) {
    map.set(personKey(s.num, s.name), { key: personKey(s.num, s.name), classNo: s.classNo, num: s.num, name: s.name, naesin: s, mock: [] });
  }
  const seen = new Set<string>();
  for (const r of [...reports].sort((a, b) => a.year - b.year || a.month - b.month)) {
    const k = personKey(r.num, r.name);
    const p = map.get(k) ?? { key: k, classNo: r.classNo, num: r.num, name: r.name, naesin: null, mock: [] };
    // 같은 회차를 중복해서 넣지 않습니다
    const dup = `${k}|${r.examKey}`;
    if (!seen.has(dup)) {
      p.mock.push(r);
      seen.add(dup);
    }
    p.classNo = p.classNo ?? r.classNo;
    map.set(k, p);
  }
  return [...map.values()].sort((a, b) => (a.classNo ?? 0) - (b.classNo ?? 0) || a.num - b.num);
}

export type Tendency = "susi" | "balanced" | "jeongsi";

/** 내신 평균 − 모의 평균(등급). 이 값 이상이면 한쪽 우위로 봅니다. */
export const TENDENCY_GAP = 0.5;

export const TENDENCY_LABEL: Record<Tendency, string> = {
  susi: "수시 우위형",
  balanced: "균형형",
  jeongsi: "정시 우위형",
};

export function tendencyOf(gap: number, threshold = TENDENCY_GAP): Tendency {
  if (gap >= threshold) return "jeongsi"; // 모의고사가 내신보다 좋음
  if (gap <= -threshold) return "susi"; // 내신이 모의고사보다 좋음
  return "balanced";
}

export interface Metrics {
  naesinAvg: number | null;
  mockAvg: number | null;
  /** 내신 − 모의. 양수면 모의고사가 더 좋음 */
  gap: number | null;
  tendency: Tendency | null;
  /** 국어·수학·탐구 백분위 평균(최근 회차) */
  mockPct: number | null;
  naesinTerms: { label: string; avg: number | null }[];
  mockExams: { label: string; avg: number | null }[];
  latestLabel: string | null;
}

const r2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100);

export function metricsOf(p: Person, opts: Options, threshold = TENDENCY_GAP): Metrics {
  const naesinAvg = p.naesin ? r2(weightedAverage(p.naesin.courses).avg) : null;
  const latest = p.mock[p.mock.length - 1];
  const mockAvg = latest ? meanGrade(latest, opts) : null;
  const gap = naesinAvg != null && mockAvg != null ? r2(naesinAvg - mockAvg) : null;
  return {
    naesinAvg,
    mockAvg,
    gap,
    tendency: gap == null ? null : tendencyOf(gap, threshold),
    mockPct: latest ? percentileMean(latest) : null,
    naesinTerms: p.naesin
      ? termsOf(p.naesin.courses).map((t) => ({
          label: `${t.year}-${t.term}`,
          avg: r2(weightedAverage(p.naesin!.courses.filter((c) => c.year === t.year && c.term === t.term)).avg),
        }))
      : [],
    mockExams: p.mock.map((r) => ({ label: examLabel(r), avg: meanGrade(r, opts) })),
    latestLabel: latest ? examLabel(latest) : null,
  };
}

/** 정시 "지원 가능 라인" 구간: 국·수·탐 백분위 평균 → 대략적인 위치(참고용 구간표) */
export const PERCENTILE_BANDS: { min: number; label: string; note: string }[] = [
  { min: 98, label: "의약계열 · 최상위권", note: "의대·치대·한의대 및 최상위권 대학 지원 범위" },
  { min: 95, label: "서울 주요 대학 상위권", note: "서울 주요 대학 인기 학과 지원 범위" },
  { min: 90, label: "서울권 · 주요 국립대", note: "서울권 대학, 거점 국립대 상위 학과" },
  { min: 80, label: "수도권 · 지방 거점 국립대", note: "수도권 4년제, 지방 거점 국립대 지원 범위" },
  { min: 65, label: "수도권 · 지방 4년제", note: "지방 4년제 대학 중심" },
  { min: 0, label: "4년제 · 전문대 병행", note: "학교생활기록부·수시 전형도 함께 살펴보세요" },
];

export const bandOf = (pct: number) => PERCENTILE_BANDS.find((b) => pct >= b.min) ?? PERCENTILE_BANDS[PERCENTILE_BANDS.length - 1];

/** 등급 → 0~100 환산(1등급 100, 9등급 0 직선). 학교 안에서 비교하기 위한 단순 환산입니다. */
export const gradeScore = (g: number) => Math.max(0, Math.min(100, Math.round(100 - ((g - 1) * 100) / 8)));

export interface Fit {
  key: string;
  label: string;
  score: number | null;
  /** 어떻게 계산했는지(화면에 그대로 보여 줍니다) */
  basis: string;
}

export function fitScores(m: Metrics): Fit[] {
  const n = m.naesinAvg != null ? gradeScore(m.naesinAvg) : null;
  const k = m.mockAvg != null ? gradeScore(m.mockAvg) : null;
  const mix = (a: number | null, wa: number, b: number | null, wb: number) => {
    if (a == null && b == null) return null;
    if (a == null) return b;
    if (b == null) return a;
    return Math.round((a * wa + b * wb) / (wa + wb));
  };
  return [
    { key: "gyogwa", label: "교과전형 (수시)", score: n, basis: "내신 평균등급만 봅니다." },
    { key: "hakjong", label: "학생부종합 (수시)", score: mix(n, 0.7, k, 0.3), basis: "내신 70% + 모의고사 30%. 비교과 활동은 반영하지 못합니다." },
    { key: "nonsul", label: "논술 (수시)", score: mix(n, 0.3, k, 0.7), basis: "수능 최저 충족이 중요해 모의고사 70% + 내신 30%." },
    { key: "jeongsi", label: "정시 (수능)", score: k, basis: "모의고사 평균등급만 봅니다." },
  ];
}

export function summarizeTendency(people: Person[], opts: Options, threshold = TENDENCY_GAP) {
  const groups: Record<Tendency, Person[]> = { susi: [], balanced: [], jeongsi: [] };
  const points: { person: Person; naesinAvg: number; mockAvg: number; tendency: Tendency }[] = [];
  for (const p of people) {
    const m = metricsOf(p, opts, threshold);
    if (m.naesinAvg == null || m.mockAvg == null || m.tendency == null) continue;
    groups[m.tendency].push(p);
    points.push({ person: p, naesinAvg: m.naesinAvg, mockAvg: m.mockAvg, tendency: m.tendency });
  }
  return { groups, points };
}

export const peopleLabel = (p: Pick<Person, "classNo" | "num" | "name">) => `${p.classNo ? `${p.classNo}반 ` : ""}${p.num}번 ${p.name}`;
