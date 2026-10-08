// 로컬 개발용 표본 데이터 심기. **운영에서는 동작하지 않습니다**(아래 NODE_ENV 가드).
//
//   POST http://localhost:3000/api/dev-seed
//   → 가상의 학교·교사 14명·시간표·계정 4개·연수/이수증/서명·협의회 프리셋·보강원 세트를 만듭니다.
//
// 쌤스 헬퍼는 로그인+DB가 있어야 화면을 볼 수 있는데, 새 컴퓨터에는 데이터가 없어서
// 아무것도 확인할 수 없습니다. 그때 이 라우트로 한 번에 만들어 쓰라고 저장소에 넣어 뒀습니다.
// 로컬 DB를 띄우는 방법은 AGENTS.md의 "다른 컴퓨터에서 이어받기" 항목을 보세요.
//
// 시간표·막힘 설정·계정 목록은 `devSeedData.ts`에 있고, 화면에서 무엇이 나와야 하는지는 그
// 파일의 `EXPECTATIONS`에 적어 두었습니다(이 라우트도 응답에 그 내용을 같이 돌려줍니다).
// 여러 번 실행해도 안전합니다(있으면 지우고 다시 만듭니다).

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";
import { dateForWeekday } from "@/features/schedule-helper/lib/makeup/buildRows";
import {
  EXPECTATIONS,
  SEED_ACCOUNTS,
  SEED_BLOCKED_SUBJECTS,
  SEED_BLOCKED_TEACHERS,
  SEED_DAYS,
  SEED_DEPARTMENT_GROUPS,
  SEED_DEPTS,
  SEED_FIXED_BLOCKS,
  SEED_GLOBAL_MEETING_BLOCKS,
  SEED_PERIODS,
  SEED_ROSTER_EXTRAS,
  SEED_TEACHERS,
  SEED_TEMP_BLOCKS,
  seedTableData,
} from "@/features/schedule-helper/lib/devSeedData";

// ⚠️ 학교 이름을 일부러 진짜 운영 학교와 똑같이 "명신고등학교"로 씁니다(예전엔 구분되게
// "명신고등학교(로컬테스트)"였습니다). 실제 화면·인쇄물이 어떻게 보이는지 확인하려는
// 용도라 이름까지 실제와 같아야 의미가 있습니다. **이 데이터는 여전히 이 컴퓨터의 로컬
// 전용 DB(prisma dev) 안에만 있고 운영 NAS와는 완전히 무관합니다** — 이름이 같다고
// 헷갈리지 마세요. 옛 이름으로 만들어졌던 학교가 있으면 아래서 같이 정리합니다.
const SCHOOL = "명신고등학교";
const OLD_SCHOOL_NAMES = ["명신고등학교(로컬테스트)"];
const PASSWORD = "test1234";

