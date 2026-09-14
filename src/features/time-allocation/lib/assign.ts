// 학생별 이분 매칭 배정 + 언덕오르기 최적화.
// prototypes/time-allocation/public/app.js 의 runAssign/cost/coMatrix/pickTimes/
// initialPlacement/optimize 를 순수 함수로 옮긴 것입니다.
//
// 프로토타입과 달리 "인원설정 고정"은 타임 위치 고정이 아니라 **과목별 정원 고정**을
// 뜻합니다(fixedCap). initialPlacement/optimize 는 모든 선택 과목의 배치를 자유롭게 다룹니다.

import type { Assignment, RosterStudent, RosterSubject, SemesterBandInfo } from "../types";
import { semesterKeyOf } from "../types";
import { blockedBands } from "./bands";

/** 학기 하나의 배정용 설정 — 정원·인원초과 허용 + 반 고정 공통과목(+그 타임 고정 결과). */
export interface SemesterAllocInfo extends SemesterBandInfo {
  cap: number;
  allowOver: boolean;
  /** 이 학기가 실제로 쓰는 타임 수(선택과목 타임 수 + 이 학기 구획 수, lib/bands.ts의 totalTimes).
   *  그리드 전체 폭(ctx.numTimes)은 학기 중 최대치라 다른 학기가 더 넓게 잡히면 그보다 클 수
   *  있습니다 — 선택과목 배치(pickTimes/optimize)는 반드시 이 값으로 학기 범위를 제한해야
   *  1학기 배정이 2학기 몫 타임까지 넘어가지 않습니다. */
  ownTimes: number;
}

export interface AllocContext {
  numTimes: number;
  subjects: RosterSubject[];
  students: RosterStudent[];
  selected: boolean[];
  fixedCap: Record<number, number>;
  /** semesterKeyOf(subject) → 그 학기의 설정. 1학기/2학기는 서로 다른 설정으로 완전히 독립. */
  bySemester: Record<string, SemesterAllocInfo>;
}

const DEFAULT_CAP = 29;

function infoFor(ctx: AllocContext, subjIdx: number): SemesterAllocInfo | undefined {
  return ctx.bySemester[semesterKeyOf(ctx.subjects[subjIdx])];
}

/** 과목의 실효 정원 — "인원설정 고정"이 켜진 과목은 지정값, 아니면 그 학기의 cap. */
export function capOf(ctx: AllocContext, subjIdx: number): number {
  const v = ctx.fixedCap[subjIdx];
  if (typeof v === "number" && v > 0) return v;
  return infoFor(ctx, subjIdx)?.cap ?? DEFAULT_CAP;
}

/** 분반 수 기본값 = ceil(신청 인원 / 정원). */
export function defaultSections(count: number, cap: number): number {
  return Math.max(1, Math.ceil(count / Math.max(1, cap)));
}

/**
 * 분반 수가 타임 수보다 많으면 같은 타임에 분반을 여러 개 겹쳐 엽니다(교사 여럿이 같은
 * 시간에 각자 다른 교실에서 같은 과목을 가르침). `placement[s]`는 그래서 "중복 없는 타임
 * 집합"이 아니라 **분반 하나당 항목 하나인 다중집합**입니다 — 같은 타임 값이 여러 번
 * 나오면 그 타임에 분반이 그만큼 겹친 것입니다. countAt 은 그 겹친 개수를 셉니다.
 */
