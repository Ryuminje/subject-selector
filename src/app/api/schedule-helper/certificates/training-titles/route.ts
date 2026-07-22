import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveTeacherName } from "@/features/schedule-helper/lib/resolveTeacherName";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const titles = await prisma.trainingTitle.findMany({
    where: { schoolId: session.user.schoolId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, registeredByName: true },
  });

  return NextResponse.json({ titles });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "연수 제목을 입력해 주세요." }, { status: 400 });
  }

  const existing = await prisma.trainingTitle.findUnique({
    where: { schoolId_title: { schoolId: session.user.schoolId, title } },
  });
  if (existing) {
    return NextResponse.json({ error: "이미 등록된 연수입니다." }, { status: 400 });
  }

  const registeredByName = await resolveTeacherName(session.user);

  const created = await prisma.trainingTitle.create({
    data: { schoolId: session.user.schoolId, title, registeredByName },
    select: { id: true, title: true, registeredByName: true },
  });

  return NextResponse.json({ trainingTitle: created });
}
