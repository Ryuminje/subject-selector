import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseScheduleWorkbook } from "@/features/schedule-helper/lib/sheetData";

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

  await prisma.$transaction([
    prisma.school.update({
      where: { id: schoolId },
      data: {
        scheduleData: JSON.stringify({
          teachers: parsed.teachers,
          days: parsed.days,
          periods: parsed.periods,
          tableData: parsed.tableData,
        }),
        scheduleUploadedAt: new Date(),
      },
    }),
    ...parsed.teachers.map((name) =>
      prisma.teacher.upsert({
        where: { schoolId_name: { schoolId, name } },
        create: { schoolId, name },
        update: {},
      })
    ),
  ]);

  return NextResponse.json({
    teacherCount: parsed.teachers.length,
    uploadedAt: new Date().toISOString(),
  });
}
