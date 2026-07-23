import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLoginIdAccount, isValidLoginId, normalizeLoginId } from "@/features/schedule-helper/lib/loginId";
import { parseAccountsWorkbook } from "@/features/schedule-helper/lib/parseAccountsWorkbook";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 계정을 만들 수 있습니다." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const password = formData?.get("password");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일을 선택해 주세요." }, { status: 400 });
  }
  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "초기 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  let rows;
  try {
    const buffer = await file.arrayBuffer();
    rows = parseAccountsWorkbook(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "엑셀 파일을 읽는 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: "엑셀에서 읽을 수 있는 행이 없습니다." }, { status: 400 });
  }

  const schoolId = session.user.schoolId;
  const existingUsers = await prisma.user.findMany({
    where: { schoolId, loginId: { not: null } },
    select: { loginId: true },
  });
  const takenLoginIds = new Set(existingUsers.map((u) => u.loginId as string));

  const created: { name: string; loginId: string }[] = [];
  const skipped: { name: string; loginId: string; reason: string }[] = [];

  for (const row of rows) {
    const name = row.name.trim();
    const loginId = normalizeLoginId(row.loginId);

    if (!name || !loginId) {
      skipped.push({ name, loginId, reason: "이름 또는 아이디가 비어 있습니다." });
      continue;
    }
    if (!isValidLoginId(loginId)) {
      skipped.push({ name, loginId, reason: "아이디 형식이 올바르지 않습니다 (영문/숫자/._- , 2~30자)." });
      continue;
    }
    if (takenLoginIds.has(loginId)) {
      skipped.push({ name, loginId, reason: "이미 사용 중인 아이디입니다." });
      continue;
    }

    try {
      await createLoginIdAccount({ name, loginId, password, schoolId });
      takenLoginIds.add(loginId);
      created.push({ name, loginId });
    } catch {
      skipped.push({ name, loginId, reason: "계정 생성 중 오류가 발생했습니다." });
    }
  }

  return NextResponse.json({ created, skipped });
}
