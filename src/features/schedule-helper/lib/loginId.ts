import { randomUUID } from "crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";

// 영문/숫자/`_`/`.`/`-`/한글 음절, 2~30자.
// 이메일 로컬파트에 그대로 쓰이지 않도록(아래 synthesizeEmail 참고) 문자 제한을 둘 필요가 없어졌습니다.
export const LOGIN_ID_REGEX = /^[a-zA-Z0-9_.\-가-힣]{2,30}$/;

export function isValidLoginId(loginId: string): boolean {
  return LOGIN_ID_REGEX.test(loginId);
}

export function normalizeLoginId(loginId: string): string {
  return loginId.trim().toLowerCase();
}

// User.email(전역 unique, better-auth의 z.email() 검증 대상)에 넣는 내부 합성 이메일.
// 한글 등 비ASCII 아이디를 허용하면서도 이메일 검증을 통과시키기 위해, 아이디 문자를 그대로 쓰지 않고
// 항상 ASCII인 userId(cuid/uuid)만으로 이메일을 만듭니다 — userId 자체가 이미 전역 유일이라 별도로
// schoolId를 더할 필요도 없습니다. 로그인 시에는 (schoolId, loginId)로 먼저 User 행을 조회해 저장된
// 이 이메일을 그대로 쓰므로, 아이디 문자열로부터 이메일을 다시 계산할 일이 없습니다.
export function synthesizeEmail(userId: string): string {
  return `${userId}@login.internal`;
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
  const userId = randomUUID();
  const email = synthesizeEmail(userId);
  const passwordHash = await hashPassword(password);

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
