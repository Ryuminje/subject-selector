// 협의회 교사 프리셋 — 수정(이름 변경 / 현재 선택으로 덮어쓰기) / 삭제.
//
// 두 라우트 모두 **본인 것만** 건드릴 수 있습니다. id로 찾은 뒤 userId가 세션과 다르면
// 존재 자체를 숨기려고 404를 돌려줍니다(남의 프리셋 id를 찍어보는 것을 막기 위함).

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeRosterNames } from "@/features/schedule-helper/lib/sanitizeRosterNames";

async function loadMine(request: Request, id: string) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };

  const preset = await prisma.meetingPreset.findUnique({ where: { id } });
  if (!preset || preset.userId !== session.user.id) {
    return { error: NextResponse.json({ error: "프리셋을 찾을 수 없습니다." }, { status: 404 }) };
  }
  return { session, preset };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const found = await loadMine(request, id);
  if (found.error) return found.error;
  const { session } = found;

  const body = await request.json().catch(() => null);

  const data: { name?: string; teachers?: string } = {};

  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "프리셋 이름을 입력해 주세요." }, { status: 400 });
    if (name.length > 30) {
      return NextResponse.json({ error: "프리셋 이름은 30자까지 가능합니다." }, { status: 400 });
    }
    const clash = await prisma.meetingPreset.findUnique({
      where: { userId_name: { userId: session.user.id, name } },
    });
    if (clash && clash.id !== id) {
      return NextResponse.json({ error: "이미 있는 프리셋 이름입니다." }, { status: 400 });
    }
    data.name = name;
  }

  if (body?.teachers !== undefined) {
    const teachers = sanitizeRosterNames(body.teachers);
    if (teachers.length < 2) {
      return NextResponse.json({ error: "교사를 2명 이상 선택해 주세요." }, { status: 400 });
    }
    data.teachers = JSON.stringify(teachers);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "바꿀 내용이 없습니다." }, { status: 400 });
  }

  const updated = await prisma.meetingPreset.update({
    where: { id },
    data,
    select: { id: true, name: true, teachers: true, updatedAt: true },
  });

  return NextResponse.json({
    preset: {
      id: updated.id,
      name: updated.name,
      teachers: JSON.parse(updated.teachers) as string[],
      updatedAt: updated.updatedAt,
    },
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const found = await loadMine(request, id);
  if (found.error) return found.error;

  await prisma.meetingPreset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
