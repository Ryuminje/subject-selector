import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 확인할 수 있습니다." }, { status: 403 });
  }

  const school = await prisma.school.findUnique({
    where: { id: session.user.schoolId },
    select: { geminiApiKey: true },
  });

  return NextResponse.json({ configured: !!school?.geminiApiKey });
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 설정할 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) {
    return NextResponse.json({ error: "API 키를 입력해 주세요." }, { status: 400 });
  }

  await prisma.school.update({
    where: { id: session.user.schoolId },
    data: { geminiApiKey: apiKey },
  });

  return NextResponse.json({ configured: true });
}
