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

/**
 * "인원설정 고정"이 켜진 과목인가. 이 과목은 그 학기에 "인원초과 허용"이 켜져 있어도 정원을
 * 절대 넘길 수 없습니다(사용자 확인 2026-10-09: 고정 = "그 이상의 정원은 안 된다").
 */
export function isCapFixed(ctx: AllocContext, subjIdx: number): boolean {
  const v = ctx.fixedCap[subjIdx];
  return typeof v === "number" && v > 0;
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
  const byStudent: Array<Map<number, number>> = ctx.students.map(() => new Map());

  const match = (subs: number[], useCap: boolean, blocked: number[]): Map<number, number> => {
    const matchR = new Array(T).fill(-1);
    const adj = subs.map((s) => {
      // 정원 체크는 그 시간의 총 정원(분반 수만큼 늘어남) 대비 총 인원으로 — 절대 넘지 않게.
      // 정렬은 "분반 하나당 평균 인원"으로 — 그냥 총원으로 정렬하면 겹친 시간이 이미 다른
      // 분반 하나를 꽉 채우기 전까지는 "덜 찼다"고 오해해 2번째 분반이 계속 비게 됩니다.
      const avgLoad = (t: number) => load[s][t] / countAt(placement[s], t);
      return [...new Set(placement[s])] // 매칭은 시간 단위 — 겹친 분반이라도 같은 t를 두 번 볼 필요 없음
        // 정원 검사는 useCap 이거나(인원초과 허용 전 단계), 정원이 고정된 과목이면 언제나 합니다.
        .filter(
          (t) =>
            !blocked.includes(t) &&
            ((!useCap && !isCapFixed(ctx, s)) || load[s][t] < capOf(ctx, s) * countAt(placement[s], t)),
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

  // 1학기/2학기는 애초에 같은 시간에 공존할 수 없는 별개 배정이라, 처리 순서까지 학기별로
  // 따로 계산해 완전히 독립된 패스로 돌립니다. (이전엔 학생 처리 순서를 두 학기 과목 총
  // 개수로 한 번만 정렬해서, 다른 학기를 추가로 선택하면 그 순서가 바뀌어 그리디 매칭
  // 결과인 이 학기 배정까지 덩달아 바뀌는 문제가 있었습니다.)
  const semesterKeys = [...new Set(ctx.subjects.filter((_, i) => ctx.selected[i]).map((s) => semesterKeyOf(s)))];
  for (const key of semesterKeys) {
    const info = ctx.bySemester[key];
    const stuSubs = ctx.students.map((st) =>
      st.choices.filter((s) => ctx.selected[s] && semesterKeyOf(ctx.subjects[s]) === key),
    );
    const order = ctx.students.map((_, i) => i);
    const optCount = (i: number) => stuSubs[i].reduce((a, s) => a + placement[s].length, 0);
    order.sort((a, b) => optCount(a) - optCount(b) || a - b);
    for (const i of order) {
      const subs = stuSubs[i];
      if (!subs.length) continue;
      const blocked = info ? blockedBands(ctx.students[i].id, info.common, info.bandTimes) : [];
      let m = match(subs, true, blocked);
      if (m.size < subs.length && info?.allowOver) m = match(subs, false, blocked);
      for (const [s, t] of m) {
        byStudent[i].set(s, t);
        load[s][t]++;
      }
    }
  }
  const unassigned: number[][] = ctx.students.map((st, i) => {
    const subs = st.choices.filter((s) => ctx.selected[s]);
    return subs.filter((s) => !byStudent[i].has(s));
  });
  return { byStudent, unassigned, load };
}

/**
 * 이분 매칭이 끝난 배정을 "분반 하나당 인원"이 고르게 되도록 다듬습니다.
 *
 * runAssign 은 학생을 한 명씩 그 순간 가장 한산한 타임에 넣는 그리디라, 뒤에 처리되는 학생은
 * 남은 자리에 끼워 맞춰져 타임 간 인원이 쏠립니다(예: 2분반 과목이 25/29). 여기서는 이미
 * 배정된 학생을 (1) 같은 학기의 다른 과목과 시간이 겹치지 않는 선에서 한산한 타임으로
 * 옮기거나, (2) 한산한 타임에 있던 자기 다른 과목과 시간을 맞바꿔서(스왑) 쏠림을 줄입니다.
 * 목표 함수는 과목마다 Σ(타임 인원² ÷ 분반 수) — 총원이 같을 때 분반당 인원이 같아질수록
 * 최소가 됩니다. 정원·반 고정 공통과목으로 막힌 시간·학기 구분은 runAssign 과 똑같이 지키고,
 * 미배정 인원은 건드리지 않습니다(배정된 학생을 옮기기만 함).
 */
export function balanceAssignment(ctx: AllocContext, placement: number[][], a: Assignment): Assignment {
  const S = ctx.subjects.length;
  const load = a.load.map((row) => row.slice());
  const byStudent = a.byStudent.map((m) => new Map(m));
  const EPS = 1e-9;

  const blockedCache = new Map<string, number[]>();
  const blockedOf = (i: number, key: string): number[] => {
    const ck = `${i}|${key}`;
    let b = blockedCache.get(ck);
    if (!b) {
      const info = ctx.bySemester[key];
      b = info ? blockedBands(ctx.students[i].id, info.common, info.bandTimes) : [];
      blockedCache.set(ck, b);
    }
    return b;
  };

  // 정원을 넘기지 않고 t 에 한 명 더 받을 수 있는가(인원초과 허용 학기는 항상 가능).
  const canTake = (s: number, t: number): boolean => {
    const info = infoFor(ctx, s);
    // 정원이 고정된 과목은 인원초과 허용이어도 정원을 넘길 수 없습니다.
    return (!!info?.allowOver && !isCapFixed(ctx, s)) || load[s][t] + 1 <= capOf(ctx, s) * countAt(placement[s], t);
  };
  // 한 명이 from → to 로 옮겨갈 때 Σ(인원²÷분반 수)의 변화량.
  const delta = (s: number, from: number, to: number): number =>
    (1 - 2 * load[s][from]) / countAt(placement[s], from) + (2 * load[s][to] + 1) / countAt(placement[s], to);

  const targets: number[] = [];
  for (let s = 0; s < S; s++) {
    if (ctx.selected[s] && new Set(placement[s]).size >= 2) targets.push(s);
  }

  for (let pass = 0; pass < 100; pass++) {
    let moved = false;
    for (const s of targets) {
      const key = semesterKeyOf(ctx.subjects[s]);
      const times = [...new Set(placement[s])];
      for (const hi of times) {
        for (const lo of times) {
          if (hi === lo) continue;
          for (let i = 0; i < byStudent.length; i++) {
            const m = byStudent[i];
            if (m.get(s) !== hi) continue;
            if (blockedOf(i, key).includes(lo) || !canTake(s, lo)) continue;
            const dS = delta(s, hi, lo);
            // 학생이 같은 학기에서 lo 타임에 이미 듣는 다른 과목
            let other = -1;
            for (const [s2, t2] of m) {
              if (s2 !== s && t2 === lo && semesterKeyOf(ctx.subjects[s2]) === key) {
                other = s2;
                break;
              }
            }
            if (other < 0) {
              if (dS < -EPS) {
                m.set(s, lo);
                load[s][hi]--;
                load[s][lo]++;
                moved = true;
              }
              continue;
            }
            // 맞바꾸기: other 는 hi 로 가야 하므로 그 과목이 hi 에 분반이 있고 정원이 남아야 함
            if (countAt(placement[other], hi) === 0 || !canTake(other, hi)) continue;
            if (dS + delta(other, lo, hi) < -EPS) {
              m.set(s, lo);
              m.set(other, hi);
              load[s][hi]--;
              load[s][lo]++;
              load[other][lo]--;
              load[other][hi]++;
              moved = true;
            }
          }
        }
      }
    }
    if (!moved) break;
  }
  return { byStudent, unassigned: a.unassigned, load };
}

/** rematchAssignment 가 한 학생·한 학기에서 다룰 수 있는 최대 타임 수(비트마스크 DP 라 2^N 으로 커집니다). */
const MAX_REMATCH_TIMES = 12;

/**
 * 학생 한 명씩 "그 학생의 과목들을 시간에 짝짓기"를 **통째로 최적으로 다시** 합니다.
 *
 * balanceAssignment 는 한 명을 한 칸 옮기거나 두 과목을 맞바꾸는 것만 시도해서, 여러 과목이 한꺼번에
 * 자리를 바꿔야 풀리는 쏠림(과목 셋이 돌려 앉기 등)은 못 풉니다. 여기서는 그 학생이 들을 과목들을
 * 서로 다른 타임에 놓는 모든 경우 중 목표 함수가 가장 낮은 것을 DP 로 골라 다시 앉힙니다. 목표는
 * balanceAssignment 와 같은 Σ(타임 인원² ÷ 분반 수)이고, 학생을 뺐다가 다시 넣는 한계 비용
 * (2×인원+1)÷분반 수의 합을 최소화하면 그 학생에 대한 최적입니다. 더 나아지는 학생이 없을 때까지 반복합니다.
 *
 * 정원·반 고정 공통과목으로 막힌 시간·학기 구분은 runAssign 과 같게 지키고, 배정된 학생만 옮기므로
 * 미배정 인원은 바뀌지 않습니다. 실제 자료(학생 190명)로 쏠림이 큰 경우(군을 함께 선택, 택8)에서
 * 분반당 인원 최대 차이를 줄였고, 쏠림이 없는 경우는 결과가 같습니다(2026-10-09 실측).
 */
export function rematchAssignment(ctx: AllocContext, placement: number[][], a: Assignment): Assignment {
  const load = a.load.map((row) => row.slice());
  const byStudent = a.byStudent.map((m) => new Map(m));
  const EPS = 1e-9;
  const INF = 1e18;

  const blockedCache = new Map<string, number[]>();
  const blockedOf = (i: number, key: string): number[] => {
    const ck = `${i}|${key}`;
    let b = blockedCache.get(ck);
    if (!b) {
      const info = ctx.bySemester[key];
      b = info ? blockedBands(ctx.students[i].id, info.common, info.bandTimes) : [];
      blockedCache.set(ck, b);
    }
    return b;
  };
  // 그 학생을 뺀 상태에서 (s, t)에 한 명을 더 받을 수 있는가 — 인원초과 허용이어도 정원 고정 과목은 불가.
  const canTake = (s: number, t: number): boolean => {
    const info = infoFor(ctx, s);
    return (!!info?.allowOver && !isCapFixed(ctx, s)) || load[s][t] + 1 <= capOf(ctx, s) * countAt(placement[s], t);
  };
  const marginal = (s: number, t: number): number => (2 * load[s][t] + 1) / countAt(placement[s], t);

  for (let pass = 0; pass < 40; pass++) {
    let moved = false;
    for (let i = 0; i < byStudent.length; i++) {
      const m = byStudent[i];
      const keys = new Set<string>();
      for (const s of m.keys()) keys.add(semesterKeyOf(ctx.subjects[s]));
      for (const key of keys) {
        const subs = [...m.keys()].filter((s) => semesterKeyOf(ctx.subjects[s]) === key);
        if (subs.length < 2) continue;

        for (const s of subs) load[s][m.get(s)!]--; // 이 학생을 잠시 뺀다
        const restore = () => {
          for (const s of subs) load[s][m.get(s)!]++;
        };
        const blocked = blockedOf(i, key);
        const opts = subs.map((s) =>
          [...new Set(placement[s])].filter((t) => !blocked.includes(t) && canTake(s, t)),
        );
        const times = [...new Set(opts.flat())].sort((x, y) => x - y);
        if (times.length > MAX_REMATCH_TIMES) {
          restore();
          continue;
        }
        const bit = new Map(times.map((t, k) => [t, k]));
        const size = 1 << times.length;
        // dp[k][mask] = 앞 k개 과목을 mask 에 해당하는 타임들에 서로 겹치지 않게 놓았을 때의 최소 비용
        const dp: number[][] = Array.from({ length: subs.length + 1 }, () => new Array<number>(size).fill(INF));
        const from: Array<Array<[number, number] | null>> = Array.from({ length: subs.length + 1 }, () =>
          new Array<[number, number] | null>(size).fill(null),
        );
        dp[0][0] = 0;
        for (let k = 0; k < subs.length; k++) {
          for (let mask = 0; mask < size; mask++) {
            if (dp[k][mask] >= INF) continue;
            for (const t of opts[k]) {
              const b = 1 << bit.get(t)!;
              if (mask & b) continue;
              const v = dp[k][mask] + marginal(subs[k], t);
              if (v < dp[k + 1][mask | b]) {
                dp[k + 1][mask | b] = v;
                from[k + 1][mask | b] = [mask, t];
              }
            }
          }
        }
        let best = INF;
        let bestMask = -1;
        for (let mask = 0; mask < size; mask++) {
          if (dp[subs.length][mask] < best) {
            best = dp[subs.length][mask];
            bestMask = mask;
          }
        }
        const curCost = subs.reduce((x, s) => x + marginal(s, m.get(s)!), 0);
        if (bestMask >= 0 && best < curCost - EPS) {
          let mask = bestMask;
          for (let k = subs.length; k >= 1; k--) {
            const [prev, t] = from[k][mask]!;
            m.set(subs[k - 1], t);
            mask = prev;
          }
          moved = true;
        }
        restore();
      }
    }
    if (!moved) break;
  }
  return { byStudent, unassigned: a.unassigned, load };
}

/**
 * runAssign + 분반당 인원 균형 맞추기(한 칸 옮기기·맞바꾸기 → 학생별 통째로 다시 짝짓기).
 * 화면·결과·내보내기에 쓰는 최종 배정은 이걸 씁니다.
 */
export function runAssignBalanced(ctx: AllocContext, placement: number[][]): Assignment {
  return rematchAssignment(ctx, placement, balanceAssignment(ctx, placement, runAssign(ctx, placement)));
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

/**
 * 초기 배치 후 제한 시간 동안 타임 위치를 무작위로 바꿔가며 비용을 낮춥니다.
 *
 * 1학기/2학기는 같은 시간에 공존할 수 없는 완전히 별개의 배정이라, 학기별로 나눠 각자
 * budgetMs 전체를 씁니다(선택 과목만 `selected`를 가린 임시 컨텍스트로 한 학기씩 처리).
 * 한 번에 다 돌리면 ① 다른 학기 과목이 늘어날수록 같은 시간 예산을 더 많은 과목이 나눠
 * 써서 탐색 횟수가 희석되고, ② cost()가 전체 과목을 합쳐 계산해 반복마다 더 느려집니다 —
 * 그 결과 다른 학기를 추가로 선택하기만 해도 이 학기의 배정 품질(그래서 실제 배정 결과)이
 * 흔들리는 문제가 있었습니다.
 */
export function optimize(
  ctx: AllocContext,
  sections: number[],
  budgetMs = 2000,
  rand: () => number = Math.random,
  basePlacement?: number[][],
): OptimizeResult {
  const semesterKeys = [...new Set(ctx.subjects.filter((_, i) => ctx.selected[i]).map((s) => semesterKeyOf(s)))];
  let placement = ctx.subjects.map((_, i) => (basePlacement?.[i] ?? []).slice());
  let iter = 0;
  for (const key of semesterKeys) {
    const semCtx: AllocContext = {
      ...ctx,
      selected: ctx.subjects.map((s, i) => ctx.selected[i] && semesterKeyOf(s) === key),
    };
    const co = coMatrix(semCtx);
    placement = initialPlacement(semCtx, sections, co, placement);
    let best = cost(semCtx, placement).value;
    const ownTimes = ctx.bySemester[key]?.ownTimes ?? ctx.numTimes;
    const movable = semCtx.subjects
      .map((_, i) => i)
      .filter((i) => semCtx.selected[i] && placement[i].length > 0 && placement[i].length < ownTimes);
    const t0 = now();
    while (movable.length && now() - t0 < budgetMs) {
      iter++;
      const s = movable[Math.floor(rand() * movable.length)];
      const set = new Set(placement[s]);
      const t1 = placement[s][Math.floor(rand() * placement[s].length)];
      const free = [...Array(ownTimes).keys()].filter((t) => !set.has(t));
      if (!free.length) continue;
      const t2 = free[Math.floor(rand() * free.length)];
      placement[s] = placement[s].map((t) => (t === t1 ? t2 : t));
      const c = cost(semCtx, placement).value;
      if (c <= best) {
        best = c;
      } else {
        placement[s] = placement[s].map((t) => (t === t2 ? t1 : t));
      }
    }
  }
  const finalCost = cost(ctx, placement);
  return { placement, best: finalCost.value, iter, assign: finalCost.assign };
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
  // 같은 타임에 겹친 분반은 같은 시간이라 어느 쪽에 넣어도 다른 곳에 영향이 없습니다 — 정원 순서대로
  // 앞 분반부터 채우면 (23, 19)처럼 쏠리므로, 인원을 최대한 고르게(차이 1명 이내) 나눕니다.
  // n ≤ 정원×분반 수이면 어느 분반도 ceil(n/count) ≤ 정원이라 정원을 넘지 않습니다.
  const n = studentIdxs.length;
  const groups: number[][] = Array.from({ length: count }, () => []);
  const base = Math.floor(n / count);
  const extra = n % count;
  let at = 0;
  for (let g = 0; g < count; g++) {
    const size = base + (g < extra ? 1 : 0);
    groups[g] = studentIdxs.slice(at, at + size);
    at += size;
  }
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
