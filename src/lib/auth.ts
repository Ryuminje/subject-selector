import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  emailAndPassword: {
    enabled: true,
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
    },
  },
  plugins: [nextCookies()],
});
