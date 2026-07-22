import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveTeacherName } from "@/features/schedule-helper/lib/resolveTeacherName";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const url = new URL(request.url);
  const trainingTitle = url.searchParams.get("trainingTitle")?.trim() || "";
  if (!trainingTitle) {
    return NextResponse.json({ error: "확인할 연수 제목을 입력해 주세요." }, { status: 400 });
  }

  // 제출 현황은 관리자이거나, 그 연수를 등록한 담당 선생님만 조회 가능
  if (session.user.role !== "ADMIN") {
    const registeredTitle = await prisma.trainingTitle.findUnique({
      where: { schoolId_title: { schoolId: session.user.schoolId, title: trainingTitle } },
    });
    const teacherName = await resolveTeacherName(session.user);
    if (!registeredTitle || registeredTitle.registeredByName !== teacherName) {
      return NextResponse.json({ error: "이 연수를 등록한 담당 선생님만 확인할 수 있습니다." }, { status: 403 });
    }
  }

  const [teachers, submissions] = await Promise.all([
    prisma.teacher.findMany({
      where: { schoolId: session.user.schoolId },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    prisma.trainingCertificate.findMany({
      where: { schoolId: session.user.schoolId, trainingTitle },
      select: { teacherName: true },
    }),
  ]);

  const submittedNames = new Set(submissions.map((s) => s.teacherName));
  const allNames = teachers.map((t) => t.name);
  const submitted = allNames.filter((n) => submittedNames.has(n));
  const unsubmitted = allNames.filter((n) => !submittedNames.has(n));

  return NextResponse.json({
    totalCount: allNames.length,
    submittedCount: submitted.length,
    submitted,
    unsubmitted,
  });
}
