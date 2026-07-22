import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveTeacherName } from "@/features/schedule-helper/lib/resolveTeacherName";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const url = new URL(request.url);
  const teacherNameQuery = url.searchParams.get("teacherName")?.trim() || "";
  const titleQuery = url.searchParams.get("titleQuery")?.trim() || "";

  const where: {
    schoolId: string;
    teacherName?: string;
    trainingTitle?: { contains: string; mode: "insensitive" };
  } = { schoolId: session.user.schoolId };

  if (isAdmin) {
    if (teacherNameQuery) where.teacherName = teacherNameQuery;
    if (titleQuery) where.trainingTitle = { contains: titleQuery, mode: "insensitive" };
  } else {
    // 일반 교사는 쿼리 파라미터와 무관하게 본인 이름으로 강제
    where.teacherName = await resolveTeacherName(session.user);
  }

  const rows = await prisma.trainingCertificate.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      teacherName: true,
      trainingTitle: true,
      number: true,
      institution: true,
      certDate: true,
      fileName: true,
      mimeType: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ certificates: rows });
}
