import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeLoginId } from "@/features/schedule-helper/lib/loginId";
import { APIError } from "better-auth/api";

// 아이디(이메일 아님) 로그인 — 학교 코드 + 아이디로 사용자를 찾아 내부 합성 이메일로
// auth.api.signInEmail을 그대로 호출한다 (비밀번호 해시 비교/세션 발급/쿠키 설정을 better-auth에 위임).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const schoolJoinCode = typeof body?.schoolJoinCode === "string" ? body.schoolJoinCode.trim().toUpperCase() : "";
  const loginId = typeof body?.loginId === "string" ? normalizeLoginId(body.loginId) : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!schoolJoinCode || !loginId || !password) {
    return NextResponse.json({ error: "학교 코드, 아이디, 비밀번호를 모두 입력해 주세요." }, { status: 400 });
  }

  const school = await prisma.school.findUnique({ where: { joinCode: schoolJoinCode } });
  if (!school) {
    return NextResponse.json({ error: "학교 코드가 올바르지 않습니다." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { schoolId_loginId: { schoolId: school.id, loginId } },
  });
  if (!user) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  try {
    const result = await auth.api.signInEmail({ body: { email: user.email, password } });
    return NextResponse.json({ user: { id: result.user.id, name: result.user.name } });
  } catch (error) {
    if (error instanceof APIError) {
      return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }
    return NextResponse.json({ error: "로그인 중 오류가 발생했습니다." }, { status: 500 });
  }
}
