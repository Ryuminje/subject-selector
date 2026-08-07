import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadBotAccess } from "@/features/schedule-helper/lib/assistant/access";
import { isAccent } from "@/features/schedule-helper/lib/assistant/config";

// 챗봇 하나의 상세(자료함 포함) 조회 / 수정 / 삭제.

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const access = await loadBotAccess(id, session.user);
  if (!access || !access.canUse) {
    return NextResponse.json({ error: "챗봇을 찾을 수 없습니다." }, { status: 404 });
  }

  const documents = await prisma.assistantDocument.findMany({
    where: { botId: id },
    orderBy: { createdAt: "asc" },
    // fileBytes는 절대 select하지 않습니다 — 목록 한 번에 수십 MB가 딸려옵니다.
    select: {
      id: true,
      fileName: true,
      byteSize: true,
      status: true,
      error: true,
      pageCount: true,
      chunkCount: true,
      embeddedCount: true,
      createdAt: true,
    },
  });

  const { bot, canManage } = access;
  return NextResponse.json({
    bot: {
      ...bot,
      starters: JSON.parse(bot.starters) as string[],
    },
    canManage,
    documents,
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const access = await loadBotAccess(id, session.user);
  if (!access) {
    return NextResponse.json({ error: "챗봇을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!access.canManage) {
    return NextResponse.json({ error: "만든 사람만 수정할 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const data: Record<string, string | null> = {};

  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "챗봇 이름은 비워둘 수 없습니다." }, { status: 400 });
    if (name.length > 40) return NextResponse.json({ error: "챗봇 이름은 40자 이하로 지어 주세요." }, { status: 400 });
    data.name = name;
  }
  if (typeof body?.tagline === "string") data.tagline = body.tagline.trim() || null;
  if (typeof body?.emoji === "string" && body.emoji.trim()) data.emoji = body.emoji.trim();
  if (isAccent(body?.accent)) data.accent = body.accent;
  if (typeof body?.persona === "string") data.persona = body.persona.trim() || null;

  if (Array.isArray(body?.starters)) {
    const starters = body.starters
      .filter((s: unknown): s is string => typeof s === "string")
      .map((s: string) => s.trim())
      .filter(Boolean)
      .slice(0, 6);
    data.starters = JSON.stringify(starters);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "바꿀 내용이 없습니다." }, { status: 400 });
  }

  await prisma.assistantBot.update({ where: { id }, data });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const access = await loadBotAccess(id, session.user);
  if (!access) {
    return NextResponse.json({ error: "챗봇을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!access.canManage) {
    return NextResponse.json({ error: "만든 사람만 삭제할 수 있습니다." }, { status: 403 });
  }

  // 자료·조각·대화는 스키마의 onDelete: Cascade가 함께 지웁니다.
  await prisma.assistantBot.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
