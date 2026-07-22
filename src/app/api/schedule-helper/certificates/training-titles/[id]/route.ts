import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveTeacherName } from "@/features/schedule-helper/lib/resolveTeacherName";

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
