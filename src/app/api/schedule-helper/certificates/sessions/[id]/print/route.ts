import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 볼 수 있습니다." }, { status: 403 });
  }

  const signSession = await prisma.signSession.findUnique({
    where: { id },
    include: {
      signatures: { select: { id: true, teacherName: true } },
      school: { select: { name: true } },
    },
  });

  if (!signSession || signSession.schoolId !== session.user.schoolId) {
    return NextResponse.json({ error: "해당 세션을 찾을 수 없습니다." }, { status: 404 });
  }

  const url = new URL(request.url);
  const titles = JSON.parse(signSession.trainingTitles) as string[];
  const titleIndex = Math.min(Math.max(Number(url.searchParams.get("title") ?? 0), 0), titles.length - 1);
  const roster = JSON.parse(signSession.rosterSnapshot) as string[];
  const signatureByName = new Map(signSession.signatures.map((s) => [s.teacherName, s.id]));

  return NextResponse.json({
    schoolName: signSession.school.name,
    trainingTitle: titles[titleIndex],
    createdAt: signSession.createdAt,
    teachers: roster.map((name) => ({ name, signatureId: signatureByName.get(name) ?? null })),
  });
}
