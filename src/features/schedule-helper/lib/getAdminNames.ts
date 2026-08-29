import { prisma } from "@/lib/prisma";

// 학교의 현재 관리자 이름 집합. 명단 프리셋처럼 "만든 사람"을 이름 문자열로만 기록하는 데이터
// (User에 관계를 걸지 않는 이 저장소의 원칙 — resolveTeacherName.ts 참고)의 공개 범위를 실시간으로
// 판정할 때 씁니다: 관리자가 만들었으면 학교 전체에 공개, 아니면 그 이름 본인에게만.
export async function getAdminNames(schoolId: string): Promise<Set<string>> {
  const admins = await prisma.user.findMany({
    where: { schoolId, role: "ADMIN" },
    select: { name: true },
  });
  return new Set(admins.map((a) => a.name));
}
