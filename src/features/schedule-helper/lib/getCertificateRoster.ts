import { prisma } from "@/lib/prisma";

// 연수 이수증 수거(일괄확인/QR 서명)용 전체 대상자 명단.
// 시간표에 등장하는 Teacher + 시간표에 없는 인원을 위한 CertificateRosterExtra를 합칩니다.
// 시간표 교체 도우미는 School.scheduleData.teachers를 별도로 쓰므로 이 명단은 영향을 주지 않습니다.
export async function getCertificateRoster(schoolId: string): Promise<string[]> {
  const [teachers, extras] = await Promise.all([
    prisma.teacher.findMany({ where: { schoolId }, select: { name: true } }),
    prisma.certificateRosterExtra.findMany({ where: { schoolId }, select: { name: true } }),
  ]);

  const names = new Set<string>([...teachers.map((t) => t.name), ...extras.map((e) => e.name)]);
  return Array.from(names).sort((a, b) => a.localeCompare(b, "ko"));
}
