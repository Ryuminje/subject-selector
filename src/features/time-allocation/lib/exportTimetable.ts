// 타임 배정 결과 → "타임별 시간표" 엑셀. 선택과목 변경 탭의 "타임별 시간표 입력" 화면과 같은 모양입니다
// (행 = 타임, 열 = 2-1, 2-2 …, 칸마다 과목명 줄 + 교사명 줄). 교사 이름은 이 탭이 모르므로 빈 줄로 둡니다.

import * as XLSX from "xlsx-js-style";
import type { RoomPin, RosterSubject, SemesterBandInfo } from "../types";
import { bandList } from "./bands";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** 시간표를 만드는 데 필요한 것만 — 그리드·학생 결과 화면의 컨텍스트가 둘 다 이 모양을 만족합니다. */
export interface TimetableCtx {
  numTimes: number;
  startLetter: number;
  subjects: RosterSubject[];
  semesterKeys: string[];
  bySemester: Record<string, SemesterBandInfo>;
}

interface Item {
  name: string;
  /** 항목 키(TimetableEntry.key) — 같은 구획의 여러 칸이 같은 키를 갖는다 */
  key?: string;
  times: number[];
  /** 특별실로 고정된 열(0부터). 없으면 일반 배치 */
  pinCol?: number;
  /** 같은 타임에 분반이 여럿인 과목을 칸으로 나눴을 때(선택과목 변경 탭 전달용): 몇 번째 칸인지(0부터)와 타임별 분반 수 */
  sectionLane?: { lane: number; counts: Map<number, number> };
}

/** 타임마다 가장 많이 놓인 칸 수 = 필요한 최소 열 수 */
function minCols(items: Item[], numTimes: number): number {
  const cnt = new Array(numTimes).fill(0);
  items.forEach((it) => it.times.forEach((t) => cnt[t]++));
  return Math.max(1, ...cnt);
}

/** 1순위: 같은 과목이 모든 타임에서 같은 열이 되게 K색 칠하기(겹치는 과목끼리만 다른 열). 못 찾으면 null. */
function colorColumns(items: Item[], K: number): number[] | null {
  const n = items.length;
  const conflict = items.map((a, i) =>
    items.map((b, j) => i !== j && a.times.some((t) => b.times.includes(t))),
  );
  // 겹침이 많은 과목부터 정하면 막히는 가지를 일찍 쳐 낼 수 있다
  const order = items.map((_, i) => i).sort((a, b) => conflict[b].filter(Boolean).length - conflict[a].filter(Boolean).length);
  const col = new Array(n).fill(-1);
  let nodes = 0;
  const go = (k: number, used: number): boolean => {
    if (k === n) return true;
    if (++nodes > 200000) return false; // 너무 오래 걸리면 포기하고 2순위로
    const i = order[k];
    for (let c = 0; c < Math.min(K, used + 1); c++) {
      if (conflict[i].some((x, j) => x && col[j] === c)) continue;
      col[i] = c;
      if (go(k + 1, Math.max(used, c + 1))) return true;
      col[i] = -1;
    }
    return false;
  };
  return go(0, 0) ? col : null;
}

/** 직사각 최소비용 배정(헝가리안, n ≤ m). 행 i 가 들어갈 열 번호를 돌려준다. */
function hungarian(cost: number[][], m: number): number[] {
  const n = cost.length;
  const u = new Array(n + 1).fill(0);
  const v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0);
  const way = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(Infinity);
    const used = new Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const res = new Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) res[p[j] - 1] = j - 1;
  return res;
}

/**
 * 2순위(1순위가 안 될 때): 타임별로 열을 다시 짜되, 그 과목이 다른 타임에서 쓴 열과의 거리 합이 가장 작게
 * (= 같은 열이 제일 좋고, 안 되면 바로 옆 열) 헝가리안으로 배정한다. 몇 바퀴 돌며 다듬는다.
 */
function sweepColumns(items: Item[], K: number, numTimes: number): number[][] {
  const at: number[][] = Array.from({ length: numTimes }, () => []);
  items.forEach((it, i) => it.times.forEach((t) => at[t].push(i)));
  const colOf: Array<Map<number, number>> = items.map(() => new Map()); // 과목 → (타임 → 열)
  const order = at.map((_, t) => t).sort((a, b) => at[b].length - at[a].length);
  const place = (t: number) => {
    const ids = at[t];
    if (!ids.length) return;
    const cost = ids.map((i) =>
      Array.from({ length: K }, (_, c) => {
        let s = c * 0.001; // 비교할 곳이 없으면 왼쪽부터 채움
        colOf[i].forEach((col, tt) => {
          if (tt !== t) s += Math.abs(c - col);
        });
        return s;
      }),
    );
    hungarian(cost, K).forEach((c, k) => colOf[ids[k]].set(t, c));
  };
  order.forEach(place);
  for (let round = 0; round < 4; round++) order.forEach(place);
  return at.map((ids, t) => {
    const row = new Array(K).fill(-1);
    ids.forEach((i) => (row[colOf[i].get(t)!] = i));
    return row;
  });
}

