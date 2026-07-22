import { prisma } from "@/lib/prisma";

// 로그인 사용자의 "실제 교사 이름"을 결정 — teacherId가 연결돼 있으면 Teacher.name을,
// 아니면 계정 이름을 그대로 사용. 연수 이수증 제출/조회에서 본인 식별의 단일 소스.
export async function resolveTeacherName(user: {
  name: string;
  schoolId: string;
  teacherId?: string | null;
}): Promise<string> {
  if (user.teacherId) {
    const teacher = await prisma.teacher.findFirst({
      where: { id: user.teacherId, schoolId: user.schoolId },
      select: { name: true },
    });
    if (teacher) return teacher.name;
  }
  return user.name;
}
