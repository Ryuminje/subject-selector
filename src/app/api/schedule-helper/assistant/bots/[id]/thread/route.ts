import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadBotAccess } from "@/features/schedule-helper/lib/assistant/access";

// 이 챗봇에서 "내가 마지막으로 하던 대화"를 돌려줍니다. 메신저처럼 다시 들어오면
// 이어서 보이게 하려는 것으로, 대화는 공개 챗봇이라도 사람마다 따로입니다.
//
// DELETE는 그 대화를 지웁니다(새 대화 시작).

const MAX_MESSAGES = 50;

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

  const thread = await prisma.assistantThread.findFirst({
    where: { botId: id, userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!thread) return NextResponse.json({ threadId: null, messages: [] });

  const rows = await prisma.assistantMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: "asc" },
    take: MAX_MESSAGES,
    select: { id: true, role: true, content: true, citations: true, createdAt: true },
  });

  return NextResponse.json({
    threadId: thread.id,
    messages: rows.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
      sources: JSON.parse(m.citations) as { documentId: string; fileName: string; page: number | null }[],
    })),
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const access = await loadBotAccess(id, session.user);
  if (!access || !access.canUse) {
    return NextResponse.json({ error: "챗봇을 찾을 수 없습니다." }, { status: 404 });
  }

  // 내 대화만 지웁니다 — 메시지는 onDelete: Cascade로 함께 사라집니다.
  await prisma.assistantThread.deleteMany({ where: { botId: id, userId: session.user.id } });
  return NextResponse.json({ success: true });
}
