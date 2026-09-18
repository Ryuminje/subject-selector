// 이 도구를 거치지 않고 선생님들끼리 이미 해버린 교체·보강을 손으로 입력한 기록.
//
// 왜 필요한가: 수업교체 도우미는 "내가 이 도구로 담은 것"만 압니다. 옆 반 선생님들끼리
// 자기들끼리 바꿔 놓은 건 업로드된 시간표에도, 트레이에도 없습니다. 그 상태로 교체 상대를
// 찾으면 이미 그 시간에 다른 수업을 하고 있는 사람을 "공강"이라고 추천하게 됩니다.
//
// 그래서 한쪽을 막는 메모가 아니라 **시간표 자체를 그 주에 한해 바꿔치웁니다**. 그러면
// 교체·대강·연쇄 검색 로직은 한 줄도 건드리지 않고 그대로 현실을 보게 됩니다.

import { dateForWeekday } from "./makeup/buildRows";
import type { ScheduleRow } from "./sheetData";

/** 시간표 칸 하나 + 그게 실제로 몇 월 며칠인지. 시간표에는 요일만 있어 날짜를 같이 답니다. */
export interface ManualSlot {
  /** "YYYY-MM-DD" */
  date: string;
  /** "월" 같은 요일 이름 (시간표 열 이름) */
  day: string;
  period: number;
}

export type ManualChangeKind = "swap" | "sub";

export interface ManualChange {
  id: string;
  kind: ManualChangeKind;
  /** 원래 그 수업을 맡던 교사 */
  absentTeacher: string;
  /** 그 수업이 있던 칸 */
  absent: ManualSlot;
  /** 대신 들어간 교사 */
  partnerTeacher: string;
  /** 교체일 때만 — 그 대가로 absentTeacher가 맡게 된 partnerTeacher의 칸 */
  exchange?: ManualSlot;
  createdAt: string;
}

/** touched 맵의 키. 한 칸을 교사·요일·교시로 가리킵니다. */
export function cellKey(teacher: string, day: string, period: number): string {
  return `${teacher}|${day}|${period}`;
}

/** 기록이 건드린 칸 하나가 어느 쪽인지 — 수업이 빠져나간 칸인지, 들어온 칸인지. */
export interface TouchedCell {
  change: ManualChange;
  role: "out" | "in";
}

/**
 * 기록을 시간표에 입혀 "그 주에 실제로 이런 모습인 시간표"를 만듭니다.
 *
 * 결강 쪽과 교체 쪽을 **따로** 판정합니다 — 이번 주 수업을 다음 주 수업과 맞바꾸는 일이
 * 흔한데, 그러면 이번 주에는 결강 쪽만, 다음 주에는 교체 쪽만 반영돼야 맞습니다.
 *
 * 원본을 건드리지 않고 얕은 복사본을 돌려줍니다(React 상태로 들어온 배열이라 그대로 쓰면
 * 다음 렌더에서 누적 적용됩니다).
 */
export function applyManualChanges(
  tableData: ScheduleRow[],
  changes: ManualChange[],
  baseDate: string
): { table: ScheduleRow[]; touched: Map<string, TouchedCell> } {
  const table = tableData.map((row) => ({ ...row }));
  const byTeacher = new Map(table.map((row) => [row.teacher, row]));
  const touched = new Map<string, TouchedCell>();

  /** from 교사의 칸에 있던 수업을 to 교사에게 넘깁니다. 원래 칸은 비웁니다. */
  const handOver = (from: ScheduleRow, to: ScheduleRow, slot: ManualSlot, change: ManualChange) => {
    const key = slot.day + slot.period;
    const classStr = from[key];
    // 그 칸에 애초에 수업이 없으면(시간표가 새로 업로드됐다거나) 조용히 넘어갑니다 —
    // 잘못된 기록 하나 때문에 시간표 전체가 깨지는 게 더 나쁩니다.
    if (!classStr) return;
    to[key] = classStr;
    from[key] = "";
    touched.set(cellKey(from.teacher, slot.day, slot.period), { change, role: "out" });
    touched.set(cellKey(to.teacher, slot.day, slot.period), { change, role: "in" });
  };

  for (const change of changes) {
    const absentRow = byTeacher.get(change.absentTeacher);
    const partnerRow = byTeacher.get(change.partnerTeacher);
    if (!absentRow || !partnerRow) continue;

    // 결강 쪽 — 원래 교사의 수업을 상대가 맡습니다 (교체·보강 공통).
    if (dateForWeekday(baseDate, change.absent.day) === change.absent.date) {
      handOver(absentRow, partnerRow, change.absent, change);
    }

    // 교체 쪽 — 그 대가로 원래 교사가 상대의 수업을 맡습니다 (교체일 때만).
    if (change.kind === "swap" && change.exchange && dateForWeekday(baseDate, change.exchange.day) === change.exchange.date) {
      handOver(partnerRow, absentRow, change.exchange, change);
    }
  }

  return { table, touched };
}

/** 그 기록이 baseDate가 속한 주에 조금이라도 걸리는가 — 목록을 "이번 주 것"만 보여줄 때 씁니다. */
export function affectsWeek(change: ManualChange, baseDate: string): boolean {
  if (dateForWeekday(baseDate, change.absent.day) === change.absent.date) return true;
  if (change.exchange && dateForWeekday(baseDate, change.exchange.day) === change.exchange.date) return true;
  return false;
}

/** 오늘에서 days일 뒤로 물러난 "YYYY-MM-DD". 오래된 기록을 버릴 기준선을 잡는 데 씁니다. */
export function cutoffDate(days: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 저장된 JSON을 읽으면서 형태가 어긋난 항목과 오래된 기록을 버립니다.
 *
 * cutoff를 "오늘"로 잡으면 안 됩니다 — 금요일에 이번 주 화요일 기록이 사라져 버립니다.
 * 지난 주를 다시 들여다보는 일도 있어서 넉넉히(cutoffDate(60)) 잡고, 무한히 쌓이는 것만
 * 막는 용도로 씁니다.
 */
export function readManualChanges(raw: string, cutoff: string): ManualChange[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const validSlot = (s: unknown): s is ManualSlot => {
    const slot = s as ManualSlot | undefined;
    return (
      !!slot &&
      typeof slot.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(slot.date) &&
      typeof slot.day === "string" &&
      !!slot.day &&
      typeof slot.period === "number"
    );
  };

  return (parsed as ManualChange[]).filter((c) => {
    if (!c || (c.kind !== "swap" && c.kind !== "sub")) return false;
    if (typeof c.id !== "string" || !c.id) return false;
    if (typeof c.absentTeacher !== "string" || typeof c.partnerTeacher !== "string") return false;
    if (!validSlot(c.absent)) return false;
    if (c.kind === "swap" && !validSlot(c.exchange)) return false;
    // 두 칸 다 기준선보다 오래됐으면 다시 쓰일 일이 없습니다.
    const latest = c.exchange && c.exchange.date > c.absent.date ? c.exchange.date : c.absent.date;
    return latest >= cutoff;
  });
}
