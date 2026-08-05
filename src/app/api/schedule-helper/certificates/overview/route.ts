import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveTeacherName } from "@/features/schedule-helper/lib/resolveTeacherName";
import { getCertificateRoster } from "@/features/schedule-helper/lib/getCertificateRoster";

// 연수 이수증 수거 화면의 단일 진입점.
// 등록된 모든 연수를 "대상 명단 / 완료한 사람 / 남은 사람"이라는 같은 모양으로 돌려줍니다.
// 이수증(certificate)은 TrainingCertificate 제출로, 서명(sign)은 그 연수의 가장 최근
// SignSession에 들어온 서명으로 완료 여부를 판정합니다.
//
// 이름 목록(done/missing)은 기존 bulk-check와 같은 권한 경계를 유지해서 관리자 또는
// 그 연수를 등록한 담당자에게만 내려보내고, 그 외에는 인원수와 "내 상태"만 내려보냅니다.
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const schoolId = session.user.schoolId;
  const isAdmin = session.user.role === "ADMIN";

  const [myName, titles, certificates, signSessions, defaultRoster] = await Promise.all([
    resolveTeacherName(session.user),
    prisma.trainingTitle.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, registeredByName: true, rosterSnapshot: true, category: true, createdAt: true },
    }),
    prisma.trainingCertificate.findMany({
      where: { schoolId },
      select: { teacherName: true, trainingTitle: true },
    }),
    prisma.signSession.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        trainingTitles: true,
        rosterSnapshot: true,
        titleRosters: true,
        locked: true,
        createdAt: true,
        signatures: { select: { teacherName: true } },
      },
    }),
    getCertificateRoster(schoolId),
  ]);

  // 연수 제목 -> 제출한 사람 이름 집합
  const submittedByTitle = new Map<string, Set<string>>();
  for (const c of certificates) {
    let set = submittedByTitle.get(c.trainingTitle);
    if (!set) {
      set = new Set<string>();
      submittedByTitle.set(c.trainingTitle, set);
    }
    set.add(c.teacherName);
  }

  // 연수 제목 -> 그 제목을 포함하는 "가장 최근" 세션. sessions가 최신순이라 처음 만난 것이 최신.
  interface SessionInfo {
    id: string;
    locked: boolean;
    createdAt: Date;
    roster: string[] | null; // 이 연수 전용 명단(titleRosters). 없으면 세션 전체 명단으로 폴백
    fallbackRoster: string[];
    signed: Set<string>;
  }
  const sessionByTitle = new Map<string, SessionInfo>();
  for (const s of signSessions) {
    const sessionTitles = JSON.parse(s.trainingTitles) as string[];
    const titleRosters = s.titleRosters ? (JSON.parse(s.titleRosters) as Record<string, string[]>) : null;
    const fallbackRoster = JSON.parse(s.rosterSnapshot) as string[];
    const signed = new Set(s.signatures.map((sig) => sig.teacherName));
    for (const t of sessionTitles) {
      if (sessionByTitle.has(t)) continue;
      sessionByTitle.set(t, {
        id: s.id,
        locked: s.locked,
        createdAt: s.createdAt,
        roster: titleRosters?.[t] ?? null,
        fallbackRoster,
        signed,
      });
    }
  }

  const items = titles.map((t) => {
    const canManage = isAdmin || t.registeredByName === myName;
    const ownRoster = t.rosterSnapshot ? (JSON.parse(t.rosterSnapshot) as string[]) : null;
    const sess = t.category === "sign" ? sessionByTitle.get(t.title) ?? null : null;

    // 대상 명단: 서명 연수는 실제로 서명을 받은 세션의 명단이 진실에 가깝고(세션 생성 시점 스냅샷),
    // 세션이 아직 없으면 연수에 등록해 둔 명단, 그것도 없으면 전체 기본 명단.
    const roster = sess ? sess.roster ?? sess.fallbackRoster : ownRoster ?? defaultRoster;

    const doneSet = sess ? sess.signed : submittedByTitle.get(t.title) ?? new Set<string>();
    const done = roster.filter((n) => doneSet.has(n));
    const missing = roster.filter((n) => !doneSet.has(n));

    const inRoster = roster.includes(myName);
    const myStatus: "done" | "todo" | "out" = !inRoster ? "out" : doneSet.has(myName) ? "done" : "todo";

    return {
      id: t.id,
      title: t.title,
      registeredByName: t.registeredByName,
      category: t.category as "certificate" | "sign",
      createdAt: t.createdAt,
      hasOwnRoster: ownRoster !== null,
      total: roster.length,
      doneCount: done.length,
      missingCount: missing.length,
      myStatus,
      canManage,
      // 이름 목록은 관리자/담당자에게만
      done: canManage ? done : null,
      missing: canManage ? missing : null,
      session: sess ? { id: sess.id, locked: sess.locked, createdAt: sess.createdAt } : null,
    };
  });

  return NextResponse.json({ myName, isAdmin, items });
}
