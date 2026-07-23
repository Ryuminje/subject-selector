import { randomUUID } from "crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";

// 영문/숫자/`_`/`.`/`-`, 2~30자 — 이메일 로컬파트로도 안전하게 쓰이도록 ASCII로 제한
export const LOGIN_ID_REGEX = /^[a-zA-Z0-9_.-]{2,30}$/;

export function isValidLoginId(loginId: string): boolean {
  return LOGIN_ID_REGEX.test(loginId);
}

export function normalizeLoginId(loginId: string): string {
  return loginId.trim().toLowerCase();
}

// User.email(전역 unique)에 넣는 내부 합성 이메일. schoolId가 이미 전역 유일하므로
// (loginId, schoolId) 조합도 자동으로 전역 유일함 — 실제 메일함은 존재하지 않음.
export function synthesizeEmail(loginId: string, schoolId: string): string {
  return `${normalizeLoginId(loginId)}.${schoolId}@login.internal`;
}

// auth.api.signUpEmail은 better-auth의 nextCookies() 플러그인이 호출 즉시 새로 만든 계정으로
// 로그인 세션 쿠키를 덮어써버려서, "관리자가 남을 위해 계정을 만드는" 이 기능에는 쓸 수 없습니다
// (관리자 본인이 방금 만든 교사 계정으로 로그인 상태가 바뀌어버림). 그래서 User/Account를 직접
// Prisma로 만들고, 비밀번호 해시만 better-auth와 완전히 같은 포맷(better-auth/crypto의 hashPassword)으로
// 생성해 로그인 시 검증이 그대로 통과하도록 합니다.
export async function createLoginIdAccount(params: {
  name: string;
  loginId: string;
  password: string;
  schoolId: string;
}): Promise<void> {
  const { name, loginId, password, schoolId } = params;
  const email = synthesizeEmail(loginId, schoolId);
  const passwordHash = await hashPassword(password);
  const userId = randomUUID();

  await prisma.user.create({
    data: {
      id: userId,
      name,
      email,
      emailVerified: false,
      role: "TEACHER",
      schoolId,
      loginId,
    },
  });
  await prisma.account.create({
    data: {
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
    },
  });
}
