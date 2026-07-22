import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeCertificateImage } from "@/features/schedule-helper/lib/gemini";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const base64 = typeof body?.base64 === "string" ? body.base64 : "";
  const mimeType = typeof body?.mimeType === "string" ? body.mimeType : "";
  if (!base64 || !mimeType) {
    return NextResponse.json({ error: "파일 데이터를 받지 못했습니다." }, { status: 400 });
  }

  const bytes = Buffer.from(base64, "base64");
  if (bytes.byteLength > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "파일 크기는 10MB 이하여야 합니다." }, { status: 413 });
  }

  const school = await prisma.school.findUnique({
    where: { id: session.user.schoolId },
    select: { geminiApiKey: true },
  });

  if (!school?.geminiApiKey) {
    return NextResponse.json({
      number: null,
      institution: null,
      date: null,
      extractionFailed: true,
      reason: "no_api_key",
    });
  }

  const result = await analyzeCertificateImage(school.geminiApiKey, bytes, mimeType);
  const extractionFailed = !result.number && !result.institution && !result.date;

  return NextResponse.json({ ...result, extractionFailed });
}
