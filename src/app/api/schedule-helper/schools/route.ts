import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateJoinCode } from "@/features/schedule-helper/lib/joinCode";
import { APIError } from "better-auth/api";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const schoolName = typeof body?.schoolName === "string" ? body.schoolName.trim() : "";
  const adminName = typeof body?.adminName === "string" ? body.adminName.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!schoolName || !adminName || !email || !password) {
    return NextResponse.json({ error: "모든 항목을 입력해 주세요." }, { status: 400 });
  }

  let joinCode = generateJoinCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.school.findUnique({ where: { joinCode } });
    if (!existing) break;
    joinCode = generateJoinCode();
  }

  const school = await prisma.school.create({
    data: { name: schoolName, joinCode },
  });

  try {
    await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: adminName,
        role: "ADMIN",
        schoolId: school.id,
      },
    });
  } catch (error) {
    await prisma.school.delete({ where: { id: school.id } });
    const message = error instanceof APIError ? error.body?.message ?? error.message : "계정을 만드는 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ schoolId: school.id, schoolName: school.name, joinCode: school.joinCode });
}
