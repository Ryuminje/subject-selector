import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveTeacherName } from "@/features/schedule-helper/lib/resolveTeacherName";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const trainingTitle = typeof body?.trainingTitle === "string" ? body.trainingTitle.trim() : "";
  const number = typeof body?.number === "string" ? body.number.trim() : "";
  const institution = typeof body?.institution === "string" ? body.institution.trim() : "";
  const certDate = typeof body?.certDate === "string" ? body.certDate.trim() : "";
  const base64 = typeof body?.base64 === "string" ? body.base64 : "";
  const mimeType = typeof body?.mimeType === "string" ? body.mimeType : "";
  const fileName = typeof body?.fileName === "string" ? body.fileName : "certificate";

  if (!trainingTitle) {
    return NextResponse.json({ error: "연수 제목을 입력해 주세요." }, { status: 400 });
  }
  if (!base64 || !mimeType) {
    return NextResponse.json({ error: "파일 데이터를 받지 못했습니다." }, { status: 400 });
  }

  const registeredTitle = await prisma.trainingTitle.findUnique({
    where: { schoolId_title: { schoolId: session.user.schoolId, title: trainingTitle } },
  });
  if (!registeredTitle) {
    return NextResponse.json(
      { error: "등록되지 않은 연수입니다. 담당 선생님이 먼저 연수를 등록해야 합니다." },
      { status: 400 }
    );
  }

  const fileBytes = Buffer.from(base64, "base64");
  if (fileBytes.byteLength > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "파일 크기는 10MB 이하여야 합니다." }, { status: 413 });
  }

  const teacherName = await resolveTeacherName(session.user);

  const certificate = await prisma.trainingCertificate.create({
    data: {
      schoolId: session.user.schoolId,
      teacherName,
      trainingTitle,
      number,
      institution,
      certDate,
      fileName,
      mimeType,
      fileBytes,
    },
    select: { id: true },
  });

  return NextResponse.json({ success: true, id: certificate.id });
}
