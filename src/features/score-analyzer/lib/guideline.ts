// 모집요강 JSON(대학별 반영 규칙)을 읽어 학생 성적에 적용합니다. 모두 브라우저 안에서만 처리합니다.
// JSON 은 모집요강 PDF 를 정리한 것(_추출결과 폴더)이며, 확인 상태가 "미확인"이면 화면에 그대로 표시합니다.

import type { CourseRecord } from "./neis";
import { groupOf, isGraded } from "./naesin";

export interface SuneungRule {
  units: string;
  areas?: string;
  rule: string;
}

export interface GuidelineTrack {
  id: string;
  name: string;
  type?: string;
  /** 입결 엑셀의 '전형' 이름과 맞추기 위한 별칭 */
  aliases?: string[];
  quota?: number | null;
  method?: string;
  suneungMin?: SuneungRule[] | null;
  suneungMinNote?: string;
}

export interface CalcGroup {
  subjects: string[];
  pick: number | "all";
  /** "인문" 이면 인문계열일 때만, "자연" 이면 인문이 아닐 때만 */
  when?: string;
}

export interface CalcMethod {
  label: string;
  /** 반영 마지막 학기(31 = 3학년 1학기) */
  throughTerm?: number;
  groups: CalcGroup[];
  weight: "credit" | "none";
  bestN?: number;
  /** 과목 수가 모자랄 때 채울 등급 */
  shortfall?: number;
  /** 적용할 입결 전형 이름. "*" 은 교과 전형 전체 */
  tracks: string[];
  exceptDepts?: string[];
  /** 이 이름이 학과명에 들어 있을 때만 적용 */
  onlyDepts?: string[];
  /** 입결 파일의 인문/자연 구분이 이 목록에 있을 때만 적용 */
  onlyFields?: string[];
  note?: string;
}

export interface Guideline {
  schemaVersion: number;
  source: { file: string; university: string; shortName: string; campus?: string; kind: "수시" | "정시"; admissionYear: number };
  review: { status: string; note?: string };
  tracks?: GuidelineTrack[];
  engine?: { version?: number; gyogwa?: CalcMethod[] };
  schedule?: Record<string, unknown>;
  // 나머지 항목(gradeRules, csat 등)은 그대로 보관해 두고 화면에서 필요할 때 씁니다.
  [key: string]: unknown;
}

/** 파일 내용을 읽어 모집요강 JSON 인지 확인합니다. 아니면 Error. */
export function parseGuideline(text: string): Guideline {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error("JSON 형식이 아닙니다.");
  }
  const g = j as Guideline;
  if (!g || typeof g !== "object" || !g.source || typeof g.source.shortName !== "string" || !g.source.kind) {
    throw new Error("모집요강 정리 파일이 아닙니다. (source.shortName·kind 가 없음)");
  }
  if (g.source.kind !== "수시" && g.source.kind !== "정시") throw new Error("구분(수시/정시)을 알 수 없습니다.");
  return g;
}

/**
 * 대학 하나짜리 파일과 여러 대학이 든 통합 파일({bundle:true, guidelines:[...]})을 모두 읽습니다.
 * 통합 파일 안에 모집요강이 아닌 항목이 섞여 있으면 Error.
 */
export function parseGuidelines(text: string): Guideline[] {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error("JSON 형식이 아닙니다.");
  }
  const b = j as { bundle?: boolean; guidelines?: unknown[] };
  if (b && b.bundle && Array.isArray(b.guidelines)) {
    if (!b.guidelines.length) throw new Error("통합 파일에 모집요강이 없습니다.");
    return b.guidelines.map((x) => parseGuideline(JSON.stringify(x)));
  }
  return [parseGuideline(text)];
}

export const guidelineKey = (g: Guideline) =>
  `${g.source.shortName}|${g.source.campus ?? ""}|${g.source.kind}|${g.source.admissionYear}`;

/** 입결 엑셀의 대학 이름(예: 가천대)과 맞는 모집요강을 찾습니다. */
export function findGuideline(list: Guideline[], univ: string, kind: "susi" | "jeongsi"): Guideline | undefined {
  const k = kind === "susi" ? "수시" : "정시";
  return list.find((g) => g.source.kind === k && (g.source.shortName === univ || g.source.university === univ));
}

/** 입결 전형 이름에 해당하는 모집요강 전형 */
export function findTrack(g: Guideline, trackName: string): GuidelineTrack | undefined {
  return (g.tracks ?? []).find((t) => t.aliases?.includes(trackName) || t.name === trackName);
}

// ---- 교과 성적 계산 ----

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface CalcContext {
  /** 입결 파일의 인문/자연 구분 */
  field: string;
  dept: string;
  /** 입결 전형 이름 */
  track: string;
}

