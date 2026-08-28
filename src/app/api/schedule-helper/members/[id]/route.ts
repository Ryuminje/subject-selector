import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 학교 가입 인원 제거(계정 삭제) — admin-only. 본인 계정과 학교의 마지막 관리자 계정은 삭제할 수 없습니다.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
  }

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.schoolId !== session.user.schoolId) {
    return NextResponse.json({ error: "대상을 찾을 수 없습니다." }, { status: 404 });
  }
  if (target.id === session.user.id) {
    return NextResponse.json({ error: "본인 계정은 이 화면에서 삭제할 수 없습니다." }, { status: 400 });
  }
  if (target.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { schoolId: session.user.schoolId, role: "ADMIN" } });
    if (adminCount <= 1) {
      return NextResponse.json({ error: "학교의 마지막 관리자는 삭제할 수 없습니다." }, { status: 400 });
    }
  }

  // 협의회 프리셋은 User에 @relation을 걸지 않아(better-auth CLI가 User 블록을 다시 쓰기 때문)
  // cascade가 걸리지 않습니다. 계정을 지울 때 여기서 직접 지워야 고아 행이 남지 않습니다.
  await prisma.meetingPreset.deleteMany({ where: { userId: id } });

  // Session/Account는 스키마에서 User onDelete: Cascade로 연결되어 있어 함께 삭제됩니다.
  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
