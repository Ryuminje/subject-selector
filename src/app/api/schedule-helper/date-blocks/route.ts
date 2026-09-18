import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// "이 선생님은 이 날짜 이 교시에 교체할 수 없다"는 임시 기록 — 학교 전체가 공유합니다.
//
// 요일 단위인 /api/schedule/blocks(tempBlockDays)와 일부러 따로 둡니다. 여기 들어오는 건
// "이미 다른 분과 교체를 잡아둔 날"이라 그 날 하루만 막혀야 하고, 요일로 저장하면 다음 주
// 보강원까지 같이 막혀버립니다.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type DateBlocks = Record<string, number[]>;

/** 저장된 JSON을 읽으면서 지난 날짜는 버립니다 — 다시 쓰일 일이 없어 무한히 쌓이기만 합니다. */
function readBlocks(raw: string): DateBlocks {
  let parsed: DateBlocks;
  try {
    parsed = JSON.parse(raw) as DateBlocks;
  } catch {
    return {};
  }

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const out: DateBlocks = {};
  for (const [date, periods] of Object.entries(parsed)) {
    if (DATE_RE.test(date) && date >= todayIso && Array.isArray(periods) && periods.length > 0) {
      out[date] = periods;
    }
  }
  return out;
}

type Parsed =
  | { ok: false; response: NextResponse }
  | { ok: true; schoolId: string; teacherName: string; date: string; period?: number };

async function readRequest(request: Request): Promise<Parsed> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  }

  const body = await request.json().catch(() => null);
  const teacherName = typeof body?.teacherName === "string" ? body.teacherName.trim() : "";
  const date = typeof body?.date === "string" ? body.date.trim() : "";
  const period = typeof body?.period === "number" ? body.period : undefined;

  if (!teacherName || !DATE_RE.test(date)) {
    return { ok: false, response: NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 }) };
  }

  return { ok: true, schoolId: session.user.schoolId, teacherName, date, period };
}

export async function POST(request: Request) {
  const parsed = await readRequest(request);
  if (!parsed.ok) return parsed.response;
  const { schoolId, teacherName, date, period } = parsed;

  if (typeof period !== "number") {
    return NextResponse.json({ error: "교시를 지정해 주세요." }, { status: 400 });
  }

  // 시간표에만 있고 Teacher 행이 없는 선생님도 막을 수 있어야 해서 upsert입니다.
  const teacher = await prisma.teacher.upsert({
    where: { schoolId_name: { schoolId, name: teacherName } },
    create: { schoolId, name: teacherName },
    update: {},
  });

  const blocks = readBlocks(teacher.dateBlocks);
  blocks[date] = Array.from(new Set([...(blocks[date] ?? []), period])).sort((a, b) => a - b);

  await prisma.teacher.update({
    where: { id: teacher.id },
    data: { dateBlocks: JSON.stringify(blocks) },
  });

  return NextResponse.json({ dateBlocks: blocks });
}

export async function DELETE(request: Request) {
  const parsed = await readRequest(request);
  if (!parsed.ok) return parsed.response;
  const { schoolId, teacherName, date, period } = parsed;

  const teacher = await prisma.teacher.findUnique({
    where: { schoolId_name: { schoolId, name: teacherName } },
  });
  if (!teacher) return NextResponse.json({ dateBlocks: {} });

  const blocks = readBlocks(teacher.dateBlocks);
  // period를 안 주면 그 날짜 전체를 해제합니다.
  const left = typeof period === "number" ? (blocks[date] ?? []).filter((p) => p !== period) : [];
  if (left.length > 0) blocks[date] = left;
  else delete blocks[date];

  await prisma.teacher.update({
    where: { id: teacher.id },
    data: { dateBlocks: JSON.stringify(blocks) },
  });

  return NextResponse.json({ dateBlocks: blocks });
}
