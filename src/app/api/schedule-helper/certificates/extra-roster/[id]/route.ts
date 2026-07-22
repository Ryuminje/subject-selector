import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 삭제할 수 있습니다." }, { status: 403 });
  }

  const entry = await prisma.certificateRosterExtra.findUnique({ where: { id } });
  if (!entry || entry.schoolId !== session.user.schoolId) {
    return NextResponse.json({ error: "해당 명단을 찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.certificateRosterExtra.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