export function countAt(times: number[], t: number): number {
  let n = 0;
  for (const x of times) if (x === t) n++;
  return n;
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
    const adj = subs.map((s) => {
      // 정원 체크는 그 시간의 총 정원(분반 수만큼 늘어남) 대비 총 인원으로 — 절대 넘지 않게.
      // 정렬은 "분반 하나당 평균 인원"으로 — 그냥 총원으로 정렬하면 겹친 시간이 이미 다른
      // 분반 하나를 꽉 채우기 전까지는 "덜 찼다"고 오해해 2번째 분반이 계속 비게 됩니다.
      const avgLoad = (t: number) => load[s][t] / countAt(placement[s], t);
      return [...new Set(placement[s])] // 매칭은 시간 단위 — 겹친 분반이라도 같은 t를 두 번 볼 필요 없음
        .filter(
          (t) => !blocked.includes(t) && (!useCap || load[s][t] < capOf(ctx, s) * countAt(placement[s], t)),
        )
        .sort((a, b) => avgLoad(a) - avgLoad(b));
    });
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
    // 1학기/2학기 과목은 서로 다른 학기 그룹이면 같은 타임을 나눠 써도 충돌이 아니므로
    // 그룹(학기)별로 독립된 매칭을 돌립니다(같은 학기 안에서는 기존처럼 한 타임에 하나만).
    // 각 그룹은 그 학기의 공통과목·인원초과 설정을 씁니다.
    const bySemesterSubs = new Map<string, number[]>();
    for (const s of subs) {
      const key = semesterKeyOf(ctx.subjects[s]);
      const arr = bySemesterSubs.get(key);
      if (arr) arr.push(s);
      else bySemesterSubs.set(key, [s]);
    }
    const res = new Map<number, number>();
    for (const [key, group] of bySemesterSubs) {
      const info = ctx.bySemester[key];
      const blocked = info ? blockedBands(ctx.students[i].id, info.common, info.bandTimes) : [];
      let m = match(group, true, blocked);
      if (m.size < group.length && info?.allowOver) m = match(group, false, blocked);
      for (const [s, t] of m) res.set(s, t);
    }
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
    const avgPerSection = s.count / placement[i].length;
    const capPerSection = capOf(ctx, i);
    // 겹친 타임은 분반 수만큼 정원·기댓값이 같이 늘어나야 스케일이 맞습니다 — 분반마다
    // 순회하며 같은 시간을 두 번 세지 않도록 distinct 시간만 봅니다.
    for (const t of new Set(placement[i])) {
      const count = countAt(placement[i], t);
      const c = capPerSection * count;
      const l = a.load[i][t];
      if (l > c) over += l - c;
      const expected = avgPerSection * count;
      imb += (l - expected) * (l - expected);
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
  const sKey = semesterKeyOf(ctx.subjects[s]);
  // 이 과목이 속한 학기 몫의 타임 수로만 후보를 제한합니다 — ctx.numTimes(전체 폭)는 학기 중
  // 최대치라, 그대로 쓰면 더 적게 필요한 학기의 과목이 다른 학기 몫 타임까지 배치될 수 있습니다.
  const T = ctx.bySemester[sKey]?.ownTimes ?? ctx.numTimes;
  const seats = new Array(T).fill(0);
  const inT: number[][] = Array.from({ length: T }, () => []);
  ctx.subjects.forEach((u, uIdx) => {
    // 다른 학기 과목은 같은 타임을 써도 안 겹치므로 자리 혼잡도 계산에서 제외합니다.
    if (uIdx === s || !ctx.selected[uIdx] || semesterKeyOf(u) !== sKey) return;
    for (const t of new Set(placement[uIdx])) {
      seats[t] += capOf(ctx, uIdx) * countAt(placement[uIdx], t);
      inT[t].push(uIdx);
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
 * 과목 s 에 분반 k개를 배치할 시간 목록(중복 가능, 길이=k)을 돌려줍니다.
 * 1단계: 서로 다른 시간을 최대 min(k, ownTimes)개 고름(pickTimes, 같이 신청되는 과목과
 * 안 겹치게·자리 여유 있는 시간 우선이라는 기존 점수 계산 그대로).
 * 2단계: k가 그 학기 타임 수보다 많으면, 남는 분반을 "지금까지 고른 시간 중 이미 담긴
 * 분반이 가장 적은 시간"부터 하나씩 겹쳐 채웁니다(라운드로빈이라 자연히 고르게 퍼짐).
 */
export function assignSectionTimes(
  ctx: AllocContext,
  placement: number[][],
  s: number,
  k: number,
  co: number[][],
): number[] {
  const base = pickTimes(ctx, placement, s, k, co, new Set());
  if (!base.length) return [];
  const times = [...base];
  while (times.length < k) {
    const counts = new Map<number, number>();
    for (const t of times) counts.set(t, (counts.get(t) ?? 0) + 1);
    const least = base.reduce((a, b) => ((counts.get(a) ?? 0) <= (counts.get(b) ?? 0) ? a : b));
    times.push(least);
  }
  return times;
}

/**
 * 신청 인원이 많은 과목부터 초기 배치. basePlacement 가 있으면 선택되지 않은(1학기 결과 등)
 * 과목의 기존 배치를 그대로 들고 가고, 선택된 과목만 새로 배치합니다. 분반 수가 타임
 * 수보다 많아도(assignSectionTimes 가 겹쳐서 채움) 그대로 반영합니다 — 더 이상 numTimes로
 * 자르지 않습니다.
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
    placement[s] = assignSectionTimes(ctx, placement, s, sections[s], co);
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
  // ownTimes(그 과목이 속한 학기 몫의 타임 수)로 제한합니다 — ctx.numTimes(전체 폭)를 그대로
  // 쓰면 더 적게 필요한 학기의 과목이 옮겨다니다 다른 학기 몫 타임까지 넘어갈 수 있습니다.
  const ownTimesOf = (i: number) => ctx.bySemester[semesterKeyOf(ctx.subjects[i])]?.ownTimes ?? ctx.numTimes;
  const movable = ctx.subjects
    .map((_, i) => i)
    .filter((i) => ctx.selected[i] && placement[i].length > 0 && placement[i].length < ownTimesOf(i));
  const t0 = now();
  let iter = 0;
  while (movable.length && now() - t0 < budgetMs) {
    iter++;
    const s = movable[Math.floor(rand() * movable.length)];
    const set = new Set(placement[s]);
    const t1 = placement[s][Math.floor(rand() * placement[s].length)];
    const free = [...Array(ownTimesOf(s)).keys()].filter((t) => !set.has(t));
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

/** "A" + 분반 번호. 그 시간에 분반이 1개뿐이면 번호 없이 "A" 그대로. */
export function sectionLabel(baseLabel: string, ordinal: number, totalAtTime: number): string {
  return totalAtTime > 1 ? `${baseLabel}${ordinal}` : baseLabel;
}

/**
 * (subjIdx, t) 에 배정된 학생 인덱스를 분반 수만큼 정원 단위로 끊어 나눕니다(로스터 순서
 * 기준이라 결정적 — 같은 입력이면 항상 같은 분반 구성). 분반이 1개면 길이 1인 배열.
 */
export function splitSectionStudents(
  ctx: AllocContext,
  placement: number[][],
  assign: Assignment,
  subjIdx: number,
  t: number,
): number[][] {
  const count = Math.max(1, countAt(placement[subjIdx], t));
  const studentIdxs: number[] = [];
  assign.byStudent.forEach((m, i) => {
    if (m.get(subjIdx) === t) studentIdxs.push(i);
  });
  const cap = capOf(ctx, subjIdx);
  const groups: number[][] = Array.from({ length: count }, () => []);
  studentIdxs.forEach((i, order) => groups[Math.min(count - 1, Math.floor(order / cap))].push(i));
  return groups;
}

/**
 * 전체 학생 × 과목에 대해 "A"/"A1"/"A2" 라벨을 한 번에 계산합니다(학생별 결과 표·엑셀·
 * 리로스쿨 재업로드 내보내기가 이 값을 공유). 키는 `${studentIdx}|${subjIdx}`. 겹치지
 * 않은 칸도 항목이 들어가지만 값은 그냥 "A"라 호출부에서 분기 없이 그대로 쓸 수 있습니다.
 */
export function buildSectionLabels(
  ctx: AllocContext,
  placement: number[][],
  assign: Assignment,
  startLetter: number,
): Map<string, string> {
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const timeLabelOf = (t: number) => LETTERS[(startLetter + t) % 26];
  const out = new Map<string, string>();
  ctx.subjects.forEach((_subj, s) => {
    if (!placement[s]?.length) return;
    for (const t of new Set(placement[s])) {
      const groups = splitSectionStudents(ctx, placement, assign, s, t);
      groups.forEach((group, gi) => {
        const label = sectionLabel(timeLabelOf(t), gi + 1, groups.length);
        group.forEach((i) => out.set(`${i}|${s}`, label));
      });
    }
  });
  return out;
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
