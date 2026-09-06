import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
  },
  // 로그인 화면의 "이 기기 자동 로그인" 체크박스(rememberMe)가 켜졌을 때 유지되는 기간.
  // rememberMe:false면 이 값과 무관하게 브라우저 세션 쿠키(창 닫으면 로그아웃)로 발급됨.
  session: {
    expiresIn: 60 * 60 * 24 * 180, // 180일
    updateAge: 60 * 60 * 24 * 14, // 14일마다 접속 시 자동 연장
  },
  user: {
    additionalFields: {
      // "ADMIN" | "TEACHER" — plain string since better-auth's additionalFields don't support Prisma enums.
      role: {
        type: "string",
        required: true,
      },
      schoolId: {
        type: "string",
        required: true,
      },
      // 시간표 속 이름과 연결된 Teacher.id (선택 — 관리자가 나중에 매칭해줄 수도 있음)
      teacherId: {
        type: "string",
        required: false,
      },
      // 이메일이 아닌 아이디 로그인용 (관리자 발급 계정 전용), 학교 안에서만 유일 — email엔 내부 합성값이 들어감
      loginId: {
        type: "string",
        required: false,
      },
    },
  },
  plugins: [nextCookies()],
});
