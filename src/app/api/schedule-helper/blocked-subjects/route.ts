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
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  if (!subject) {
    return NextResponse.json({ error: "과목명을 입력해 주세요." }, { status: 400 });
  }

  const school = await prisma.school.findUnique({
    where: { id: session.user.schoolId },
    select: { blockedSubjects: true },
  });
  const subjects = JSON.parse(school?.blockedSubjects ?? "[]") as string[];
  if (subjects.includes(subject)) {
    return NextResponse.json({ error: "이미 있는 과목입니다." }, { status: 400 });
  }

  const updatedSubjects = [...subjects, subject];
  await prisma.school.update({
    where: { id: session.user.schoolId },
    data: { blockedSubjects: JSON.stringify(updatedSubjects) },
  });

  return NextResponse.json({ subjects: updatedSubjects });
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
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  if (!subject) {
    return NextResponse.json({ error: "삭제할 과목을 지정해 주세요." }, { status: 400 });
  }

  const school = await prisma.school.findUnique({
    where: { id: session.user.schoolId },
    select: { blockedSubjects: true },
  });
  const subjects = JSON.parse(school?.blockedSubjects ?? "[]") as string[];
  const updatedSubjects = subjects.filter((s) => s !== subject);

  await prisma.school.update({
    where: { id: session.user.schoolId },
    data: { blockedSubjects: JSON.stringify(updatedSubjects) },
  });

  return NextResponse.json({ subjects: updatedSubjects });
}
