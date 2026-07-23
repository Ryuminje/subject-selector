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
    OR?: Array<{ teacherName?: string; trainingTitle?: { in: string[] } }>;
  } = { schoolId: session.user.schoolId };

  if (isAdmin) {
    if (teacherNameQuery) where.teacherName = teacherNameQuery;
    if (titleQuery) where.trainingTitle = { contains: titleQuery, mode: "insensitive" };
  } else {
    // 일반 교사는 본인 제출 내역 + 본인이 등록한 연수에 제출된 내역을 함께 봄 (쿼리 파라미터 무시)
    const teacherName = await resolveTeacherName(session.user);
    const registeredTitles = await prisma.trainingTitle.findMany({
      where: { schoolId: session.user.schoolId, registeredByName: teacherName },
      select: { title: true },
    });
    const titleList = registeredTitles.map((t) => t.title);
    if (titleList.length > 0) {
      where.OR = [{ teacherName }, { trainingTitle: { in: titleList } }];
    } else {
      where.teacherName = teacherName;
    }
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
