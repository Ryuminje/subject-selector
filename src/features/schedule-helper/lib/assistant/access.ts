// 챗봇 접근 권한을 판정하는 유일한 곳.
//
// 규칙은 연수 이수증 화면과 같습니다: 만든 사람이 곧 관리자.
//  - canManage(수정·자료 추가/삭제·삭제): 학교 관리자 또는 만든 본인
//  - canUse(대화): canManage이거나, 학교 전체로 공개된 챗봇
// 1단계에서는 공개 기능을 열지 않아 visibility가 항상 "private"이지만,
// 판정 자체는 미리 여기 한 곳에 모아 둡니다.

import { prisma } from "@/lib/prisma";

export interface SessionUser {
  id: string;
  name: string;
  role: string;
  schoolId: string;
}

export interface BotAccess {
  bot: {
    id: string;
    schoolId: string;
    ownerUserId: string;
    ownerName: string;
    name: string;
    tagline: string | null;
    emoji: string;
    accent: string;
    persona: string | null;
    starters: string;
    visibility: string;
  };
  canManage: boolean;
  canUse: boolean;
}

export async function loadBotAccess(botId: string, user: SessionUser): Promise<BotAccess | null> {
  const bot = await prisma.assistantBot.findUnique({
    where: { id: botId },
    select: {
      id: true,
      schoolId: true,
      ownerUserId: true,
      ownerName: true,
      name: true,
      tagline: true,
      emoji: true,
      accent: true,
      persona: true,
      starters: true,
      visibility: true,
    },
  });

  // 다른 학교의 챗봇은 존재 자체를 알리지 않습니다.
  if (!bot || bot.schoolId !== user.schoolId) return null;

  const canManage = user.role === "ADMIN" || bot.ownerUserId === user.id;
  return { bot, canManage, canUse: canManage || bot.visibility === "school" };
}

export class MissingApiKeyError extends Error {
  constructor() {
    super("학교에 등록된 Gemini API 키가 없습니다. 연수 이수증 수거 화면의 공통 설정에서 관리자가 먼저 키를 등록해야 합니다.");
  }
}

/** 학교 공용 Gemini 키 — 이수증 수거에서 쓰던 School.geminiApiKey를 그대로 재사용합니다. */
export async function requireApiKey(schoolId: string): Promise<string> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { geminiApiKey: true },
  });
  const key = school?.geminiApiKey?.trim();
  if (!key) throw new MissingApiKeyError();
  return key;
}
