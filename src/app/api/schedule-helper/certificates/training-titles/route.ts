import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveTeacherName } from "@/features/schedule-helper/lib/resolveTeacherName";
import { sanitizeRosterNames } from "@/features/schedule-helper/lib/sanitizeRosterNames";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const titles = await prisma.trainingTitle.findMany({
    where: { schoolId: session.user.schoolId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, registeredByName: true, rosterSnapshot: true },
  });

  return NextResponse.json({
    titles: titles.map((t) => ({
      id: t.id,
      title: t.title,
      registeredByName: t.registeredByName,
      rosterSnapshot: t.rosterSnapshot ? (JSON.parse(t.rosterSnapshot) as string[]) : null,
    })),
  });
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

  let rosterSnapshot: string | null = null;
  if (body?.names !== undefined) {
    const names = sanitizeRosterNames(body.names);
    if (names.length === 0) {
      return NextResponse.json({ error: "최소 한 명 이상 포함해야 합니다." }, { status: 400 });
    }
    rosterSnapshot = JSON.stringify(names);
  }

  const existing = await prisma.trainingTitle.findUnique({
    where: { schoolId_title: { schoolId: session.user.schoolId, title } },
  });
  if (existing) {
    return NextResponse.json({ error: "이미 등록된 연수입니다." }, { status: 400 });
  }

  const registeredByName = await resolveTeacherName(session.user);

  const created = await prisma.trainingTitle.create({
    data: { schoolId: session.user.schoolId, title, registeredByName, rosterSnapshot },
    select: { id: true, title: true, registeredByName: true, rosterSnapshot: true },
  });

  return NextResponse.json({
    trainingTitle: {
      id: created.id,
      title: created.title,
      registeredByName: created.registeredByName,
      rosterSnapshot: created.rosterSnapshot ? (JSON.parse(created.rosterSnapshot) as string[]) : null,
    },
  });
}
