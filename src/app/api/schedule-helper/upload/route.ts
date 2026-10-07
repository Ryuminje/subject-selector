import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseScheduleWorkbook } from "@/features/schedule-helper/lib/sheetData";
import { applyRenameMap } from "@/features/schedule-helper/lib/renameTeacher";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 시간표를 업로드할 수 있습니다." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일을 선택해 주세요." }, { status: 400 });
  }

  let parsed;
  try {
    const buffer = await file.arrayBuffer();
    parsed = parseScheduleWorkbook(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "엑셀 파일을 읽는 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const schoolId = session.user.schoolId;

  // 화면에서 바꿔 둔 교사 이름(휴직 대체 등)을 새 파일에도 적용합니다. 안 그러면 시간표를 다시
  // 올릴 때마다 휴직자 이름으로 되돌아와, 그때마다 이름을 다시 바꿔야 합니다.
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { teacherRenames: true } });
  const renamed = applyRenameMap(parsed, school?.teacherRenames ?? "{}");

  await prisma.$transaction(
    [
      prisma.school.update({
        where: { id: schoolId },
        data: {
          scheduleData: JSON.stringify({
            teachers: renamed.teachers,
            days: parsed.days,
            periods: parsed.periods,
            tableData: renamed.tableData,
          }),
          scheduleUploadedAt: new Date(),
        },
      }),
      prisma.teacher.createMany({
        data: renamed.teachers.map((name) => ({ schoolId, name })),
        skipDuplicates: true,
      }),
    ],
    // DB가 NAS에 있어 왕복 지연이 커서(교사 수만큼 개별 upsert하던 방식은 5초 기본 타임아웃을 넘겼음),
    // 배치 처리로 왕복 횟수를 줄이고 타임아웃도 여유 있게 설정합니다.
    { timeout: 15000 }
  );

  return NextResponse.json({
    teacherCount: renamed.teachers.length,
    uploadedAt: new Date().toISOString(),
    // 이름을 자동으로 바꿔 올린 교사 수 / 새 파일에 이미 그 이름이 있어 건너뛴 원래 이름들
    renamedCount: renamed.applied,
    renameSkipped: renamed.skipped,
  });
}
