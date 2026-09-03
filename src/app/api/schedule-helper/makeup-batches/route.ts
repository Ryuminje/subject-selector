// 수업교체 도우미 트레이의 서버판 — 이름 붙여 저장한 교체·보강 작업 세트 목록 조회 / 만들기.
//
// **계정별 기능입니다.** 협의회 프리셋(meeting-presets)과 같은 이유로, 여러 사람이 나눠 쓰는
// 게 아니라 한 사람이 혼자 여러 선생님 몫을 처리하는 용도라 조회·수정·삭제 모두 세션의
// userId로만 걸러집니다. 남의 배치는 어떤 경로로도 보이지 않습니다.
//
// 목록 조회 시 entries까지 통째로 돌려줍니다(교체·보강 상세는 목록 자체가 곧 "불러오기"
// 대상이라, meeting-presets의 teachers처럼 별도 GET /[id] 없이 이 응답을 그대로 씁니다).

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { MakeupEntry } from "@/features/schedule-helper/lib/makeup/types";

/** 최대 개수 — 배치는 프리셋보다 무겁게(선생님 여러 명 분량) 쌓일 수 있어 조금 적게 둡니다. */
const MAX_BATCHES = 30;
/** 배치 하나에 담기는 항목 수 상한 — 학교 하나가 한 번에 처리할 결강 건수를 넉넉히 잡되 무한정은 아니게. */
const MAX_ENTRIES = 300;

function parseEntries(raw: string): MakeupEntry[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MakeupEntry[]) : [];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const batches = await prisma.makeupBatch.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, entries: true, baseDate: true, updatedAt: true },
  });

  return NextResponse.json({
    batches: batches.map((b) => ({
      id: b.id,
      name: b.name,
      entries: parseEntries(b.entries),
      baseDate: b.baseDate,
      updatedAt: b.updatedAt,
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
  const entries = Array.isArray(body?.entries) ? (body.entries as unknown[]) : null;
  const baseDate = typeof body?.baseDate === "string" ? body.baseDate : "";

  if (!name) {
    return NextResponse.json({ error: "작업 세트 이름을 입력해 주세요." }, { status: 400 });
  }
  if (name.length > 40) {
    return NextResponse.json({ error: "작업 세트 이름은 40자까지 가능합니다." }, { status: 400 });
  }
  if (!entries) {
    return NextResponse.json({ error: "담긴 내역이 올바르지 않습니다." }, { status: 400 });
  }
  if (entries.length > MAX_ENTRIES) {
    return NextResponse.json({ error: `한 작업 세트에는 ${MAX_ENTRIES}건까지 담을 수 있습니다.` }, { status: 400 });
  }

  const existing = await prisma.makeupBatch.findUnique({
    where: { userId_name: { userId: session.user.id, name } },
  });
  if (existing) {
    return NextResponse.json({ error: "이미 있는 이름입니다." }, { status: 400 });
  }

  const count = await prisma.makeupBatch.count({ where: { userId: session.user.id } });
  if (count >= MAX_BATCHES) {
    return NextResponse.json(
      { error: `작업 세트는 ${MAX_BATCHES}개까지 만들 수 있습니다. 쓰지 않는 것을 지워 주세요.` },
      { status: 400 },
    );
  }

  const created = await prisma.makeupBatch.create({
    data: {
      userId: session.user.id,
      schoolId: session.user.schoolId,
      name,
      entries: JSON.stringify(entries),
      baseDate,
    },
    select: { id: true, name: true, baseDate: true, updatedAt: true },
  });

  return NextResponse.json({
    batch: {
      id: created.id,
      name: created.name,
      entries: entries as MakeupEntry[],
      baseDate: created.baseDate,
      updatedAt: created.updatedAt,
    },
  });
}
