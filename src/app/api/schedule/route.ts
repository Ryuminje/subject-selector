import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ScheduleRow } from "@/features/schedule-helper/lib/sheetData";
import { cutoffDate, readManualChanges } from "@/features/schedule-helper/lib/manualChanges";

/**
 * 조회가 터졌을 때 화면에 그대로 띄울 한 줄. 그동안 이 라우트는 예외를 그냥 흘려보내
 * 500만 나갔고, 화면에는 "데이터를 가져오는데 실패했습니다."만 떠서 원인을 알 수 없었습니다.
 *
 * P2022는 "DB에 그 컬럼이 없다" — 코드는 새로 올라갔는데 마이그레이션이 아직 안 돈,
 * 배포 직후에 가장 흔한 경우라 따로 집어 안내합니다.
 */
function failureDetail(err: unknown): string {
  const code = (err as { code?: string } | null)?.code;
  if (code === "P2022" || code === "P2021") {
    return "서버 데이터베이스가 최신 상태가 아닙니다. 배포 후 prisma migrate deploy가 끝났는지 확인해 주세요.";
  }
  if (code === "P1001" || code === "P1002") return "데이터베이스에 연결하지 못했습니다.";
  return err instanceof Error ? err.message : "알 수 없는 오류";
}

export async function GET(request: Request) {
  try {
    return await loadSchedule(request);
  } catch (err) {
    console.error("[api/schedule] 시간표 조회 실패", err);
    return NextResponse.json(
      { error: `시간표 데이터를 읽지 못했습니다 — ${failureDetail(err)}` },
      { status: 500 }
    );
  }
}

async function loadSchedule(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const schoolId = session.user.schoolId;

  const [school, teacherRows] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId } }),
    prisma.teacher.findMany({ where: { schoolId } }),
  ]);

  if (!school) {
    return NextResponse.json({ error: "학교 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  const core = school.scheduleData
    ? (JSON.parse(school.scheduleData) as { teachers: string[]; days: string[]; periods: number[]; tableData: ScheduleRow[] })
    : { teachers: [], days: ["월", "화", "수", "목", "금"], periods: [], tableData: [] };

  const defaultBlockSettings: Record<string, Record<string, number[]>> = {};
  const tempBlockSettings: Record<string, Record<string, number[]>> = {};
  const teacherDepts: Record<string, string> = {};
  for (const t of teacherRows) {
    const fixed = JSON.parse(t.fixedBlockDays) as Record<string, number[]>;
    if (Object.keys(fixed).length > 0) defaultBlockSettings[t.name] = fixed;
    const temp = JSON.parse(t.tempBlockDays) as Record<string, number[]>;
    if (Object.keys(temp).length > 0) tempBlockSettings[t.name] = temp;
    if (t.department) teacherDepts[t.name] = t.department;
  }

  return NextResponse.json({
    ...core,
    // 보강원 문서 머리에 찍히는 학교 이름 — 허브의 config/hub.ts에도 학교명이 있지만
    // 그건 이 학교 전용 하드코딩이라 멀티테넌트에서 쓰면 안 됩니다.
    schoolName: school.name,
    defaultBlockSettings,
    tempBlockSettings,
    globalMeetingBlocks: JSON.parse(school.globalMeetingBlocks) as Record<string, number[]>,
    blockedSubjects: JSON.parse(school.blockedSubjects) as string[],
    blockedTeachers: JSON.parse(school.blockedTeachers) as string[],
    // 이 도구를 거치지 않고 이미 이뤄진 교체·보강 — 시간표에 덧입혀 쓰입니다.
    manualChanges: readManualChanges(school.manualChanges, cutoffDate(60)),
    teacherDepts,
    scheduleUploadedAt: school.scheduleUploadedAt,
    // 학교 초대 코드 — 가입 시에만 한 번 보여주고 재확인할 곳이 없었어서, 관리자에게만 다시 노출합니다.
    joinCode: session.user.role === "ADMIN" ? school.joinCode : null,
  });
}
