import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeRosterNames } from "@/features/schedule-helper/lib/sanitizeRosterNames";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 수정할 수 있습니다." }, { status: 403 });
  }

  const preset = await prisma.certificateRosterPreset.findUnique({ where: { id } });
  if (!preset || preset.schoolId !== session.user.schoolId) {
    return NextResponse.json({ error: "해당 명단을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const data: { name?: string; names?: string } = {};

  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "명단 이름을 입력해 주세요." }, { status: 400 });
    }
    if (name !== preset.name) {
      const existing = await prisma.certificateRosterPreset.findUnique({
        where: { schoolId_name: { schoolId: session.user.schoolId, name } },
      });
      if (existing) {
        return NextResponse.json({ error: "이미 있는 명단 이름입니다." }, { status: 400 });
      }
    }
    data.name = name;
  }

  if (body?.names !== undefined) {
    const names = sanitizeRosterNames(body.names);
    if (names.length === 0) {
      return NextResponse.json({ error: "최소 한 명 이상 포함해야 합니다." }, { status: 400 });
    }
    data.names = JSON.stringify(names);
  }

  const updated = await prisma.certificateRosterPreset.update({
    where: { id },
    data,
    select: { id: true, name: true, names: true, updatedAt: true },
  });

  return NextResponse.json({
    preset: { id: updated.id, name: updated.name, names: JSON.parse(updated.names) as string[], updatedAt: updated.updatedAt },
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 삭제할 수 있습니다." }, { status: 403 });
  }

  const preset = await prisma.certificateRosterPreset.findUnique({ where: { id } });
  if (!preset || preset.schoolId !== session.user.schoolId) {
    return NextResponse.json({ error: "해당 명단을 찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.certificateRosterPreset.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
