import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCertificateRoster } from "@/features/schedule-helper/lib/getCertificateRoster";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
  }

  const names = await getCertificateRoster(session.user.schoolId);

  return NextResponse.json({ names });
}
