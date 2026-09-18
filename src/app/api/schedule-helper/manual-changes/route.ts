import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cutoffDate, readManualChanges, type ManualChange, type ManualSlot } from "@/features/schedule-helper/lib/manualChanges";

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
