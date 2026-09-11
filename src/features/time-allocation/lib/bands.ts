// 반 고정 공통과목 → 구획(band) → 타임 고정.
// prototypes/time-allocation/public/app.js 의 classKey/classLabel/bandList/autoPackBands/
// computeFixedBands/blockedBands 를 순수 함수로 옮긴 것입니다.

import type { CommonConfig, CommonSubject, RosterStudent } from "../types";

/** 학번에서 뒤 두 자리(번호)를 뗀 값 = 반 키. */
export const classKey = (id: string): string => (id.length > 2 ? id.slice(0, -2) : id);

/** 반 키 → 사람이 읽는 라벨("101" → "1반"). */
export const classLabel = (key: string): string =>
  key.length > 1 && /^\d+$/.test(key) ? `${+key.slice(1)}반` : `${key}반`;

export interface Band {
  key: number;
  subjects: CommonSubject[];
  credits: number;
  /** 한 타임에 동시에 들어갈 수 있는 반 수 = 구획 안 과목의 교사 수 중 최소값. */
  perTime: number;
}

/** band 번호가 같은 공통과목을 묶습니다. common.on 이 아니면 빈 배열. */
export function bandList(common: CommonConfig): Band[] {
  if (!common.on) return [];
  const map = new Map<number, CommonSubject[]>();
  common.subjects.forEach((s) => {
    if (!map.has(s.band)) map.set(s.band, []);
    map.get(s.band)!.push(s);
  });
  return [...map.keys()]
    .sort((a, b) => a - b)
    .map((b) => {
      const subjects = map.get(b)!;
      return {
        key: b,
        subjects,
        credits: subjects.reduce((a, s) => a + s.credits, 0),
        perTime: Math.max(1, Math.min(...subjects.map((s) => s.teachers))),
      };
    });
}

/** 학점 합이 타임 시수를 넘지 않도록 과목을 구획에 다시 채웁니다(큰 학점부터 first-fit). 새 CommonConfig 를 돌려줍니다. */
export function autoPackBands(common: CommonConfig): CommonConfig {
  const H = Math.max(1, common.hours);
  const subs = common.subjects.map((s) => ({ ...s }));
  const order = subs.map((_, i) => i).sort((a, b) => subs[b].credits - subs[a].credits);
  const bins: Array<{ sum: number; items: number[] }> = [];
  for (const i of order) {
    const c = subs[i].credits;
    let b = bins.find((x) => x.sum + c <= H);
    if (!b) {
      b = { sum: 0, items: [] };
      bins.push(b);
    }
    b.sum += c;
    b.items.push(i);
  }
  bins.forEach((b, bi) => b.items.forEach((i) => (subs[i].band = bi)));
  return { ...common, subjects: subs };
}

/** 학생 목록에서 반 키를 뽑아 정렬합니다. */
export function classKeysOf(students: RosterStudent[]): string[] {
  return [...new Set(students.map((st) => classKey(st.id)))].sort();
}

/** 전체 타임 수 = 선택과목 타임 수 + 구획 수. */
export function totalTimes(numElectiveTimes: number, common: CommonConfig): number {
  return numElectiveTimes + bandList(common).length;
}

export interface FixedBandsResult {
  /** 구획 index → { 반 키: 타임 index } */
  bandTimes: Array<Record<string, number>>;
  /** 배치 실패/경고 문구('' 이면 정상). */
  error: string;
}

/**
 * 구획별 타임 고정: 교사 n명이면 한 타임에 최대 n개 반 → ceil(반수/n)개 타임에 분산.
 * 학생 점유가 가장 적은 타임부터 넣되, 같은 반이 두 구획에서 같은 타임을 쓰지 않게 합니다.
 */
export function computeFixedBands(args: {
  common: CommonConfig;
  students: RosterStudent[];
  numTimes: number;
}): FixedBandsResult {
  const { common, students, numTimes: T } = args;
  const classes = classKeysOf(students);
  if (!common.on || !classes.length) return { bandTimes: [], error: "" };
  const bands = bandList(common);
  if (!bands.length) return { bandTimes: [], error: "" };
  const over = bands.filter((b) => b.credits > common.hours);
  const C = classes.length;
  const sizeOf = (key: string) => students.filter((st) => classKey(st.id) === key).length;
  const chunk = (n: number): string[][] => {
    const k = Math.max(1, Math.ceil(C / n));
    const out: string[][] = [];
    for (let i = 0; i < k; i++) out.push(classes.filter((_, j) => j % k === i));
    return out;
  };
  const occ = new Array(T).fill(0); // 타임별 공통과목 점유 학생 수
  const used = new Map<string, Set<number>>(); // 반 키 → 이미 쓴 타임 Set
  const bandTimes: Array<Record<string, number>> = [];
  for (const band of bands) {
    const map: Record<string, number> = {};
    for (const g of chunk(band.perTime)) {
      const cand = [...Array(T).keys()]
        .filter((t) => g.every((c) => !(used.get(c) || new Set()).has(t)))
        .sort((a, b) => occ[a] - occ[b] || a - b);
      if (!cand.length) {
        return {
          bandTimes: [],
          error: `타임 수가 부족하여 공통과목을 배치할 수 없습니다. 선택과목 타임 수를 늘리세요.`,
        };
      }
      const t = cand[0];
      g.forEach((c) => {
        map[c] = t;
        occ[t] += sizeOf(c);
        if (!used.has(c)) used.set(c, new Set());
        used.get(c)!.add(t);
      });
    }
    bandTimes.push(map);
  }
  if (over.length) {
    return {
      bandTimes,
      error: `구획 ${over.map((b) => b.key + 1).join(", ")}의 학점 합이 타임 시수(${common.hours})를 넘습니다.`,
    };
  }
  return { bandTimes, error: "" };
}

/** 이 학생의 반이 공통과목으로 이미 점유한 타임 목록(선택과목 배정에서 제외). */
export function blockedBands(
  studentId: string,
  common: CommonConfig,
  bandTimes: Array<Record<string, number>>,
): number[] {
  if (!common.on) return [];
  const k = classKey(studentId);
  return bandTimes.map((m) => m[k]).filter((t): t is number => t !== undefined);
}