const thin = { style: "thin", color: { rgb: "999999" } };
const border = { top: thin, bottom: thin, left: thin, right: thin };
const center = { vertical: "center", horizontal: "center", wrapText: true };

export interface TimetableOptions {
  /** 열 머리글 앞 번호 — 2학년이면 2 → "2-1", "2-2" … */
  gradeNo: number;
  /** 구획(논술, 체육 + 진로 등 반 고정 공통과목)도 칸으로 넣는다. */
  includeBands: boolean;
  /** "1학기"/"2학기" — 학기마다 같은 타임 문자를 쓰므로 하나만 담는다. 없으면 전부. */
  semester?: string;
  /** 특별실 고정 — 항목 키 → 열 번호(1부터)와 이름. 그 열은 고정한 과목만 쓰고 나머지 과목은 다른 열에 놓는다. */
  pins?: Record<string, RoomPin>;
  /** 같은 타임에 분반이 여럿인 선택과목을 분반 수만큼 칸으로 나눈다(선택과목 변경 탭 전달용). 기본은 한 칸. */
  sectionLanes?: boolean;
}

/** 시간표의 한 항목 = 과목 하나(또는 구획 하나). */
export interface TimetableEntry {
  /** 특별실 고정에 쓰는 키(학기+과목명, 구획은 "구획|학기|이름") */
  key: string;
  name: string;
  kind: "subject" | "band";
  /** 타임 → 그 타임에 열리는 반(분반) 수 */
  count: Map<number, number>;
  /** 한 타임에 필요한 칸 수의 최댓값 — 구획은 반마다 따로 수업이 열려 반 수만큼, 선택과목은 1 */
  lanes: number;
}

/** 지금 배치에서 시간표에 올라가는 항목 목록(고정 설정 화면과 엑셀이 같은 목록을 씁니다). */
export function buildTimetableEntries(
  ctx: TimetableCtx,
  placement: number[][],
  opts: { includeBands: boolean; semester?: string; sectionLanes?: boolean },
): TimetableEntry[] {
  const keep = (sem: string) => !opts.semester || !sem || sem === "1~2학기" || sem === opts.semester;
  const entries: TimetableEntry[] = [];
  ctx.subjects.forEach((s) => {
    if (!keep(s.semester ?? "")) return;
    const count = new Map<number, number>();
    (placement[s.idx] ?? []).forEach((t) => count.set(t, (count.get(t) ?? 0) + 1));
    // 선택과목은 보통 한 타임에 한 칸(교사가 여럿이면 한 칸에 같이 적음). sectionLanes 면 분반이 가장 많은 타임에 맞춰 칸을 나눈다.
    if (count.size) entries.push({ key: `${s.semester ?? ""}|${s.name}`, name: s.name, kind: "subject", count, lanes: opts.sectionLanes ? Math.max(...count.values()) : 1 });
  });
  if (opts.includeBands) {
    ctx.semesterKeys.forEach((key) => {
      const info = ctx.bySemester[key];
      if (!info?.common.on || !keep(key)) return;
      bandList(info.common).forEach((b, bi) => {
        const count = new Map<number, number>();
        Object.values(info.bandTimes[bi] ?? {}).forEach((t) => count.set(t, (count.get(t) ?? 0) + 1));
        const name = b.subjects.map((s) => s.name).join(" + ");
        if (count.size) entries.push({ key: `구획|${key}|${name}`, name, kind: "band", count, lanes: Math.max(...count.values()) });
      });
    });
  }
  return entries;
}

/** 타임 × 열 시간표의 배치 결과(엑셀과 선택과목 변경 탭 전달이 같이 쓴다) */
interface TimetableLayout {
  entries: TimetableEntry[];
  items: Item[];
  /** grid[타임][열] = items 인덱스(-1 이면 빈칸) */
  grid: number[][];
  /** 내용이 있는 타임만 */
  times: { t: number; row: number[] }[];
  cols: number;
  moved: number;
  released: string[];
  colLabel: Map<number, string>;
  title: string;
}

