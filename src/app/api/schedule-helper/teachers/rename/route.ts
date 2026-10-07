import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  recordRename,
  renameInJsonNames,
  renameInSchedule,
  renameInTeacherFields,
  renameInTitleRosters,
  type RenameMode,
  type ScheduleCore,
} from "@/features/schedule-helper/lib/renameTeacher";

const MAX_NAME_LENGTH = 40;

// 교사 이름 바꾸기 — 시간표와 이름이 글자 그대로 저장된 모든 곳을 한 트랜잭션으로 함께 바꿉니다.
// 같은 이름이 이미 시간표에 있으면 항상 거절합니다(이름이 곧 키라 두 사람을 같은 이름으로 둘 수 없음).
// 동명이인 확인은 화면에서 받고, 여기에는 이미 구분된 이름("이영희(2)")이 들어옵니다.
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 교사 이름을 바꿀 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const from = typeof body?.from === "string" ? body.from.trim() : "";
  const to = typeof body?.to === "string" ? body.to.trim() : "";
  const mode: RenameMode = body?.mode === "replace" ? "replace" : "correct";
  const includeCertificates = body?.includeCertificates !== false;
  const dryRun = body?.dryRun === true;

  if (!from || !to) {
    return NextResponse.json({ error: "바꿀 이름을 입력해 주세요." }, { status: 400 });
  }
  if (to.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: `이름은 ${MAX_NAME_LENGTH}자 이하로 입력해 주세요.` }, { status: 400 });
  }
  if (from === to) {
    return NextResponse.json({ error: "지금 이름과 같습니다." }, { status: 400 });
  }

  const schoolId = session.user.schoolId;
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school?.scheduleData) {
    return NextResponse.json({ error: "업로드된 시간표가 없습니다." }, { status: 404 });
  }

  const core = JSON.parse(school.scheduleData) as ScheduleCore;
  if (!core.teachers.includes(from)) {
    return NextResponse.json({ error: `시간표에 "${from}" 선생님이 없습니다.` }, { status: 404 });
  }
  if (core.teachers.includes(to)) {
    return NextResponse.json(
      { error: `시간표에 "${to}" 선생님이 이미 있습니다.`, code: "NAME_EXISTS" },
      { status: 409 }
    );
  }

  // ── 읽기 ──────────────────────────────────────────────────────────────
  const [fromRow, staleRow, users, presets, batches] = await Promise.all([
    prisma.teacher.findUnique({ where: { schoolId_name: { schoolId, name: from } } }),
    // 옛 업로드에서 남은 행(지금 시간표엔 없음). 이 이름을 그대로 쓰므로 그 행은 정리합니다.
    prisma.teacher.findUnique({ where: { schoolId_name: { schoolId, name: to } } }),
    prisma.user.findMany({
      where: { schoolId, OR: [{ name: from }, { teacherId: { not: null } }] },
      select: { id: true, name: true, teacherId: true },
    }),
    prisma.meetingPreset.findMany({ where: { schoolId }, select: { id: true, teachers: true } }),
    prisma.makeupBatch.findMany({ where: { schoolId }, select: { id: true, entries: true } }),
  ]);

  const ops: Prisma.PrismaPromise<unknown>[] = [];

  // ── 시간표·학교 설정 ─────────────────────────────────────────────────
  const schedule = renameInSchedule(core, from, to);
  const blocked = renameInJsonNames(school.blockedTeachers, from, to);
  const manual = renameInTeacherFields(school.manualChanges, from, to);
  ops.push(
    prisma.school.update({
      where: { id: schoolId },
      data: {
        scheduleData: JSON.stringify(schedule.core),
        blockedTeachers: blocked.raw ?? school.blockedTeachers,
        manualChanges: manual.raw,
        teacherRenames: recordRename(school.teacherRenames, from, to),
      },
    })
  );

  // ── Teacher 행 ────────────────────────────────────────────────────────
  // 이름 정정이면 같은 사람이라 설정을 그대로, 후임 교체면 개인 설정(교체 불가 요일·임시)을 비웁니다.
  const linkedAccounts = fromRow ? users.filter((u) => u.teacherId === fromRow.id) : [];
  if (staleRow) {
    ops.push(prisma.user.updateMany({ where: { schoolId, teacherId: staleRow.id }, data: { teacherId: fromRow?.id ?? null } }));
    ops.push(prisma.teacher.delete({ where: { id: staleRow.id } }));
  }
  if (fromRow) {
    ops.push(
      prisma.teacher.update({
        where: { id: fromRow.id },
        data: mode === "replace" ? { name: to, fixedBlockDays: "{}", tempBlockDays: "{}" } : { name: to },
      })
    );
    // 후임 교체: 휴직자 계정이 후임 이름으로 인식되지 않도록 연결을 끊습니다.
    if (mode === "replace" && linkedAccounts.length > 0) {
      ops.push(prisma.user.updateMany({ where: { schoolId, teacherId: fromRow.id }, data: { teacherId: null } }));
    }
  } else {
    ops.push(prisma.teacher.create({ data: { schoolId, name: to } }));
  }

  // 이름 정정이면 계정 이름도 같이 바꿉니다 — 안 바꾸면 그 선생님 계정이 시간표 행과 이름이 달라져
  // "내 시간표" 고정과 이수증 제출 이름이 옛 이름으로 돌아갑니다.
  const namedAccounts = mode === "correct" ? users.filter((u) => u.name === from) : [];
  if (namedAccounts.length > 0) {
    ops.push(prisma.user.updateMany({ where: { schoolId, name: from }, data: { name: to } }));
  }

  // ── 사용자별 저장물 ─────────────────────────────────────────────────
  let presetCount = 0;
  for (const preset of presets) {
    const next = renameInJsonNames(preset.teachers, from, to);
    if (next.changed === 0 || next.raw === null) continue;
    presetCount += 1;
    ops.push(prisma.meetingPreset.update({ where: { id: preset.id }, data: { teachers: next.raw } }));
  }
  let batchCount = 0;
  for (const batch of batches) {
    const next = renameInTeacherFields(batch.entries, from, to);
    if (next.changed === 0) continue;
    batchCount += 1;
    ops.push(prisma.makeupBatch.update({ where: { id: batch.id }, data: { entries: next.raw } }));
  }

  // ── 연수 이수증 ───────────────────────────────────────────────────────
  const certificates = { certificates: 0, titles: 0, rosters: 0, signatures: 0, extras: 0 };
  if (includeCertificates) {
    const [titles, sessions, signatures, extras, rosterPresets, certCount] = await Promise.all([
      prisma.trainingTitle.findMany({ where: { schoolId }, select: { id: true, registeredByName: true, rosterSnapshot: true } }),
      prisma.signSession.findMany({ where: { schoolId }, select: { id: true, rosterSnapshot: true, titleRosters: true } }),
      prisma.signSessionSignature.findMany({
        where: { session: { schoolId }, teacherName: { in: [from, to] } },
        select: { sessionId: true, teacherName: true },
      }),
      prisma.certificateRosterExtra.findMany({ where: { schoolId, name: { in: [from, to] } }, select: { id: true, name: true } }),
      prisma.certificateRosterPreset.findMany({ where: { schoolId }, select: { id: true, names: true } }),
      prisma.trainingCertificate.count({ where: { schoolId, teacherName: from } }),
    ]);

    // 같은 서명 세션에 두 이름이 모두 서명돼 있으면 합쳐 버릴 수 없습니다(세션당 한 사람 한 번).
    const signedBy = new Map<string, Set<string>>();
    for (const sig of signatures) {
      const names = signedBy.get(sig.sessionId) ?? new Set<string>();
      names.add(sig.teacherName);
      signedBy.set(sig.sessionId, names);
    }
    const conflict = [...signedBy.values()].some((names) => names.has(from) && names.has(to));
    if (conflict) {
      return NextResponse.json(
        { error: `"${to}" 이름으로 이미 서명한 연수 서명 세션에 "${from}" 서명도 있어 합칠 수 없습니다. 다른 이름을 써 주세요.`, code: "SIGNATURE_CONFLICT" },
        { status: 409 }
      );
    }

    certificates.certificates = certCount;
    certificates.signatures = signatures.filter((s) => s.teacherName === from).length;
    if (certCount > 0) {
      ops.push(prisma.trainingCertificate.updateMany({ where: { schoolId, teacherName: from }, data: { teacherName: to } }));
    }
    if (certificates.signatures > 0) {
      ops.push(
        prisma.signSessionSignature.updateMany({
          where: { session: { schoolId }, teacherName: from },
          data: { teacherName: to },
        })
      );
    }
    for (const title of titles) {
      const roster = renameInJsonNames(title.rosterSnapshot, from, to);
      const byName = title.registeredByName === from;
      if (!byName && roster.changed === 0) continue;
      if (byName) certificates.titles += 1;
      if (roster.changed > 0) certificates.rosters += 1;
      ops.push(
        prisma.trainingTitle.update({
          where: { id: title.id },
          data: { ...(byName ? { registeredByName: to } : {}), ...(roster.changed > 0 ? { rosterSnapshot: roster.raw } : {}) },
        })
      );
    }
    for (const sess of sessions) {
      const snap = renameInJsonNames(sess.rosterSnapshot, from, to);
      const perTitle = renameInTitleRosters(sess.titleRosters, from, to);
      if (snap.changed === 0 && perTitle.changed === 0) continue;
      certificates.rosters += 1;
      ops.push(
        prisma.signSession.update({
          where: { id: sess.id },
          data: {
            ...(snap.changed > 0 && snap.raw !== null ? { rosterSnapshot: snap.raw } : {}),
            ...(perTitle.changed > 0 ? { titleRosters: perTitle.raw } : {}),
          },
        })
      );
    }
    for (const preset of rosterPresets) {
      const next = renameInJsonNames(preset.names, from, to);
      if (next.changed === 0 || next.raw === null) continue;
      certificates.rosters += 1;
      ops.push(prisma.certificateRosterPreset.update({ where: { id: preset.id }, data: { names: next.raw } }));
    }
    // 추가 명단(행정직원 등)에 옛 이름이 있으면 이름을 바꾸되, 새 이름도 이미 있으면 하나로 합칩니다.
    const extraFrom = extras.find((e) => e.name === from);
    if (extraFrom) {
      certificates.extras += 1;
      if (extras.some((e) => e.name === to)) ops.push(prisma.certificateRosterExtra.delete({ where: { id: extraFrom.id } }));
      else ops.push(prisma.certificateRosterExtra.update({ where: { id: extraFrom.id }, data: { name: to } }));
    }
  }

  const summary = {
    cells: schedule.cells,
    blockedTeachers: blocked.changed > 0,
    manualChanges: manual.changed,
    meetingPresets: presetCount,
    makeupBatches: batchCount,
    accounts: namedAccounts.length,
    unlinkedAccounts: mode === "replace" ? linkedAccounts.length : 0,
    adoptedStaleRow: !!staleRow,
    certificates,
  };

  if (dryRun) {
    return NextResponse.json({ dryRun: true, summary });
  }

  // DB가 NAS에 있어 왕복 지연이 커서(upload 라우트와 같은 이유) 배치 처리 + 넉넉한 타임아웃.
  await prisma.$transaction(ops, { timeout: 20000 });

  return NextResponse.json({ ok: true, from, to, mode, summary });
}
