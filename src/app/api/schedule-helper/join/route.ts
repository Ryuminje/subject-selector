import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { APIError } from "better-auth/api";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const joinCode = typeof body?.joinCode === "string" ? body.joinCode.trim().toUpperCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!joinCode || !name || !email || !password) {
    return NextResponse.json({ error: "모든 항목을 입력해 주세요." }, { status: 400 });
  }

  const school = await prisma.school.findUnique({ where: { joinCode } });
  if (!school) {
    return NextResponse.json({ error: "학교 코드가 올바르지 않습니다." }, { status: 400 });
  }

  try {
    await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
        role: "TEACHER",
        schoolId: school.id,
      },
    });
  } catch (error) {
    const message = error instanceof APIError ? error.body?.message ?? error.message : "계정을 만드는 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ schoolName: school.name });
}