function layoutTimetable(ctx: TimetableCtx, placement: number[][], opts: TimetableOptions): TimetableLayout {
  const entries = buildTimetableEntries(ctx, placement, opts);

  // 시간표 칸: 선택과목은 한 타임에 한 칸(교사가 여럿이면 한 칸에 같이 적음). 구획은 반마다 따로 수업이 열리므로
  // 그 타임의 반 수만큼 칸을 쓴다(2반이면 2칸) — 반 수가 가장 많은 타임에 맞춰 같은 구획을 "줄"로 나눠 칸으로 만든다.
  const pins = opts.pins ?? {};
  const items: Item[] = [];
  entries.forEach((e) => {
    for (let j = 0; j < e.lanes; j++) {
      // 칸 j 는 그 타임의 반(분반) 수가 j 보다 큰 타임에만 놓인다 — 한 칸짜리(lanes 1)는 모든 타임이 해당
      const times = [...e.count].filter(([, n]) => n > j).map(([t]) => t).sort((a, b) => a - b);
      const pin = pins[e.key];
      items.push({
        name: e.name,
        key: e.key,
        times,
        pinCol: pin ? Math.max(1, pin.col) - 1 + j : undefined,
        sectionLane: e.kind === "subject" && e.lanes > 1 ? { lane: j, counts: e.count } : undefined,
      });
    }
  });

  // 특별실 고정 검증: 같은 열에 고정된 과목끼리 타임이 겹치면 뒤에 온 쪽은 고정을 풀고 일반 배치로 돌린다.
  const released: string[] = [];
  const occupied = new Map<number, Set<number>>();
  entries.forEach((e) => {
    if (!pins[e.key]) return;
    const lanes = items.filter((it) => it.key === e.key);
    const clash = lanes.some((it) => it.times.some((t) => occupied.get(it.pinCol!)?.has(t)));
    if (clash) {
      lanes.forEach((it) => (it.pinCol = undefined));
      released.push(e.name);
      return;
    }
    lanes.forEach((it) => {
      const used = occupied.get(it.pinCol!) ?? new Set<number>();
      it.times.forEach((t) => used.add(t));
      occupied.set(it.pinCol!, used);
    });
  });

  // 열 수: 고정 열은 고정 과목 전용(나머지는 못 씀)이라, 남은 열이 나머지 과목의 동시 수업 수를 감당할 때까지 늘린다.
  const reserved = new Set(items.flatMap((it) => (it.pinCol === undefined ? [] : [it.pinCol])));
  const freeIdx = items.map((_, i) => i).filter((i) => items[i].pinCol === undefined);
  const needFree = freeIdx.length ? minCols(freeIdx.map((i) => items[i]), ctx.numTimes) : 0;
  let K = Math.max(1, ...[...reserved].map((c) => c + 1));
  while (K - reserved.size < needFree) K++;
  const freeCols = Array.from({ length: K }, (_, c) => c).filter((c) => !reserved.has(c));

  const grid: number[][] = Array.from({ length: ctx.numTimes }, () => new Array(K).fill(-1));
  items.forEach((it, i) => it.pinCol !== undefined && it.times.forEach((t) => (grid[t][it.pinCol!] = i)));
  if (freeIdx.length) {
    // 나머지: 같은 과목은 모든 타임에서 같은 열, 안 되면 가까운 열
    const freeItems = freeIdx.map((i) => items[i]);
    const fixed = colorColumns(freeItems, freeCols.length);
    const rows: number[][] = fixed
      ? Array.from({ length: ctx.numTimes }, (_, t) => {
          const row = new Array(freeCols.length).fill(-1);
          freeItems.forEach((it, k) => it.times.includes(t) && (row[fixed[k]] = k));
          return row;
        })
      : sweepColumns(freeItems, freeCols.length, ctx.numTimes);
    rows.forEach((row, t) => row.forEach((k, c) => k >= 0 && (grid[t][freeCols[c]] = freeIdx[k])));
  }

  // 분반으로 나눈 칸(현대사회와 윤리1·2)은 이웃한 열에 놓는다. 위 배치는 "같은 과목이 모든 타임에서 같은 열"만 맞추므로, 한 타임에 칸이 가득 차면
  // 둘째 칸이 남은 맨 끝 열로 밀려 멀리 떨어진다. 둘째 칸이 있는 열 전체를 첫째 칸의 바로 오른쪽으로 옮긴다(열 통째로 옮기므로
  // 그 열의 다른 과목도 같은 열을 유지한다). 특별실 고정 열은 제자리에 둔다.
  if (opts.sectionLanes) {
    const order = freeCols.slice(); // order[k] = 자유 열 자리 k 에 지금 놓인 열(원래 열 번호)
    const dominantCol = (item: number): number => {
      const cnt = new Map<number, number>();
      grid.forEach((row) => row.forEach((x, c) => x === item && cnt.set(c, (cnt.get(c) ?? 0) + 1)));
      return [...cnt].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? -1;
    };
    const groups = new Map<string, number[]>();
    items.forEach((it, i) => {
      if (!it.sectionLane || it.pinCol !== undefined || !it.key) return;
      groups.set(it.key, [...(groups.get(it.key) ?? []), i]);
    });
    groups.forEach((idxs) => {
      idxs.sort((a, b) => items[a].sectionLane!.lane - items[b].sectionLane!.lane);
      for (let n = 1; n < idxs.length; n++) {
        const prev = dominantCol(idxs[n - 1]);
        const mine = dominantCol(idxs[n]);
        const from = order.indexOf(mine);
        if (prev < 0 || mine < 0 || from < 0 || order.indexOf(prev) < 0 || mine === prev) continue;
        order.splice(from, 1);
        order.splice(order.indexOf(prev) + 1, 0, mine);
      }
    });
    if (order.some((c, k) => c !== freeCols[k])) {
      const before = grid.map((row) => row.slice());
      order.forEach((from, k) => grid.forEach((row, t) => (row[freeCols[k]] = before[t][from])));
    }
  }
  const moved = items.filter((_, i) => new Set(grid.map((row) => row.indexOf(i)).filter((c) => c >= 0)).size > 1).length;

  const times = grid.map((row, t) => ({ t, row })).filter((x) => x.row.some((i) => i >= 0));
  const cols = K;
  const title = `${opts.gradeNo}학년 타임별 시간표${opts.semester ? ` (${opts.semester})` : ""}`;
  // 고정 열 머리글에 이름(과학실 등)을 붙인다
  const colLabel = new Map<number, string>();
  items.forEach((it) => {
    const label = it.pinCol !== undefined && it.key ? pins[it.key]?.label?.trim() : "";
    if (label && !colLabel.has(it.pinCol!)) colLabel.set(it.pinCol!, label);
  });
  return { entries, items, grid, times, cols, moved, released, colLabel, title };
}

