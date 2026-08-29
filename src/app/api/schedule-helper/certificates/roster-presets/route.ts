import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveTeacherName } from "@/features/schedule-helper/lib/resolveTeacherName";
import { sanitizeRosterNames } from "@/features/schedule-helper/lib/sanitizeRosterNames";
import { getAdminNames } from "@/features/schedule-helper/lib/getAdminNames";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const myName = await resolveTeacherName(session.user);

  // createdBy는 이름 문자열이라(User에 관계를 걸지 않는 이 저장소의 원칙 — sessions/route.ts 등
  // 참고) "그 이름이 지금도 관리자인지"로 공개 여부를 판정합니다. 관리자가 만든 명단은 학교
  // 전체에 공개하고, 그 외(일반 교사가 만든 개인 명단)는 만든 본인에게만 보입니다. 나중에 그
  // 사람이 관리자에서 빠지면 그때부터 그 사람의 명단도 본인만 보이게 됩니다 — 이 앱의 다른
  // 관리자 판정(세션 열기·인쇄 등)과 같은, 스냅샷이 아닌 실시간 판정입니다.
  const adminNames = await getAdminNames(session.user.schoolId);

  const presets = await prisma.certificateRosterPreset.findMany({
    where: { schoolId: session.user.schoolId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, names: true, createdBy: true, updatedAt: true },
  });

  const visible = presets.filter((p) => adminNames.has(p.createdBy) || p.createdBy === myName);

  return NextResponse.json({
    presets: visible.map((p) => ({
      id: p.id,
      name: p.name,
      names: JSON.parse(p.names) as string[],
      createdBy: p.createdBy,
      updatedAt: p.updatedAt,
      // 화면에서 "공통(관리자가 만듦)" / "개인" 두 그리드로 나눠 보여주는 데 씁니다.
      isShared: adminNames.has(p.createdBy),
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const names = sanitizeRosterNames(body?.names);

  if (!name) {
    return NextResponse.json({ error: "명단 이름을 입력해 주세요." }, { status: 400 });
  }
  if (names.length === 0) {
    return NextResponse.json({ error: "최소 한 명 이상 포함해야 합니다." }, { status: 400 });
  }

  const existing = await prisma.certificateRosterPreset.findUnique({
    where: { schoolId_name: { schoolId: session.user.schoolId, name } },
  });
  if (existing) {
    return NextResponse.json({ error: "이미 있는 명단 이름입니다." }, { status: 400 });
  }

  const createdBy = await resolveTeacherName(session.user);

  const created = await prisma.certificateRosterPreset.create({
    data: { schoolId: session.user.schoolId, name, names: JSON.stringify(names), createdBy },
    select: { id: true, name: true, names: true, createdBy: true, updatedAt: true },
  });

  return NextResponse.json({
    preset: {
      id: created.id,
      name: created.name,
      names,
      createdBy: created.createdBy,
      updatedAt: created.updatedAt,
      // 방금 만든 사람이 지금 관리자면 바로 "공통"입니다 — 조회 때처럼 이름 대조가 필요 없습니다.
      isShared: session.user.role === "ADMIN",
    },
  });
}
