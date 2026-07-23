import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveTeacherName } from "@/features/schedule-helper/lib/resolveTeacherName";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const certificate = await prisma.trainingCertificate.findUnique({ where: { id } });
  if (!certificate || certificate.schoolId !== session.user.schoolId) {
    return NextResponse.json({ error: "해당 이수증을 찾을 수 없습니다." }, { status: 404 });
  }

  if (session.user.role !== "ADMIN") {
    const teacherName = await resolveTeacherName(session.user);
    if (certificate.teacherName !== teacherName) {
      return NextResponse.json({ error: "본인의 이수증만 삭제할 수 있습니다." }, { status: 403 });
    }
  }

  // fileBytes가 이 행 자체에 저장되므로 행 삭제만으로 첨부파일도 함께 삭제됨
  await prisma.trainingCertificate.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
