import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 학교에 가입된 전체 인원(이메일 셀프가입 + 관리자 발급 아이디 계정 모두) 목록 — admin-only.
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
  }

  const members = await prisma.user.findMany({
    where: { schoolId: session.user.schoolId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, loginId: true, role: true, createdAt: true },
  });

  return NextResponse.json({ members });
}