/** 선택과목 변경 탭의 "타임별 시간표 입력"에 그대로 넣을 수 있는 모양(교사명은 비워 둠) */
export interface TransferTimetable {
  /** 타임 문자 목록(A, B, …) */
  slots: string[];
  /** 열 이름(2-1, 2-2 …, 특별실 이름이 있으면 "2-3 (과학실)") */
  cols: string[];
  cells: Record<string, Record<string, { subject: string; teacher: string }>>;
}

/** 타임 배정 탭 → 선택과목 변경 탭으로 보내는 한 벌(변경 탭이 window.receiveTimeAllocation 으로 받음) */
export interface TimeAllocTransfer {
  grade: "pre1" | "grade1" | "grade2";
  /** 어느 학기의 배정인지(없으면 연간) */
  semester?: string;
  /** 변경 탭의 "업로드한 파일" 자리에 표시할 이름 */
  label: string;
  /** "선택과목 변경용 엑셀"과 같은 내용(바이너리 문자열) — 변경 탭이 업로드한 파일처럼 해석·보관한다 */
  binary: string;
  timetable: TransferTimetable;
}

export function timetableForTransfer(ctx: TimetableCtx, placement: number[][], opts: TimetableOptions): TransferTimetable {
  // 같은 타임에 분반이 여럿인 선택과목은 칸을 나눠 "현대사회와 윤리1", "현대사회와 윤리2"처럼 넣는다(변경 탭은 이름 끝의 숫자를
  // 분반 번호로 읽는다). 분반이 하나뿐인 타임은 이름 그대로.
  const L = layoutTimetable(ctx, placement, { ...opts, sectionLanes: true });
  const slots = L.times.map(({ t }) => LETTERS[(ctx.startLetter + t) % 26]);
  const cols = Array.from({ length: L.cols }, (_, i) => `${opts.gradeNo}-${i + 1}${L.colLabel.has(i) ? ` (${L.colLabel.get(i)})` : ""}`);
  const cells: TransferTimetable["cells"] = {};
  L.times.forEach(({ t, row }, ti) => {
    cells[slots[ti]] = {};
    row.forEach((idx, c) => {
      if (idx < 0) return;
      const it = L.items[idx];
      const sl = it.sectionLane;
      const split = sl && (sl.counts.get(t) ?? 1) > 1;
      cells[slots[ti]][cols[c]] = { subject: split ? `${it.name}${sl!.lane + 1}` : it.name, teacher: "" };
    });
  });
  return { slots, cols, cells };
}

