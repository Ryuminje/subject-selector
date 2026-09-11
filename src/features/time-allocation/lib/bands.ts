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
 * 구획별 타임 고정: 교사 n명이면 한 타임에 최대 n개 반.
 *
 * mode:
 *  - "spread"(기본) — 반을 하나씩 가장 한산한 타임부터 넣어, 여유가 있는 한 최대한 여러
 *    타임에 나눠 배치합니다. 단 이러면 모든 타임이 이 구획으로 "조금씩" 막혀 선택과목
 *    배정이 오히려 미배정을 낼 수 있습니다(실제로 겪음 — 사용자가 발견).
 *  - "pack" — 이미 반이 들어간 타임부터 교사 수(perTime)까지 꽉 채운 뒤에만 새 타임을
 *    엽니다. 쓰는 타임 수가 최소화돼 선택과목이 쓸 수 있는 "완전히 안 막힌" 타임이
 *    더 많이 남습니다 — spread로 미배정이 나올 때 hooks/useTimeAllocation.ts의
 *    runOptimize가 자동으로 이걸로 재시도합니다.
 */
export function computeFixedBands(args: {
  common: CommonConfig;
  students: RosterStudent[];
  numTimes: number;
  mode?: "spread" | "pack";
}): FixedBandsResult {
  const { common, students, numTimes: T, mode = "spread" } = args;
  const classes = classKeysOf(students);
  if (!common.on || !classes.length) return { bandTimes: [], error: "" };
  const bands = bandList(common);
  if (!bands.length) return { bandTimes: [], error: "" };
  const over = bands.filter((b) => b.credits > common.hours);
  const sizeOf = (key: string) => students.filter((st) => classKey(st.id) === key).length;
  const occ = new Array(T).fill(0); // 타임별 공통과목 점유 학생 수
  const used = new Map<string, Set<number>>(); // 반 키 → 이미 쓴 타임 Set
  const bandTimes: Array<Record<string, number>> = [];
  for (const band of bands) {
    const map: Record<string, number> = {};
    const slotCount = new Array(T).fill(0); // 이 구획이 각 타임에 이미 넣은 반 수
    for (const c of classes) {
      const cand = [...Array(T).keys()].filter(
        (t) => !(used.get(c) || new Set()).has(t) && slotCount[t] < band.perTime,
      );
      if (mode === "pack") {
        // 이미 이 구획이 들어간(=slotCount>0) 타임 중 꽉 안 찬 곳부터 채우고, 그런 곳이
        // 없을 때만 완전히 새 타임을 엽니다.
        cand.sort((a, b) => slotCount[b] - slotCount[a] || occ[a] - occ[b] || a - b);
      } else {
        // 가장 한산한 타임부터 — 여유가 있는 한 새 타임을 먼저 엽니다.
        cand.sort((a, b) => occ[a] - occ[b] || slotCount[a] - slotCount[b] || a - b);
      }
      if (!cand.length) {
        return {
          bandTimes: [],
          error: `타임 수가 부족하여 공통과목을 배치할 수 없습니다. 선택과목 타임 수를 늘리세요.`,
        };
      }
      const t = cand[0];
      map[c] = t;
      slotCount[t]++;
      occ[t] += sizeOf(c);
      if (!used.has(c)) used.set(c, new Set());
      used.get(c)!.add(t);
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
