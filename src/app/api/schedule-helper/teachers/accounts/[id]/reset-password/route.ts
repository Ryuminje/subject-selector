import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "better-auth/crypto";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 비밀번호를 재설정할 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: "새 비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({ where: { id } });
  if (!targetUser || targetUser.schoolId !== session.user.schoolId || !targetUser.loginId) {
    return NextResponse.json({ error: "해당 아이디 계정을 찾을 수 없습니다." }, { status: 404 });
  }

  const credentialAccount = await prisma.account.findFirst({
    where: { userId: targetUser.id, providerId: "credential" },
  });
  if (!credentialAccount) {
    return NextResponse.json({ error: "해당 계정에 비밀번호 인증 수단이 없습니다." }, { status: 400 });
  }

  const hashed = await hashPassword(newPassword);
  await prisma.account.update({
    where: { id: credentialAccount.id },
    data: { password: hashed },
  });

  return NextResponse.json({ success: true });
}
