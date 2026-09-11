// 학생별 이분 매칭 배정 + 언덕오르기 최적화.
// prototypes/time-allocation/public/app.js 의 runAssign/cost/coMatrix/pickTimes/
// initialPlacement/optimize 를 순수 함수로 옮긴 것입니다.
//
// 프로토타입과 달리 "인원설정 고정"은 타임 위치 고정이 아니라 **과목별 정원 고정**을
// 뜻합니다(fixedCap). initialPlacement/optimize 는 모든 선택 과목의 배치를 자유롭게 다룹니다.

import type { Assignment, CommonConfig, RosterStudent, RosterSubject } from "../types";
import { blockedBands } from "./bands";

export interface AllocContext {
  numTimes: number;
  cap: number; // 전역 학급당 인원
  allowOver: boolean;
  subjects: RosterSubject[];
  students: RosterStudent[];
  selected: boolean[];
  fixedCap: Record<number, number>;
  common: CommonConfig;
  bandTimes: Array<Record<string, number>>;
}

/** 과목의 실효 정원 — "인원설정 고정"이 켜진 과목은 지정값, 아니면 전역 cap. */
export function capOf(ctx: AllocContext, subjIdx: number): number {
  const v = ctx.fixedCap[subjIdx];
  return typeof v === "number" && v > 0 ? v : ctx.cap;
}

/** 분반 수 기본값 = ceil(신청 인원 / 정원). */
export function defaultSections(count: number, cap: number): number {
  return Math.max(1, Math.ceil(count / Math.max(1, cap)));
}

/** 학생별 "선택 과목 ↔ 타임" 이분 매칭(증가경로 DFS). placement 를 건드리지 않고 결과만 돌려줍니다. */
export function runAssign(ctx: AllocContext, placement: number[][]): Assignment {
  const T = ctx.numTimes;
  const S = ctx.subjects.length;
  const load: number[][] = Array.from({ length: S }, () => new Array(T).fill(0));
  const byStudent: Array<Map<number, number>> = [];
  const unassigned: number[][] = [];

  const stuSubs = ctx.students.map((st) => st.choices.filter((s) => ctx.selected[s]));
  const order = ctx.students.map((_, i) => i);
  const optCount = (i: number) => stuSubs[i].reduce((a, s) => a + placement[s].length, 0);
  order.sort((a, b) => optCount(a) - optCount(b) || a - b);

  const match = (subs: number[], useCap: boolean, blocked: number[]): Map<number, number> => {
    const matchR = new Array(T).fill(-1);
    const adj = subs.map((s) =>
      [...placement[s]]
        .filter((t) => !blocked.includes(t) && (!useCap || load[s][t] < capOf(ctx, s)))
        .sort((a, b) => load[s][a] - load[s][b]),
    );
    const dfs = (i: number, vis: boolean[]): boolean => {
      for (const t of adj[i]) {
        if (vis[t]) continue;
        vis[t] = true;
        if (matchR[t] < 0 || dfs(matchR[t], vis)) {
          matchR[t] = i;
          return true;
        }
      }
      return false;
    };
    const idx = subs.map((_, i) => i).sort((a, b) => adj[a].length - adj[b].length);
    for (const i of idx) dfs(i, new Array(T).fill(false));
    const res = new Map<number, number>();
    matchR.forEach((i, t) => {
      if (i >= 0) res.set(subs[i], t);
    });
    return res;
  };

  for (const i of order) {
    const subs = stuSubs[i];
    const blocked = blockedBands(ctx.students[i].id, ctx.common, ctx.bandTimes);
    let res = match(subs, true, blocked);
    if (res.size < subs.length && ctx.allowOver) res = match(subs, false, blocked);
    byStudent[i] = res;
    unassigned[i] = subs.filter((s) => !res.has(s));
    for (const [s, t] of res) load[s][t]++;
  }
  return { byStudent, unassigned, load };
}

/** 비용 = 미배정×1000 + 정원초과×20 + 분반 불균형×0.05. */
export function cost(ctx: AllocContext, placement: number[][]): { value: number; assign: Assignment } {
  const a = runAssign(ctx, placement);
  let un = 0;
  let over = 0;
  let imb = 0;
  a.unassigned.forEach((u) => (un += u.length));
  ctx.subjects.forEach((s, i) => {
    if (!ctx.selected[i] || !placement[i].length) return;
    const avg = s.count / placement[i].length;
    const c = capOf(ctx, i);
    for (const t of placement[i]) {
      const l = a.load[i][t];
      if (l > c) over += l - c;
      imb += (l - avg) * (l - avg);
    }
  });
  return { value: un * 1000 + over * 20 + imb * 0.05, assign: a };
}