export function exportTimetableXlsx(
  ctx: TimetableCtx,
  placement: number[][],
  fileName: string,
  opts: TimetableOptions,
): { times: number; cols: number; moved: number; released: string[] } {
  const { entries, items, times, cols, moved, released, colLabel, title } = layoutTimetable(ctx, placement, opts);

  const aoa: string[][] = [
    [title],
    [],
    ["타임", ...Array.from({ length: cols }, (_, i) => `${opts.gradeNo}-${i + 1}${colLabel.has(i) ? ` (${colLabel.get(i)})` : ""}`)],
  ];
  times.forEach(({ t, row }) => {
    aoa.push([LETTERS[(ctx.startLetter + t) % 26] + "타임", ...row.map((i) => (i >= 0 ? items[i].name : ""))]);
    aoa.push(["", ...new Array(cols).fill("")]); // 교사 줄(직접 채움)
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const merges: XLSX.Range[] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: cols } }];
  times.forEach((_, i) => merges.push({ s: { r: 3 + i * 2, c: 0 }, e: { r: 4 + i * 2, c: 0 } }));
  ws["!merges"] = merges;

  const range = XLSX.utils.decode_range(ws["!ref"]!);
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) ws[ref] = { t: "s", v: "" };
      if (r === 0) {
        ws[ref].s = { font: { bold: true, sz: 14 }, alignment: { vertical: "center", horizontal: "left" } };
      } else if (r === 1) {
        continue;
      } else if (r === 2) {
        ws[ref].s = { font: { bold: true }, fill: { fgColor: { rgb: "E0E7FF" } }, alignment: center, border };
      } else {
        const isSubjectRow = (r - 3) % 2 === 0;
        ws[ref].s = {
          font: c === 0 || isSubjectRow ? { bold: true } : { sz: 9 },
          fill: c === 0 ? { fgColor: { rgb: "F1F5F9" } } : undefined,
          alignment: center,
          border,
        };
      }
    }
  }
  ws["!cols"] = [{ wch: 10 }, ...new Array(cols).fill({ wch: 16 })];
  ws["!rows"] = aoa.map((_, r) => (r === 0 ? { hpt: 24 } : r >= 3 ? { hpt: (r - 3) % 2 === 0 ? 24 : 18 } : { hpt: 20 }));

  // 두 번째 시트: 열 = 과목 하나씩, 행 = 타임(A, B, C …), 그 과목이 열리는 타임의 교차 칸에 과목명
  const usedTimes = [...new Set(entries.flatMap((e) => [...e.count.keys()]))].sort((a, b) => a - b);
  const aoa2: string[][] = [
    [`${opts.gradeNo}학년 과목별 타임${opts.semester ? ` (${opts.semester})` : ""}`],
    [],
    ["타임", ...entries.map((e) => e.name)],
    ...usedTimes.map((t) => [LETTERS[(ctx.startLetter + t) % 26] + "타임", ...entries.map((e) => (e.count.has(t) ? e.name : ""))]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(aoa2);
  for (let r = 0; r < aoa2.length; r++) {
    for (let c = 0; c <= entries.length; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (r === 0) {
        if (ws2[ref]) ws2[ref].s = { font: { bold: true, sz: 14 } };
        continue;
      }
      if (r === 1) continue;
      if (!ws2[ref]) ws2[ref] = { t: "s", v: "" };
      const filled = r > 2 && c > 0 && ws2[ref].v !== "";
      ws2[ref].s =
        r === 2
          ? { font: { bold: true }, fill: { fgColor: { rgb: "E0E7FF" } }, alignment: center, border }
          : { font: c === 0 ? { bold: true } : undefined, fill: c === 0 ? { fgColor: { rgb: "F1F5F9" } } : filled ? { fgColor: { rgb: "FEF3C7" } } : undefined, alignment: center, border };
    }
  }
  ws2["!cols"] = [{ wch: 10 }, ...entries.map((e) => ({ wch: Math.max(12, e.name.length * 2 + 2) }))];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "타임별 시간표");
  XLSX.utils.book_append_sheet(wb, ws2, "과목별 타임");
  XLSX.writeFile(wb, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
  return { times: times.length, cols, moved, released };
}
