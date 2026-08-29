// 협의회 시간 찾기의 교사 프리셋 — 목록 조회 / 만들기.
//
// **계정별 기능입니다.** 연수 명단 프리셋(certificates/roster-presets)은 관리자가 만든 것만 학교
// 전체에 공개되고 일반 계정이 만든 것은 본인에게만 보이는 것과 달리, 여기는 관리자 여부와
// 무관하게 조회·수정·삭제 모두 세션의 userId로만 걸러집니다. 남의 프리셋은 어떤 경로로도 보이지 않습니다.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
// 이름 목록 정리 규칙(공백 제거·중복 제거·순서 보존)이 연수 명단과 똑같아 그대로 씁니다.
import { sanitizeRosterNames } from "@/features/schedule-helper/lib/sanitizeRosterNames";

/** 최대 개수 — 이름은 짧고 목록은 눈으로 훑는 용도라 넉넉히 두되 무한정 쌓이지는 않게 합니다. */
const MAX_PRESETS = 50;

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const presets = await prisma.meetingPreset.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, teachers: true, updatedAt: true },
  });

  return NextResponse.json({
    presets: presets.map((p) => ({
      id: p.id,
      name: p.name,
      teachers: JSON.parse(p.teachers) as string[],
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
  const teachers = sanitizeRosterNames(body?.teachers);

  if (!name) {
    return NextResponse.json({ error: "프리셋 이름을 입력해 주세요." }, { status: 400 });
  }
  if (name.length > 30) {
    return NextResponse.json({ error: "프리셋 이름은 30자까지 가능합니다." }, { status: 400 });
  }
  // 협의회는 두 명 이상이어야 의미가 있습니다(찾기 화면도 2명부터 계산합니다).
  if (teachers.length < 2) {
    return NextResponse.json({ error: "교사를 2명 이상 선택해 주세요." }, { status: 400 });
  }

  const existing = await prisma.meetingPreset.findUnique({
    where: { userId_name: { userId: session.user.id, name } },
  });
  if (existing) {
    return NextResponse.json({ error: "이미 있는 프리셋 이름입니다." }, { status: 400 });
  }

  const count = await prisma.meetingPreset.count({ where: { userId: session.user.id } });
  if (count >= MAX_PRESETS) {
    return NextResponse.json(
      { error: `프리셋은 ${MAX_PRESETS}개까지 만들 수 있습니다. 쓰지 않는 것을 지워 주세요.` },
      { status: 400 },
    );
  }

  const created = await prisma.meetingPreset.create({
    data: {
      userId: session.user.id,
      schoolId: session.user.schoolId,
      name,
      teachers: JSON.stringify(teachers),
    },
    select: { id: true, name: true, updatedAt: true },
  });

  return NextResponse.json({
    preset: { id: created.id, name: created.name, teachers, updatedAt: created.updatedAt },
  });
}
