import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadBotAccess } from "@/features/schedule-helper/lib/assistant/access";

// 자료 1개 삭제. 조각(AssistantChunk)은 onDelete: Cascade로 함께 사라지므로
// 삭제 직후부터 그 자료는 검색에 걸리지 않습니다.

export async function DELETE(request: Request, context: { params: Promise<{ docId: string }> }) {
  const { docId } = await context.params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const document = await prisma.assistantDocument.findUnique({
    where: { id: docId },
    select: { botId: true },
  });
  if (!document) {
    return NextResponse.json({ error: "자료를 찾을 수 없습니다." }, { status: 404 });
  }

  const access = await loadBotAccess(document.botId, session.user);
  if (!access) {
    return NextResponse.json({ error: "자료를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!access.canManage) {
    return NextResponse.json({ error: "만든 사람만 자료를 삭제할 수 있습니다." }, { status: 403 });
  }

  await prisma.assistantDocument.delete({ where: { id: docId } });
  return NextResponse.json({ success: true });
}
