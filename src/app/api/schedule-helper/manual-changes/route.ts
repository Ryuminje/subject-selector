import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cutoffDate, readManualChanges, type ManualChange, type ManualSlot } from "@/features/schedule-helper/lib/manualChanges";
import { parseDate, weekdayOf } from "@/features/schedule-helper/lib/makeup/buildRows";

// 이 도구를 거치지 않고 선생님들끼리 이미 해버린 교체·보강 기록. 학교 전체가 공유합니다 —
// 누가 입력했든 "그 시간에 실제로 누가 있는가"는 모두에게 같은 사실이기 때문입니다.

/** 오래된 기록만 걷어냅니다. 이번 주 지난 요일이 사라지면 안 되므로 넉넉히 잡습니다. */
const KEEP_DAYS = 60;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseSlot(value: unknown): ManualSlot | null {
  const slot = value as Partial<ManualSlot> | undefined;
  if (!slot || typeof slot.date !== "string" || !DATE_RE.test(slot.date)) return null;
  if (typeof slot.day !== "string" || !slot.day.trim()) return null;
  if (typeof slot.period !== "number" || !Number.isFinite(slot.period)) return null;
  return { date: slot.date, day: slot.day.trim(), period: slot.period };
}

async function loadList(schoolId: string) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { manualChanges: true },
  });
  return readManualChanges(school?.manualChanges ?? "[]", cutoffDate(KEEP_DAYS));
}

async function saveList(schoolId: string, list: ManualChange[]) {
  await prisma.school.update({
    where: { id: schoolId },
    data: { manualChanges: JSON.stringify(list) },
  });
  return NextResponse.json({ manualChanges: list });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const kind = body?.kind === "swap" || body?.kind === "sub" ? body.kind : null;
  const absentTeacher = typeof body?.absentTeacher === "string" ? body.absentTeacher.trim() : "";
  const partnerTeacher = typeof body?.partnerTeacher === "string" ? body.partnerTeacher.trim() : "";
  const absent = parseSlot(body?.absent);
  const exchange = kind === "swap" ? parseSlot(body?.exchange) : null;

  if (!kind || !absentTeacher || !partnerTeacher || !absent || (kind === "swap" && !exchange)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (absentTeacher === partnerTeacher) {
    return NextResponse.json({ error: "같은 선생님끼리는 교체할 수 없습니다." }, { status: 400 });
  }

  const list = await loadList(session.user.schoolId);
  // 같은 칸에 대한 기록이 이미 있으면 덮어씁니다 — 둘을 겹쳐 적용하면 시간표가 꼬입니다.
  const sameSlot = (a: ManualSlot, b: ManualSlot) => a.date === b.date && a.period === b.period;
  const kept = list.filter(
    (c) =>
      !(
        (c.absentTeacher === absentTeacher || c.partnerTeacher === absentTeacher) &&
        (sameSlot(c.absent, absent) || (c.exchange ? sameSlot(c.exchange, absent) : false))
      )
  );

  kept.push({
    id: randomUUID(),
    kind,
    absentTeacher,
    absent,
    partnerTeacher,
    exchange: exchange ?? undefined,
    createdAt: new Date().toISOString(),
  });

  return saveList(session.user.schoolId, kept);
}

/**
 * 기록의 날짜만 고칩니다(결강일·교체일). 시간표는 요일 단위라, 칸의 요일과 다른 날짜로
 * 옮기면 어느 주에도 반영되지 않는 기록이 되므로 같은 요일만 받습니다.
 */
export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const absentDate = typeof body?.absentDate === "string" ? body.absentDate : undefined;
  const exchangeDate = typeof body?.exchangeDate === "string" ? body.exchangeDate : undefined;
  if (!id || (!absentDate && !exchangeDate)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const list = await loadList(session.user.schoolId);
  const target = list.find((c) => c.id === id);
  if (!target) return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });

  const moved = (slot: ManualSlot, date: string | undefined): ManualSlot | string => {
    if (!date) return slot;
    if (!DATE_RE.test(date) || !parseDate(date)) return "날짜 형식이 올바르지 않습니다.";
    if (weekdayOf(date) !== slot.day.replace("요일", "").trim()) {
      return `${slot.day}요일 수업이라 ${slot.day}요일 날짜만 고를 수 있습니다.`;
    }
    return { ...slot, date };
  };
  const absent = moved(target.absent, absentDate);
  if (typeof absent === "string") return NextResponse.json({ error: absent }, { status: 400 });
  let exchange = target.exchange;
  if (exchangeDate) {
    if (!target.exchange) return NextResponse.json({ error: "보강 기록에는 교체일이 없습니다." }, { status: 400 });
    const next = moved(target.exchange, exchangeDate);
    if (typeof next === "string") return NextResponse.json({ error: next }, { status: 400 });
    exchange = next;
  }

  return saveList(
    session.user.schoolId,
    list.map((c) => (c.id === id ? { ...c, absent, exchange } : c)),
  );
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "삭제할 기록을 지정해 주세요." }, { status: 400 });

  const list = await loadList(session.user.schoolId);
  return saveList(session.user.schoolId, list.filter((c) => c.id !== id));
}
