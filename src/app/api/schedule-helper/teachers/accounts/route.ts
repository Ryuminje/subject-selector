import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLoginIdAccount, isValidLoginId, normalizeLoginId } from "@/features/schedule-helper/lib/loginId";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { schoolId: session.user.schoolId, loginId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, loginId: true, createdAt: true },
  });

  return NextResponse.json({ accounts: users });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 계정을 만들 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const loginId = typeof body?.loginId === "string" ? normalizeLoginId(body.loginId) : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!name) {
    return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
  }
  if (!isValidLoginId(loginId)) {
    return NextResponse.json(
      { error: "아이디는 영문/숫자/._- 만 사용해 2~30자로 입력해 주세요." },
      { status: 400 }
    );
  }
  if (!password) {
    return NextResponse.json({ error: "초기 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  const schoolId = session.user.schoolId;
  const existing = await prisma.user.findUnique({
    where: { schoolId_loginId: { schoolId, loginId } },
  });
  if (existing) {
    return NextResponse.json({ error: "이미 사용 중인 아이디입니다." }, { status: 400 });
  }

  try {
    await createLoginIdAccount({ name, loginId, password, schoolId });
  } catch {
    return NextResponse.json({ error: "계정을 만드는 중 오류가 발생했습니다." }, { status: 500 });
  }

  return NextResponse.json({ success: true, loginId });
}
