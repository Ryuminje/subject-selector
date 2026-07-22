import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCertificateRoster } from "@/features/schedule-helper/lib/getCertificateRoster";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 세션을 만들 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const rawTitles = Array.isArray(body?.trainingTitles) ? body.trainingTitles : [];
  const titles = Array.from(
    new Set(rawTitles.map((t: unknown) => (typeof t === "string" ? t.trim() : "")).filter(Boolean))
  );

  if (titles.length === 0) {
    return NextResponse.json({ error: "연수 제목을 입력해 주세요." }, { status: 400 });
  }

  const roster = await getCertificateRoster(session.user.schoolId);

  const created = await prisma.signSession.create({
    data: {
      schoolId: session.user.schoolId,
      trainingTitles: JSON.stringify(titles),
      rosterSnapshot: JSON.stringify(roster),
      createdByUserId: session.user.id,
    },
    select: { id: true },
  });

  return NextResponse.json({ sessionId: created.id });
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 확인할 수 있습니다." }, { status: 403 });
  }

  const sessions = await prisma.signSession.findMany({
    where: { schoolId: session.user.schoolId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { signatures: true } } },
    take: 15,
  });

  return NextResponse.json({
    sessions: sessions.map((s) => {
      const titles = JSON.parse(s.trainingTitles) as string[];
      const roster = JSON.parse(s.rosterSnapshot) as string[];
      return {
        id: s.id,
        trainingTitles: titles,
        isGroup: titles.length > 1,
        locked: s.locked,
        createdAt: s.createdAt,
        totalCount: roster.length,
        signedCount: s._count.signatures,
      };
    }),
  });
}
