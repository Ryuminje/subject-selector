import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveTeacherName } from "@/features/schedule-helper/lib/resolveTeacherName";
import { sanitizeRosterNames } from "@/features/schedule-helper/lib/sanitizeRosterNames";
import { getAdminNames } from "@/features/schedule-helper/lib/getAdminNames";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const preset = await prisma.certificateRosterPreset.findUnique({ where: { id } });
  if (!preset || preset.schoolId !== session.user.schoolId) {
    return NextResponse.json({ error: "해당 명단을 찾을 수 없습니다." }, { status: 404 });
  }

  if (session.user.role !== "ADMIN") {
    const teacherName = await resolveTeacherName(session.user);
    if (preset.createdBy !== teacherName) {
      return NextResponse.json({ error: "본인이 만든 명단만 수정할 수 있습니다." }, { status: 403 });
    }
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
    select: { id: true, name: true, names: true, createdBy: true, updatedAt: true },
  });

  // 편집한 사람이 아니라 "원래 만든 사람"(createdBy, 이 update로도 안 바뀜) 기준입니다 —
  // 관리자가 남의 개인 명단을 고쳐도 그걸로 공통이 되진 않습니다.
  const adminNames = await getAdminNames(session.user.schoolId);

  return NextResponse.json({
    preset: {
      id: updated.id,
      name: updated.name,
      names: JSON.parse(updated.names) as string[],
      createdBy: updated.createdBy,
      updatedAt: updated.updatedAt,
      isShared: adminNames.has(updated.createdBy),
    },
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const preset = await prisma.certificateRosterPreset.findUnique({ where: { id } });
  if (!preset || preset.schoolId !== session.user.schoolId) {
    return NextResponse.json({ error: "해당 명단을 찾을 수 없습니다." }, { status: 404 });
  }

  if (session.user.role !== "ADMIN") {
    const teacherName = await resolveTeacherName(session.user);
    if (preset.createdBy !== teacherName) {
      return NextResponse.json({ error: "본인이 만든 명단만 삭제할 수 있습니다." }, { status: 403 });
    }
  }

  await prisma.certificateRosterPreset.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
