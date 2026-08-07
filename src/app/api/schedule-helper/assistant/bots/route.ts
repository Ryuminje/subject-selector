import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAccent, MAX_BOTS_PER_USER } from "@/features/schedule-helper/lib/assistant/config";

// 챗봇 목록/생성.
// 목록은 "내가 만든 것"과 "학교에 공개된 것"을 함께 돌려주되, 편집 권한(canManage)을
// 항목마다 표시해 화면이 버튼 노출을 판단할 수 있게 합니다.

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const bots = await prisma.assistantBot.findMany({
    where: {
      schoolId: session.user.schoolId,
      OR: [{ ownerUserId: session.user.id }, { visibility: "school" }],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      tagline: true,
      emoji: true,
      accent: true,
      visibility: true,
      ownerUserId: true,
      ownerName: true,
      updatedAt: true,
      documents: { select: { status: true } },
    },
  });

  const items = bots.map((bot) => {
    const { documents, ownerUserId, ...rest } = bot;
    return {
      ...rest,
      mine: ownerUserId === session.user.id,
      canManage: isAdmin || ownerUserId === session.user.id,
      docCount: documents.length,
      // 화면에서 "분석 중 N개" 배지를 띄우기 위한 요약
      readyCount: documents.filter((d) => d.status === "ready").length,
      workingCount: documents.filter((d) => d.status === "pending" || d.status === "processing").length,
      failedCount: documents.filter((d) => d.status === "failed").length,
    };
  });

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const tagline = typeof body?.tagline === "string" ? body.tagline.trim() : "";
  const emoji = typeof body?.emoji === "string" && body.emoji.trim() ? body.emoji.trim() : "🤖";
  const accent = isAccent(body?.accent) ? body.accent : "amber";

  if (!name) {
    return NextResponse.json({ error: "챗봇 이름을 입력해 주세요." }, { status: 400 });
  }
  if (name.length > 40) {
    return NextResponse.json({ error: "챗봇 이름은 40자 이하로 지어 주세요." }, { status: 400 });
  }

  const mine = await prisma.assistantBot.count({
    where: { schoolId: session.user.schoolId, ownerUserId: session.user.id },
  });
  if (mine >= MAX_BOTS_PER_USER) {
    return NextResponse.json(
      { error: `챗봇은 한 계정당 ${MAX_BOTS_PER_USER}개까지 만들 수 있습니다.` },
      { status: 400 }
    );
  }

  const bot = await prisma.assistantBot.create({
    data: {
      schoolId: session.user.schoolId,
      ownerUserId: session.user.id,
      ownerName: session.user.name,
      name,
      tagline: tagline || null,
      emoji,
      accent,
      // 1단계에서는 공개 기능을 열지 않습니다 — 값은 스키마에 미리 있고 서버가 고정합니다.
      visibility: "private",
    },
    select: { id: true },
  });

  return NextResponse.json({ id: bot.id });
}
