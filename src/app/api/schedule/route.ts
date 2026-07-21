import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ScheduleRow } from "@/features/schedule-helper/lib/sheetData";

export async function GET(request: Request) {
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
    defaultBlockSettings,
    tempBlockSettings,
    globalMeetingBlocks: JSON.parse(school.globalMeetingBlocks) as Record<string, number[]>,
    blockedSubjects: JSON.parse(school.blockedSubjects) as string[],
    blockedTeachers: JSON.parse(school.blockedTeachers) as string[],
    teacherDepts,
    scheduleUploadedAt: school.scheduleUploadedAt,
    // 학교 초대 코드 — 가입 시에만 한 번 보여주고 재확인할 곳이 없었어서, 관리자에게만 다시 노출합니다.
    joinCode: session.user.role === "ADMIN" ? school.joinCode : null,
  });
}