export function appliesTo(m: CalcMethod, ctx: CalcContext): boolean {
  if (m.exceptDepts?.some((d) => ctx.dept.includes(d))) return false;
  if (m.onlyDepts && !m.onlyDepts.some((d) => ctx.dept.includes(d))) return false;
  if (m.onlyFields && !m.onlyFields.includes(ctx.field)) return false;
  return m.tracks.includes("*") || m.tracks.includes(ctx.track);
}

/** 한 계산법으로 평균 등급을 구합니다. 반영할 과목이 하나도 없으면 null. */
export function calcGyogwa(courses: CourseRecord[], m: CalcMethod, ctx: CalcContext): number | null {
  const through = m.throughTerm ?? 31;
  const pool = courses.filter((c) => isGraded(c) && c.year * 10 + c.term <= through);
  const picked: { grade: number; credit: number }[] = [];
  for (const g of m.groups) {
    if (g.when === "인문" && ctx.field !== "인문") continue;
    if (g.when === "자연" && ctx.field === "인문") continue;
    const cand = pool
      .filter((c) => g.subjects.includes(groupOf(c.subject)))
      .map((c) => ({ grade: c.rankGrade as number, credit: c.credit ?? 1 }))
      .sort((a, b) => a.grade - b.grade);
    if (g.pick === "all") {
      picked.push(...cand);
    } else {
      picked.push(...cand.slice(0, g.pick));
      for (let i = cand.length; i < g.pick && m.shortfall != null; i++) picked.push({ grade: m.shortfall, credit: 1 });
    }
  }
  if (!picked.length) return null;
  const use = m.bestN ? picked.sort((a, b) => a.grade - b.grade).slice(0, m.bestN) : picked;
  if (m.weight === "credit") {
    const cr = use.reduce((s, p) => s + p.credit, 0);
    return cr ? r2(use.reduce((s, p) => s + p.grade * p.credit, 0) / cr) : null;
  }
  return r2(use.reduce((s, p) => s + p.grade, 0) / use.length);
}

/** 적용 가능한 계산법 중 가장 좋은(작은) 값. 대학이 "우수한 성적 반영"이라고 한 경우를 따릅니다. */
export function bestGyogwa(
  courses: CourseRecord[],
  methods: CalcMethod[] | undefined,
  ctx: CalcContext,
): { value: number; label: string } | null {
  let best: { value: number; label: string } | null = null;
  for (const m of methods ?? []) {
    if (!appliesTo(m, ctx)) continue;
    const v = calcGyogwa(courses, m, ctx);
    if (v != null && (!best || v < best.value)) best = { value: v, label: m.label };
  }
  return best;
}

// ---- 수능 최저 ----

/** 모집단위(학과)·계열에 맞는 수능 최저 규칙 한 줄 */
export function suneungMinFor(track: GuidelineTrack | undefined, dept: string, field: string): SuneungRule | undefined {
  const list = track?.suneungMin;
  if (!list?.length) return undefined;
  const byDept = list.find((r) => r.units.split(/[·,\s]+/).some((u) => u && u.length >= 3 && dept.includes(u)));
  if (byDept) return byDept;
  const fieldKey = field === "인문" ? "인문계열" : "자연계열";
  return list.find((r) => r.units.includes(fieldKey)) ?? list[0];
}

export interface ExamGrades {
  국어: number | null;
  수학: number | null;
  영어: number | null;
  탐구: number | null;
  탐구2: number | null;
}

/**
 * "2개 영역 등급 합 6 이내", "3개 영역 각 1등급", "1개 영역 3등급 이내" 같은 문장을 평가합니다.
 * 읽을 수 없는 문장이면 null. (과학탐구 2과목 평균 소수점 절사 같은 세부는 근사)
 */
export function evalSuneungMin(rule: string, g: ExamGrades): boolean | null {
  const inq = /2과목 평균/.test(rule) && g.탐구 != null && g.탐구2 != null ? Math.floor((g.탐구 + g.탐구2) / 2) : g.탐구;
  const nums = [g.국어, g.수학, g.영어, inq].filter((v): v is number => v != null).sort((a, b) => a - b);
  let m = rule.match(/(\d)개 영역 등급 합 (\d+) 이내/);
  if (m) {
    const n = Number(m[1]);
    if (nums.length < n) return false;
    return nums.slice(0, n).reduce((s, v) => s + v, 0) <= Number(m[2]);
  }
  m = rule.match(/(\d)개 영역 각 (\d)등급/);
  if (m) {
    const n = Number(m[1]);
    const lim = Number(m[2]);
    return nums.length >= n && nums.slice(0, n).every((v) => v <= lim);
  }
  m = rule.match(/(\d)개 영역 (\d)등급 이내/);
  if (m) {
    const lim = Number(m[2]);
    return nums.filter((v) => v <= lim).length >= Number(m[1]);
  }
  return null;
}
