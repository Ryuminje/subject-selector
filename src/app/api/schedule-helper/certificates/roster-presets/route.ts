import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveTeacherName } from "@/features/schedule-helper/lib/resolveTeacherName";
import { sanitizeRosterNames } from "@/features/schedule-helper/lib/sanitizeRosterNames";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const presets = await prisma.certificateRosterPreset.findMany({
    where: { schoolId: session.user.schoolId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, names: true, createdBy: true, updatedAt: true },
  });

  return NextResponse.json({
    presets: presets.map((p) => ({
      id: p.id,
      name: p.name,
      names: JSON.parse(p.names) as string[],
      createdBy: p.createdBy,
      updatedAt: p.updatedAt,
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
    preset: { id: created.id, name: created.name, names, createdBy: created.createdBy, updatedAt: created.updatedAt },
  });
}
