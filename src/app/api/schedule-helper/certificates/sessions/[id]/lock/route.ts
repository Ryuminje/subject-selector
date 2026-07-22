import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 변경할 수 있습니다." }, { status: 403 });
  }

  const signSession = await prisma.signSession.findUnique({ where: { id } });
  if (!signSession || signSession.schoolId !== session.user.schoolId) {
    return NextResponse.json({ error: "해당 세션을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const locked = typeof body?.locked === "boolean" ? body.locked : !signSession.locked;

  const updated = await prisma.signSession.update({
    where: { id },
    data: { locked },
    select: { locked: true },
  });

  return NextResponse.json(updated);
}
