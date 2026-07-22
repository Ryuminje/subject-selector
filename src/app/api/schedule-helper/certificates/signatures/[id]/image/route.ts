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

  const signature = await prisma.signSessionSignature.findUnique({
    where: { id },
    include: { session: { select: { schoolId: true } } },
  });

  if (!signature || signature.session.schoolId !== session.user.schoolId) {
    return NextResponse.json({ error: "해당 서명을 찾을 수 없습니다." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(signature.signaturePng), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-cache",
    },
  });
}
