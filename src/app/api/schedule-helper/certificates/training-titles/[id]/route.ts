import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveTeacherName } from "@/features/schedule-helper/lib/resolveTeacherName";
import { sanitizeRosterNames } from "@/features/schedule-helper/lib/sanitizeRosterNames";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const trainingTitle = await prisma.trainingTitle.findUnique({ where: { id } });
  if (!trainingTitle || trainingTitle.schoolId !== session.user.schoolId) {
    return NextResponse.json({ error: "해당 연수를 찾을 수 없습니다." }, { status: 404 });
  }

  if (session.user.role !== "ADMIN") {
    const teacherName = await resolveTeacherName(session.user);
    if (trainingTitle.registeredByName !== teacherName) {
      return NextResponse.json({ error: "본인이 등록한 연수만 수정할 수 있습니다." }, { status: 403 });
    }
  }

  const body = await request.json().catch(() => null);
  const data: { title?: string; rosterSnapshot?: string | null; category?: string } = {};

  if (typeof body?.title === "string") {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: "연수 제목을 입력해 주세요." }, { status: 400 });
    }
    if (title !== trainingTitle.title) {
      const existing = await prisma.trainingTitle.findUnique({
        where: { schoolId_title: { schoolId: session.user.schoolId, title } },
      });
      if (existing) {
        return NextResponse.json({ error: "이미 등록된 연수입니다." }, { status: 400 });
      }
    }
    data.title = title;
  }

  if (body?.names !== undefined) {
    const names = sanitizeRosterNames(body.names);
    // 빈 배열을 명시적으로 보내면 전용 명단을 해제하고 전체 기본 명단으로 되돌림
    data.rosterSnapshot = names.length > 0 ? JSON.stringify(names) : null;
  }

  if (typeof body?.category === "string") {
    data.category = body.category === "sign" ? "sign" : "certificate";
  }

  const updated = await prisma.trainingTitle.update({
    where: { id },
    data,
    select: { id: true, title: true, registeredByName: true, rosterSnapshot: true, category: true },
  });

  return NextResponse.json({
    trainingTitle: {
      id: updated.id,
      title: updated.title,
      registeredByName: updated.registeredByName,
      rosterSnapshot: updated.rosterSnapshot ? (JSON.parse(updated.rosterSnapshot) as string[]) : null,
      category: updated.category,
    },
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const trainingTitle = await prisma.trainingTitle.findUnique({ where: { id } });
  if (!trainingTitle || trainingTitle.schoolId !== session.user.schoolId) {
    return NextResponse.json({ error: "해당 연수를 찾을 수 없습니다." }, { status: 404 });
  }

  if (session.user.role !== "ADMIN") {
    const teacherName = await resolveTeacherName(session.user);
    if (trainingTitle.registeredByName !== teacherName) {
      return NextResponse.json({ error: "본인이 등록한 연수만 삭제할 수 있습니다." }, { status: 403 });
    }
  }

  await prisma.trainingTitle.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
