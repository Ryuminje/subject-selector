import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024; // 2MB

// 공개 라우트 — QR로 접속한 교사가 로그인 없이 서명을 제출합니다 (sessions/[id]/route.ts와 동일한 트레이드오프).
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const signSession = await prisma.signSession.findUnique({ where: { id } });
  if (!signSession) {
    return NextResponse.json({ error: "유효하지 않은 세션입니다." }, { status: 404 });
  }
  if (signSession.locked) {
    return NextResponse.json({ error: "서명이 마감되었습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const teacherName = typeof body?.teacherName === "string" ? body.teacherName.trim() : "";
  const base64 = typeof body?.signaturePng === "string" ? body.signaturePng : "";

  if (!teacherName || !base64) {
    return NextResponse.json({ error: "이름 또는 서명 데이터가 없습니다." }, { status: 400 });
  }

  const roster = JSON.parse(signSession.rosterSnapshot) as string[];
  if (!roster.includes(teacherName)) {
    return NextResponse.json({ error: "교사 명단에 없는 이름입니다." }, { status: 400 });
  }

  const signaturePng = Buffer.from(base64, "base64");
  if (signaturePng.byteLength > MAX_SIGNATURE_BYTES) {
    return NextResponse.json({ error: "서명 데이터가 너무 큽니다." }, { status: 413 });
  }

  try {
    await prisma.signSessionSignature.create({
      data: { sessionId: id, teacherName, signaturePng },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "이미 서명하셨습니다." }, { status: 409 });
    }
    console.error("[certificates/sign] unexpected error:", error);
    return NextResponse.json({ error: "서명 저장 중 오류가 발생했습니다." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
