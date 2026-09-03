// 로컬 개발용 표본 데이터 심기. **운영에서는 동작하지 않습니다**(아래 NODE_ENV 가드).
//
//   POST http://localhost:3000/api/dev-seed
//   → 가상의 학교·교사·시간표를 만들고, 로그인 계정 test / test1234 를 만들어 줍니다.
//
// 쌤스 헬퍼는 로그인+DB가 있어야 화면을 볼 수 있는데, 새 컴퓨터에는 데이터가 없어서
// 아무것도 확인할 수 없습니다. 그때 이 라우트로 한 번에 만들어 쓰라고 저장소에 넣어 뒀습니다.
// 로컬 DB를 띄우는 방법은 AGENTS.md의 "다른 컴퓨터에서 이어받기" 항목을 보세요.
//
// 시간표는 두 기능을 다 확인할 수 있게 일부러 맞춰 짰습니다 —
//  · 교체 후보 : 상대가 **나와 같은 학반**을 다른 시간에 가르쳐야 잡힙니다.
//  · 동과 대강 : 그 수업이 **이동수업**(`통합과학A(1-7)`처럼 대문자+괄호)이어야 뜹니다.
// 여러 번 실행해도 안전합니다(있으면 지우고 다시 만듭니다).

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";

// ⚠️ 학교 이름을 일부러 진짜 운영 학교와 똑같이 "명신고등학교"로 씁니다(예전엔 구분되게
// "명신고등학교(로컬테스트)"였습니다). 실제 화면·인쇄물이 어떻게 보이는지 확인하려는
// 용도라 이름까지 실제와 같아야 의미가 있습니다. **이 데이터는 여전히 이 컴퓨터의 로컬
// 전용 DB(prisma dev) 안에만 있고 운영 NAS와는 완전히 무관합니다** — 이름이 같다고
// 헷갈리지 마세요. 옛 이름으로 만들어졌던 학교가 있으면 아래서 같이 정리합니다.
const SCHOOL = "명신고등학교";
const OLD_SCHOOL_NAMES = ["명신고등학교(로컬테스트)"];
const DAYS = ["월", "화", "수", "목", "금"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

type Row = { teacher: string } & Record<string, string>;

const row = (teacher: string, lessons: Record<string, string>): Row => {
  const r: Row = { teacher };
  for (const day of DAYS) for (const p of PERIODS) r[`${day}${p}`] = "";
  return Object.assign(r, lessons);
};

// 이 시간표는 두 가지 후보가 모두 나오도록 일부러 맞춰 짠 것입니다.
//
//  · 일반 수업 교체 : 상대 교사가 **나와 같은 학반**을 다른 시간에 가르치고, 서로 그 시간에
//    비어 있어야 후보가 됩니다. (SwapTab의 `oInfo.grade === myInfo.grade && oInfo.classNum === ...`)
//  · 동과 대강     : 그 수업이 **이동수업**이어야 합니다. `A(2-3)`처럼 대문자+괄호가 있어야
//    `parseClassInfo`가 isMovingClass로 인식하고, 동시에 "N학년"도 있어야 학반이 잡힙니다.
//    그래서 "1학년 통합과학A(1-7)" 같은 형태로 씁니다.
const tableData: Row[] = [
  // 결강할 선생님(=로그인 계정). 화요일 2·5교시, 목요일 1교시에 수업이 있습니다.
  row("김결강", {
    화2: "2학년 물리학(2-3)", // 일반 수업 → 교체 후보가 잡힘
    화5: "1학년 통합과학A(1-7)", // 이동수업 → 동과 대강 후보가 잡힘
    수3: "2학년 물리학(2-5)",
    목1: "3학년 물리학II(3-2)", // 다른 날 → 보강원이 2장으로 갈리는지 확인용
    금4: "1학년 통합과학A(1-7)",
  }),
  // 교체 상대(과학). 2-3반과 3-2반을 가르쳐서 김결강과 맞바꿀 거리가 있고,
  // 화2·화5·목1에는 비어 있어 그 시간에 들어갈 수 있습니다.
  row("박교체", {
    월2: "2학년 지구과학(2-1)",
    수4: "2학년 지구과학(2-3)", // ← 화2(2-3)와 맞바꿀 수 있는 수업
    목3: "1학년 통합과학A(1-3)",
    금6: "3학년 지구과학(3-2)", // ← 목1(3-2)와 맞바꿀 수 있는 수업
  }),
  // 대강 상대(과학). 화5에 비어 있어 동과 대강 후보가 됩니다.
  row("이보강", {
    월1: "1학년 통합과학A(1-2)",
    화3: "2학년 화학(2-4)",
    수2: "2학년 화학(2-6)",
    목5: "3학년 화학II(3-4)",
  }),
  // 다른 교과 — 동과 대강 후보에서 걸러지는지 확인용(과학이 아니라 안 뜹니다).
  // 화7(2-5)은 트레이 충돌 검증용 — 수3(2-5)과 교체하면 김결강이 화7에 가 있게 됩니다.
  row("정국어", { 화3: "2학년 국어(2-7)", 수1: "1학년 국어(1-1)", 목4: "3학년 화법과작문(3-5)", 화7: "2학년 국어(2-5)" }),
  // 2-3반 수학 담당 — 화2 교체 후보가 한 명 더 나오도록.
  // 화7(3-2)도 트레이 충돌 검증용 — 정국어와 교체해 김결강이 화7에 가 있는 상태에서
  // 목1(3-2)을 다시 검색하면, 이 후보(같은 화7)가 "교체 불가"로 막히는지 확인할 수 있습니다.
  row("한수학", { 월3: "1학년 수학(1-4)", 화4: "2학년 수학(2-2)", 목6: "2학년 수학(2-3)", 화7: "3학년 수학(3-2)" }),
];

const DEPTS: Record<string, string> = {
  김결강: "과학",
  박교체: "과학",
  이보강: "과학",
  정국어: "국어",
  한수학: "수학",
};

export async function POST() {
  // 운영에 배포돼도 절대 실행되지 않게 막습니다. 이 라우트는 계정을 만들고 데이터를 지우므로
  // 실수로라도 운영에서 돌면 안 됩니다. Vercel은 NODE_ENV가 production입니다.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const teachers = tableData.map((r) => r.teacher);

  // 여러 번 돌려도 안전하도록, 있으면 지우고 다시 만듭니다.
  // 학교 이름을 "명신고등학교(로컬테스트)" → "명신고등학교"로 바꾼 적이 있어(2026-08-31),
  // 옛 이름으로 남은 학교도 같이 정리합니다 — 안 지우면 중복으로 쌓입니다.
  const stale = await prisma.school.findMany({ where: { name: { in: [SCHOOL, ...OLD_SCHOOL_NAMES] } } });
  for (const s of stale) {
    const staleUsers = await prisma.user.findMany({ where: { schoolId: s.id }, select: { id: true } });
    // MeetingPreset은 User에 @relation이 없어 cascade가 안 걸립니다(members DELETE 라우트와 같은 이유) —
    // 여기서도 먼저 지워야 고아 행이 안 남습니다.
    await prisma.meetingPreset.deleteMany({ where: { userId: { in: staleUsers.map((u) => u.id) } } });
    await prisma.user.deleteMany({ where: { schoolId: s.id } });
    await prisma.teacher.deleteMany({ where: { schoolId: s.id } });
    await prisma.school.delete({ where: { id: s.id } });
  }

  const school = await prisma.school.create({
    data: {
      name: SCHOOL,
      joinCode: "LOCALTST",
      scheduleData: JSON.stringify({ teachers, days: DAYS, periods: PERIODS, tableData }),
      scheduleUploadedAt: new Date(),
      departmentGroups: JSON.stringify(["국어", "영어", "수학", "사회", "과학"]),
    },
  });

  for (const name of teachers) {
    await prisma.teacher.create({
      data: { schoolId: school.id, name, department: DEPTS[name] ?? null },
    });
  }

  const me = await prisma.teacher.findFirst({ where: { schoolId: school.id, name: "김결강" } });
  const userId = randomUUID();
  await prisma.user.create({
    data: {
      id: userId,
      name: "김결강",
      email: `${userId}@login.internal`,
      emailVerified: false,
      role: "ADMIN",
      schoolId: school.id,
      loginId: "test",
      teacherId: me?.id,
    },
  });
  await prisma.account.create({
    data: {
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: await hashPassword("test1234"),
    },
  });

  return NextResponse.json({ ok: true, school: school.name, loginId: "test", password: "test1234" });
}
