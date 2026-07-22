import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveTeacherName } from "@/features/schedule-helper/lib/resolveTeacherName";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
  }

  const entries = await prisma.certificateRosterExtra.findMany({
    where: { schoolId: session.user.schoolId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, addedBy: true, createdAt: true },
  });

  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 추가할 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
  }

  const [existingTeacher, existingExtra] = await Promise.all([
    prisma.teacher.findUnique({ where: { schoolId_name: { schoolId: session.user.schoolId, name } } }),
    prisma.certificateRosterExtra.findUnique({ where: { schoolId_name: { schoolId: session.user.schoolId, name } } }),
  ]);
  if (existingTeacher || existingExtra) {
    return NextResponse.json({ error: "이미 명단에 있는 이름입니다." }, { status: 400 });
  }

  const addedBy = await resolveTeacherName(session.user);

  const created = await prisma.certificateRosterExtra.create({
    data: { schoolId: session.user.schoolId, name, addedBy },
    select: { id: true, name: true, addedBy: true, createdAt: true },
  });

  return NextResponse.json({ entry: created });
}
