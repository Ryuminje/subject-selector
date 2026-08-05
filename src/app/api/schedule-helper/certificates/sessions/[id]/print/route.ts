import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 볼 수 있습니다." }, { status: 403 });
  }

  // 서명 이미지는 별도 요청(/signatures/[id]/image)으로 불러오지 않고 여기서 data URI로 함께 내려보냅니다.
  // 그 라우트는 Cache-Control: private, no-cache라서 브라우저가 인쇄용으로 문서를 다시 렌더링할 때
  // 이미지를 재검증(재요청)해야 하는데, 그게 인쇄 시점에 이뤄지지 못하면 서명 칸이 빈 채로 출력됐습니다.
  // 요청 자체를 없애면 인쇄 시 다시 가져올 것이 없어 이 문제가 원천적으로 사라집니다.
  const signSession = await prisma.signSession.findUnique({
    where: { id },
    include: {
      signatures: { select: { id: true, teacherName: true, signaturePng: true } },
      school: { select: { name: true } },
    },
  });

  if (!signSession || signSession.schoolId !== session.user.schoolId) {
    return NextResponse.json({ error: "해당 세션을 찾을 수 없습니다." }, { status: 404 });
  }

  const url = new URL(request.url);
  const titles = JSON.parse(signSession.trainingTitles) as string[];
  const titleIndex = Math.min(Math.max(Number(url.searchParams.get("title") ?? 0), 0), titles.length - 1);
  const roster = JSON.parse(signSession.rosterSnapshot) as string[];
  const titleRosters = signSession.titleRosters
    ? (JSON.parse(signSession.titleRosters) as Record<string, string[]>)
    : null;
  const rosterForTitle = titleRosters?.[titles[titleIndex]] ?? roster;
  const signatureByName = new Map(
    signSession.signatures.map((s) => [
      s.teacherName,
      `data:image/png;base64,${Buffer.from(s.signaturePng).toString("base64")}`,
    ])
  );

  return NextResponse.json({
    schoolName: signSession.school.name,
    trainingTitle: titles[titleIndex],
    createdAt: signSession.createdAt,
    teachers: rosterForTitle.map((name) => ({ name, signature: signatureByName.get(name) ?? null })),
  });
}