/** 과목 간 동시 선택 빈도 행렬. */
export function coMatrix(ctx: AllocContext): number[][] {
  const S = ctx.subjects.length;
  const co = Array.from({ length: S }, () => new Array(S).fill(0));
  for (const st of ctx.students) {
    const c = st.choices.filter((s) => ctx.selected[s]);
    for (const a of c) for (const b of c) if (a !== b) co[a][b]++;
  }
  return co;
}

/** 과목 s 를 놓을 타임 k개 고르기 — 같이 선택되는 과목과 겹치지 않고 자리가 여유로운 타임 우선. */
export function pickTimes(
  ctx: AllocContext,
  placement: number[][],
  s: number,
  k: number,
  co: number[][],
  exclude: Set<number>,
): number[] {
  const T = ctx.numTimes;
  const seats = new Array(T).fill(0);
  const inT: number[][] = Array.from({ length: T }, () => []);
  ctx.subjects.forEach((_, u) => {
    if (u === s || !ctx.selected[u]) return;
    for (const t of placement[u]) {
      seats[t] += capOf(ctx, u);
      inT[t].push(u);
    }
  });
  const score = (t: number) =>
    inT[t].reduce((a, u) => a + co[s][u] / placement[u].length, 0) + 0.02 * seats[t];
  return [...Array(T).keys()]
    .filter((t) => !exclude.has(t))
    .sort((a, b) => score(a) - score(b))
    .slice(0, k);
}

/**
 * 신청 인원이 많은 과목부터 초기 배치. basePlacement 가 있으면 선택되지 않은(1학기 결과 등)
 * 과목의 기존 배치를 그대로 들고 가고, 선택된 과목만 새로 배치합니다.
 */
export function initialPlacement(
  ctx: AllocContext,
  sections: number[],
  co: number[][],
  basePlacement?: number[][],
): number[][] {
  const placement: number[][] = ctx.subjects.map((_, i) => (basePlacement?.[i] ?? []).slice());
  const order = ctx.subjects
    .map((_, i) => i)
    .filter((i) => ctx.selected[i])
    .sort((a, b) => ctx.subjects[b].count - ctx.subjects[a].count);
  for (const s of order) {
    const k = Math.min(sections[s], ctx.numTimes);
    placement[s] = pickTimes(ctx, placement, s, k, co, new Set());
  }
  return placement;
}

export interface OptimizeResult {
  placement: number[][];
  best: number;
  iter: number;
  assign: Assignment;
}

/** 초기 배치 후 제한 시간 동안 타임 위치를 무작위로 바꿔가며 비용을 낮춥니다. */
export function optimize(
  ctx: AllocContext,
  sections: number[],
  budgetMs = 2000,
  rand: () => number = Math.random,
  basePlacement?: number[][],
): OptimizeResult {
  const co = coMatrix(ctx);
  const placement = initialPlacement(ctx, sections, co, basePlacement);
  let best = cost(ctx, placement).value;
  const movable = ctx.subjects
    .map((_, i) => i)
    .filter((i) => ctx.selected[i] && placement[i].length > 0 && placement[i].length < ctx.numTimes);
  const t0 = now();
  let iter = 0;
  while (movable.length && now() - t0 < budgetMs) {
    iter++;
    const s = movable[Math.floor(rand() * movable.length)];
    const set = new Set(placement[s]);
    const t1 = placement[s][Math.floor(rand() * placement[s].length)];
    const free = [...Array(ctx.numTimes).keys()].filter((t) => !set.has(t));
    if (!free.length) continue;
    const t2 = free[Math.floor(rand() * free.length)];
    placement[s] = placement[s].map((t) => (t === t1 ? t2 : t));
    const c = cost(ctx, placement).value;
    if (c <= best) {
      best = c;
    } else {
      placement[s] = placement[s].map((t) => (t === t2 ? t1 : t));
    }
  }
  const finalCost = cost(ctx, placement);
  return { placement, best, iter, assign: finalCost.assign };
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/**
 * 두 Assignment 를 합칩니다. 과목 idx 가 서로 겹치지 않는다는 전제(호출부에서 보장) —
 * "배정과목 선택"에서 체크 해제해 매칭 대상에서 빠진 과목(1학기 결과 등)을, 다시 매칭한
 * 활성 과목(2학기)과 합쳐서 학생별 결과에 그대로 보여주는 데 씁니다.
 */
export function mergeAssignments(a: Assignment, b: Assignment): Assignment {
  return {
    byStudent: a.byStudent.map((m, i) => new Map([...b.byStudent[i], ...m])),
    unassigned: a.unassigned.map((u, i) => [...b.unassigned[i], ...u].sort((x, y) => x - y)),
    load: a.load.map((row, s) => row.map((v, t) => v + b.load[s][t])),
  };
}