// 1×1 투명 PNG — 이수증 첨부·서명 이미지 자리에 들어가는 아주 작은 표본 파일.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const today = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export async function POST() {
  // 운영에 배포돼도 절대 실행되지 않게 막습니다. 이 라우트는 계정을 만들고 데이터를 지우므로
  // 실수로라도 운영에서 돌면 안 됩니다. Vercel은 NODE_ENV가 production입니다.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 여러 번 돌려도 안전하도록, 있으면 지우고 다시 만듭니다.
  // 학교 이름을 "명신고등학교(로컬테스트)" → "명신고등학교"로 바꾼 적이 있어(2026-08-31),
  // 옛 이름으로 남은 학교도 같이 정리합니다 — 안 지우면 중복으로 쌓입니다.
  const stale = await prisma.school.findMany({ where: { name: { in: [SCHOOL, ...OLD_SCHOOL_NAMES] } } });
  for (const s of stale) {
    const staleUsers = await prisma.user.findMany({ where: { schoolId: s.id }, select: { id: true } });
    // MeetingPreset은 User에 @relation이 없어 cascade가 안 걸립니다(members DELETE 라우트와 같은 이유) —
    // 여기서도 먼저 지워야 고아 행이 안 남습니다.
    await prisma.meetingPreset.deleteMany({ where: { userId: { in: staleUsers.map((u) => u.id) } } });
    await prisma.makeupBatch.deleteMany({ where: { userId: { in: staleUsers.map((u) => u.id) } } });
    await prisma.user.deleteMany({ where: { schoolId: s.id } });
    await prisma.teacher.deleteMany({ where: { schoolId: s.id } });
    await prisma.school.delete({ where: { id: s.id } });
  }

  // 이번 주 화요일 — "이미 이뤄진 교체·보강" 기록은 날짜가 박혀 있어 그 주 시간표에만 반영됩니다.
  const baseDate = today();
  const manualChanges = [
    {
      id: randomUUID(),
      kind: "sub",
      absentTeacher: "정국어",
      absent: { date: dateForWeekday(baseDate, "화"), day: "화", period: 3 }, // 정국어 화3(2학년 국어 2-7)
      partnerTeacher: "박교체", // 박교체는 화3이 비어 있어 들어갈 수 있음 → 이번 주엔 박교체 화3이 수업 중으로 보임
      createdAt: new Date().toISOString(),
    },
  ];

  const school = await prisma.school.create({
    data: {
      name: SCHOOL,
      joinCode: "LOCALTST",
      scheduleData: JSON.stringify({
        teachers: SEED_TEACHERS,
        days: SEED_DAYS,
        periods: SEED_PERIODS,
        tableData: seedTableData,
      }),
      scheduleUploadedAt: new Date(),
      departmentGroups: JSON.stringify(SEED_DEPARTMENT_GROUPS),
      globalMeetingBlocks: JSON.stringify(SEED_GLOBAL_MEETING_BLOCKS),
      blockedSubjects: JSON.stringify(SEED_BLOCKED_SUBJECTS),
      blockedTeachers: JSON.stringify(SEED_BLOCKED_TEACHERS),
      manualChanges: JSON.stringify(manualChanges),
    },
  });

  await prisma.teacher.createMany({
    data: SEED_TEACHERS.map((name) => ({
      schoolId: school.id,
      name,
      department: SEED_DEPTS[name] ?? null,
      fixedBlockDays: JSON.stringify(SEED_FIXED_BLOCKS[name] ?? {}),
      tempBlockDays: JSON.stringify(SEED_TEMP_BLOCKS[name] ?? {}),
    })),
  });
  const teacherRows = await prisma.teacher.findMany({ where: { schoolId: school.id } });
  const teacherIdOf = new Map(teacherRows.map((t) => [t.name, t.id]));

  // ── 계정 ──
  const hashed = await hashPassword(PASSWORD);
  const userIdOf = new Map<string, string>();
  for (const acc of SEED_ACCOUNTS) {
    const userId = randomUUID();
    userIdOf.set(acc.name, userId);
    await prisma.user.create({
      data: {
        id: userId,
        name: acc.name,
        email: acc.email ?? `${userId}@login.internal`,
        emailVerified: false,
        role: acc.role,
        schoolId: school.id,
        loginId: acc.loginId ?? null,
        teacherId: teacherIdOf.get(acc.teacher),
      },
    });
    await prisma.account.create({
      data: { id: randomUUID(), accountId: userId, providerId: "credential", userId, password: hashed },
    });
  }
  const adminId = userIdOf.get("김결강")!;

  // ── 협의회 시간 찾기 프리셋(계정별) ──
  await prisma.meetingPreset.createMany({
    data: [
      { userId: adminId, schoolId: school.id, name: "과학과", teachers: JSON.stringify(["김결강", "박교체", "이보강"]) },
      {
        userId: adminId,
        schoolId: school.id,
        name: "2학년 교체 상대",
        teachers: JSON.stringify(["김결강", "한수학", "박교체", "최영어"]),
      },
      {
        userId: userIdOf.get("박교체")!,
        schoolId: school.id,
        name: "영어과",
        teachers: JSON.stringify(["최영어", "강영어", "윤영어", "오영어"]),
      },
    ],
  });

  // ── 보강원 작업 세트(김결강 개인) ──
  await prisma.makeupBatch.create({
    data: {
      userId: adminId,
      schoolId: school.id,
      name: "출장 보강 세트(예시)",
      baseDate,
      entries: JSON.stringify([
        {
          id: randomUUID(),
          kind: "swap",
          absentTeacher: "김결강",
          absent: { day: "화", period: 2, grade: "2", classNum: "3", subject: "물리학" },
          partnerTeacher: "박교체",
          exchange: { day: "수", period: 4, grade: "2", classNum: "3", subject: "지구과학" },
        },
        {
          id: randomUUID(),
          kind: "sub",
          absentTeacher: "김결강",
          absent: { day: "화", period: 5, grade: "1", classNum: "7", subject: "통합과학A" },
          partnerTeacher: "이보강",
        },
      ]),
    },
  });

  // ── 연수 이수증 수거 ──
  await prisma.certificateRosterExtra.createMany({
    data: SEED_ROSTER_EXTRAS.map((name) => ({ schoolId: school.id, name, addedBy: "김결강" })),
  });
  const everyone = [...SEED_TEACHERS, ...SEED_ROSTER_EXTRAS];

  await prisma.certificateRosterPreset.createMany({
    data: [
      // 관리자가 만든 것 → 학교 전체에 공통으로 보임
      { schoolId: school.id, name: "전체 교직원", names: JSON.stringify(everyone), createdBy: "김결강" },
      { schoolId: school.id, name: "과학과", names: JSON.stringify(["김결강", "박교체", "이보강"]), createdBy: "김결강" },
      // 일반 교사가 만든 것 → 만든 본인에게만 보임
      { schoolId: school.id, name: "박교체의 연수 명단", names: JSON.stringify(["박교체", "이보강", "한수학"]), createdBy: "박교체" },
    ],
  });

  const titles = [
    // 이수증 수거: 기본 명단(전체) / 연수 전용 명단
    { title: "2026 학교폭력 예방 연수", registeredByName: "김결강", category: "certificate", roster: null as string[] | null },
    {
      title: "교원 인권 보호 연수",
      registeredByName: "박교체",
      category: "certificate",
      roster: ["김결강", "박교체", "이보강", "한수학", "정국어"],
    },
    // 서명 연수
    { title: "교직원 정보보안 서명 연수", registeredByName: "김결강", category: "sign", roster: null },
    {
      title: "안전 교육 서명 연수",
      registeredByName: "박교체",
      category: "sign",
      roster: ["김결강", "박교체", "이보강", "김행정"],
    },
  ];
  await prisma.trainingTitle.createMany({
    data: titles.map((t) => ({
      schoolId: school.id,
      title: t.title,
      registeredByName: t.registeredByName,
      category: t.category,
      rosterSnapshot: t.roster ? JSON.stringify(t.roster) : null,
    })),
  });

  // 제출 내역 — 일부만 제출해서 "일괄확인"에 제출/미제출이 섞여 보이게 합니다.
  const submissions: Array<[string, string, string]> = [
    ["박교체", "2026 학교폭력 예방 연수", "KR-2026-0001"],
    ["이보강", "2026 학교폭력 예방 연수", "KR-2026-0002"],
    ["한수학", "2026 학교폭력 예방 연수", "KR-2026-0003"],
    ["최영어", "2026 학교폭력 예방 연수", "KR-2026-0004"],
    ["김결강", "교원 인권 보호 연수", "KR-2026-0101"],
    ["박교체", "교원 인권 보호 연수", "KR-2026-0102"],
  ];
  await prisma.trainingCertificate.createMany({
    data: submissions.map(([teacherName, trainingTitle, number]) => ({
      schoolId: school.id,
      teacherName,
      trainingTitle,
      number,
      institution: "가상교원연수원",
      certDate: "2026-09-15",
      fileName: `${teacherName}_${number}.png`,
      mimeType: "image/png",
      fileBytes: TINY_PNG,
    })),
  });

  // QR 서명 세션 — 일부만 서명한 상태
  const signTitle = "교직원 정보보안 서명 연수";
  const session = await prisma.signSession.create({
    data: {
      schoolId: school.id,
      trainingTitles: JSON.stringify([signTitle]),
      rosterSnapshot: JSON.stringify(everyone),
      titleRosters: JSON.stringify({ [signTitle]: everyone }),
      createdByUserId: adminId,
    },
  });
  await prisma.signSessionSignature.createMany({
    data: ["김결강", "박교체", "이보강", "정국어", "김행정"].map((teacherName) => ({
      sessionId: session.id,
      teacherName,
      signaturePng: TINY_PNG,
    })),
  });

  return NextResponse.json({
    ok: true,
    school: school.name,
    password: PASSWORD,
    accounts: SEED_ACCOUNTS.map((a) => ({
      name: a.name,
      role: a.role,
      loginId: a.loginId ?? null,
      email: a.email ?? null,
    })),
    teachers: SEED_TEACHERS.length,
    signSessionId: session.id,
    expectations: EXPECTATIONS,
  });
}
