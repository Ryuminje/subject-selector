import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 오늘 결근/출장 등 임시 교체 불가 설정 — 학교 전체가 공유합니다 (이전엔 브라우저 localStorage 전용이었음).

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const teacherName = typeof body?.teacherName === "string" ? body.teacherName : "";
  const blocks = body?.blocks as Record<string, number[]> | undefined;

  if (!teacherName || !blocks || typeof blocks !== "object") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const teacher = await prisma.teacher.findUnique({
    where: { schoolId_name: { schoolId: session.user.schoolId, name: teacherName } },
  });
  if (!teacher) {
    return NextResponse.json({ error: "해당 교사를 찾을 수 없습니다." }, { status: 404 });
  }

  const current = JSON.parse(teacher.tempBlockDays) as Record<string, number[]>;
  for (const [day, periods] of Object.entries(blocks)) {
    const merged = new Set([...(current[day] ?? []), ...periods]);
    current[day] = Array.from(merged).sort((a, b) => a - b);
  }

  await prisma.teacher.update({
    where: { id: teacher.id },
    data: { tempBlockDays: JSON.stringify(current) },
  });

  return NextResponse.json({ tempBlockDays: current });
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const teacherName = typeof body?.teacherName === "string" ? body.teacherName : "";
  if (!teacherName) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const teacher = await prisma.teacher.findUnique({
    where: { schoolId_name: { schoolId: session.user.schoolId, name: teacherName } },
  });
  if (!teacher) {
    return NextResponse.json({ error: "해당 교사를 찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.teacher.update({
    where: { id: teacher.id },
    data: { tempBlockDays: "{}" },
  });

  return NextResponse.json({ success: true });
}
