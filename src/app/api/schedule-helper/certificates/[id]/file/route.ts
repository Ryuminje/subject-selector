import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveTeacherName } from "@/features/schedule-helper/lib/resolveTeacherName";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const certificate = await prisma.trainingCertificate.findUnique({ where: { id } });
  if (!certificate || certificate.schoolId !== session.user.schoolId) {
    return NextResponse.json({ error: "해당 이수증을 찾을 수 없습니다." }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin) {
    const teacherName = await resolveTeacherName(session.user);
    if (certificate.teacherName !== teacherName) {
      return NextResponse.json({ error: "본인의 이수증만 볼 수 있습니다." }, { status: 403 });
    }
  }

  return new NextResponse(new Uint8Array(certificate.fileBytes), {
    headers: {
      "Content-Type": certificate.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(certificate.fileName)}"`,
      // 학교 공용 PC에서 계정을 바꿔가며 쓰는 경우를 대비해 브라우저가 매번 재검증하도록 강제
      // (max-age를 길게 주면 로그아웃 후 다른 교사가 같은 URL에 접근할 때 캐시된 파일이 그대로 노출될 수 있음)
      "Cache-Control": "private, no-cache",
    },
  });
}
