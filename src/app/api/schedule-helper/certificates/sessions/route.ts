import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCertificateRoster } from "@/features/schedule-helper/lib/getCertificateRoster";
import { sanitizeRosterNames } from "@/features/schedule-helper/lib/sanitizeRosterNames";

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

  const explicitRoster = sanitizeRosterNames(body?.roster);
  const rosterPresetName = explicitRoster.length > 0 && typeof body?.rosterPresetName === "string" ? body.rosterPresetName : null;

  let roster: string[];
  let titleRosters: Record<string, string[]> | null = null;

  if (explicitRoster.length > 0) {
    // "전체 명단(기본)" 또는 저장된 프리셋을 명시적으로 선택 — 오늘과 동일하게 모든 연수 제목에 동일한 명단 적용
    roster = explicitRoster;
  } else {
    // 기본 경로 — 선택한 각 연수 제목에 등록된 전용 명단을 그대로 사용(없으면 전체 기본 명단으로 폴백), 연수별로 서명이 분리됨
    const titleList = titles as string[];
    const registeredTitles = await prisma.trainingTitle.findMany({
      where: { schoolId: session.user.schoolId, title: { in: titleList } },
      select: { title: true, rosterSnapshot: true },
    });
    const rosterByTitle = new Map(registeredTitles.map((t) => [t.title, t.rosterSnapshot]));
    const defaultRoster = await getCertificateRoster(session.user.schoolId);

    const map: Record<string, string[]> = {};
    for (const title of titleList) {
      const snapshot = rosterByTitle.get(title);
      map[title] = snapshot ? sanitizeRosterNames(JSON.parse(snapshot)) : defaultRoster;
    }
    titleRosters = map;
    roster = sanitizeRosterNames(Object.values(map).flat());
  }

  const created = await prisma.signSession.create({
    data: {
      schoolId: session.user.schoolId,
      trainingTitles: JSON.stringify(titles),
      rosterSnapshot: JSON.stringify(roster),
      titleRosters: titleRosters ? JSON.stringify(titleRosters) : null,
      rosterPresetName,
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
        rosterPresetName: s.rosterPresetName,
      };
    }),
  });
}
