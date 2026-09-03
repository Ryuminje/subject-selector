// 교체·보강 작업 세트 — 수정(이름 변경 / 지금 트레이 내용으로 덮어쓰기) / 삭제.
//
// 두 라우트 모두 **본인 것만** 건드릴 수 있습니다. id로 찾은 뒤 userId가 세션과 다르면
// 존재 자체를 숨기려고 404를 돌려줍니다(남의 배치 id를 찍어보는 것을 막기 위함) —
// meeting-presets/[id]/route.ts와 완전히 같은 규칙입니다.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_ENTRIES = 300;

async function loadMine(request: Request, id: string) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };

  const batch = await prisma.makeupBatch.findUnique({ where: { id } });
  if (!batch || batch.userId !== session.user.id) {
    return { error: NextResponse.json({ error: "작업 세트를 찾을 수 없습니다." }, { status: 404 }) };
  }
  return { session, batch };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const found = await loadMine(request, id);
  if (found.error) return found.error;
  const { session } = found;

  const body = await request.json().catch(() => null);

  const data: { name?: string; entries?: string; baseDate?: string } = {};

  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "작업 세트 이름을 입력해 주세요." }, { status: 400 });
    if (name.length > 40) {
      return NextResponse.json({ error: "작업 세트 이름은 40자까지 가능합니다." }, { status: 400 });
    }
    const clash = await prisma.makeupBatch.findUnique({
      where: { userId_name: { userId: session.user.id, name } },
    });
    if (clash && clash.id !== id) {
      return NextResponse.json({ error: "이미 있는 이름입니다." }, { status: 400 });
    }
    data.name = name;
  }

  if (body?.entries !== undefined) {
    if (!Array.isArray(body.entries)) {
      return NextResponse.json({ error: "담긴 내역이 올바르지 않습니다." }, { status: 400 });
    }
    if (body.entries.length > MAX_ENTRIES) {
      return NextResponse.json({ error: `한 작업 세트에는 ${MAX_ENTRIES}건까지 담을 수 있습니다.` }, { status: 400 });
    }
    data.entries = JSON.stringify(body.entries);
  }

  if (typeof body?.baseDate === "string") {
    data.baseDate = body.baseDate;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "바꿀 내용이 없습니다." }, { status: 400 });
  }

  const updated = await prisma.makeupBatch.update({
    where: { id },
    data,
    select: { id: true, name: true, entries: true, baseDate: true, updatedAt: true },
  });

  return NextResponse.json({
    batch: {
      id: updated.id,
      name: updated.name,
      entries: JSON.parse(updated.entries),
      baseDate: updated.baseDate,
      updatedAt: updated.updatedAt,
    },
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const found = await loadMine(request, id);
  if (found.error) return found.error;

  await prisma.makeupBatch.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
