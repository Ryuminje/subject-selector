import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const [teachers, school] = await Promise.all([
    prisma.teacher.findMany({
      where: { schoolId: session.user.schoolId },
      orderBy: { name: "asc" },
    }),
    prisma.school.findUnique({
      where: { id: session.user.schoolId },
      select: { departmentGroups: true },
    }),
  ]);

  return NextResponse.json({
    teachers: teachers.map((t) => ({
      id: t.id,
      name: t.name,
      department: t.department,
      fixedBlockDays: JSON.parse(t.fixedBlockDays) as Record<string, number[]>,
    })),
    departmentGroups: JSON.parse(school?.departmentGroups ?? "[]") as string[],
  });
}
