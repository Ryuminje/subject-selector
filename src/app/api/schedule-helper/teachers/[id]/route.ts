import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 수정할 수 있습니다." }, { status: 403 });
  }

  const teacher = await prisma.teacher.findUnique({ where: { id } });
  if (!teacher || teacher.schoolId !== session.user.schoolId) {
    return NextResponse.json({ error: "해당 교사를 찾을 수 없습니다." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const data: { department?: string | null; fixedBlockDays?: string } = {};

  if (body && "department" in body) {
    const dept = typeof body.department === "string" ? body.department.trim() : "";
    data.department = dept || null;
  }
  if (body && "fixedBlockDays" in body && body.fixedBlockDays && typeof body.fixedBlockDays === "object") {
    data.fixedBlockDays = JSON.stringify(body.fixedBlockDays);
  }

  const updated = await prisma.teacher.update({ where: { id }, data });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    department: updated.department,
    fixedBlockDays: JSON.parse(updated.fixedBlockDays) as Record<string, number[]>,
  });
}
