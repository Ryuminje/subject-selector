import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 교과군을 관리할 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "교과군 이름을 입력해 주세요." }, { status: 400 });
  }

  const school = await prisma.school.findUnique({
    where: { id: session.user.schoolId },
    select: { departmentGroups: true },
  });
  const groups = JSON.parse(school?.departmentGroups ?? "[]") as string[];
  if (groups.includes(name)) {
    return NextResponse.json({ error: "이미 있는 교과군입니다." }, { status: 400 });
  }

  const updatedGroups = [...groups, name];
  await prisma.school.update({
    where: { id: session.user.schoolId },
    data: { departmentGroups: JSON.stringify(updatedGroups) },
  });

  return NextResponse.json({ groups: updatedGroups });
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 교과군을 관리할 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "삭제할 교과군을 지정해 주세요." }, { status: 400 });
  }

  const schoolId = session.user.schoolId;
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { departmentGroups: true },
  });
  const groups = JSON.parse(school?.departmentGroups ?? "[]") as string[];
  const updatedGroups = groups.filter((g) => g !== name);

  await prisma.$transaction([
    prisma.teacher.updateMany({
      where: { schoolId, department: name },
      data: { department: null },
    }),
    prisma.school.update({
      where: { id: schoolId },
      data: { departmentGroups: JSON.stringify(updatedGroups) },
    }),
  ]);

  return NextResponse.json({ groups: updatedGroups });
}
