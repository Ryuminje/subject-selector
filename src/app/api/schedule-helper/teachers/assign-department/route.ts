import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 배정할 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const department = typeof body?.department === "string" ? body.department.trim() : "";
  const teacherIds = Array.isArray(body?.teacherIds)
    ? body.teacherIds.filter((id: unknown): id is string => typeof id === "string")
    : [];

  if (!department) {
    return NextResponse.json({ error: "교과군을 지정해 주세요." }, { status: 400 });
  }

  const schoolId = session.user.schoolId;
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { departmentGroups: true },
  });
  const groups = JSON.parse(school?.departmentGroups ?? "[]") as string[];
  if (!groups.includes(department)) {
    return NextResponse.json({ error: "존재하지 않는 교과군입니다." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.teacher.updateMany({
      where: { schoolId, department },
      data: { department: null },
    }),
    prisma.teacher.updateMany({
      where: { schoolId, id: { in: teacherIds } },
      data: { department },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
