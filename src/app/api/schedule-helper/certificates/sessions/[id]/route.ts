import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 공개 라우트 — 세션 id(cuid, 추측 불가) 자체가 유일한 접근 통제입니다.
// QR/URL을 가진 사람은 누구든 조회할 수 있어야 익명 서명 페이지가 동작합니다.
// 로그인 요구로 바꾸지 마세요 (원본 앱도 동일하게 로그인 없이 서명하는 방식이었고, 사용자가 이 방식 유지를 확정했습니다).
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const session = await prisma.signSession.findUnique({
    where: { id },
    include: {
      signatures: { select: { teacherName: true } },
      school: { select: { name: true } },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "유효하지 않은 세션입니다." }, { status: 404 });
  }

  const trainingTitles = JSON.parse(session.trainingTitles) as string[];
  const roster = JSON.parse(session.rosterSnapshot) as string[];
  const signedNames = new Set(session.signatures.map((s) => s.teacherName));

  return NextResponse.json({
    schoolName: session.school.name,
    trainingTitles,
    isGroup: trainingTitles.length > 1,
    locked: session.locked,
    teachers: roster.map((name) => ({ name, signed: signedNames.has(name) })),
    totalCount: roster.length,
    signedCount: signedNames.size,
  });
}
