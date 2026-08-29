import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
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

  // 인쇄는 관리자 또는 이 세션을 만든 사람만 가능합니다. 세션 개설은 지금은 관리자만 할 수 있지만
  // (sessions/route.ts POST), 나중에 그 관리자의 권한이 바뀌어도 자기가 만든 등록부는 계속 인쇄할 수
  // 있어야 하므로 role이 아니라 createdByUserId로 판정합니다.
  const isAdmin = session.user.role === "ADMIN";
  const isCreator = session.user.id === signSession.createdByUserId;
  if (!isAdmin && !isCreator) {
    return NextResponse.json({ error: "관리자 또는 이 등록부를 만든 사람만 인쇄할 수 있습니다." }, { status: 403 });
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
