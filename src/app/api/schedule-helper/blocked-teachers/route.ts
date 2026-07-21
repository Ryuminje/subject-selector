import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 관리할 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const teacher = typeof body?.teacher === "string" ? body.teacher.trim() : "";
  if (!teacher) {
    return NextResponse.json({ error: "교사명을 입력해 주세요." }, { status: 400 });
  }

  const school = await prisma.school.findUnique({
    where: { id: session.user.schoolId },
    select: { blockedTeachers: true },
  });
  const teachers = JSON.parse(school?.blockedTeachers ?? "[]") as string[];
  if (teachers.includes(teacher)) {
    return NextResponse.json({ error: "이미 있는 교사입니다." }, { status: 400 });
  }

  const updatedTeachers = [...teachers, teacher];
  await prisma.school.update({
    where: { id: session.user.schoolId },
    data: { blockedTeachers: JSON.stringify(updatedTeachers) },
  });

  return NextResponse.json({ teachers: updatedTeachers });
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 관리할 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const teacher = typeof body?.teacher === "string" ? body.teacher.trim() : "";
  if (!teacher) {
    return NextResponse.json({ error: "삭제할 교사를 지정해 주세요." }, { status: 400 });
  }

  const school = await prisma.school.findUnique({
    where: { id: session.user.schoolId },
    select: { blockedTeachers: true },
  });
  const teachers = JSON.parse(school?.blockedTeachers ?? "[]") as string[];
  const updatedTeachers = teachers.filter((t) => t !== teacher);

  await prisma.school.update({
    where: { id: session.user.schoolId },
    data: { blockedTeachers: JSON.stringify(updatedTeachers) },
  });

  return NextResponse.json({ teachers: updatedTeachers });
}
