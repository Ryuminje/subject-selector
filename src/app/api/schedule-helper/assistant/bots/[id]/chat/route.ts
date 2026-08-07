import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadBotAccess, requireApiKey } from "@/features/schedule-helper/lib/assistant/access";
import { embedQuery } from "@/features/schedule-helper/lib/assistant/embed";
import { searchChunks, type SearchHit } from "@/features/schedule-helper/lib/assistant/search";
import { streamAnswer, titleFromQuestion, type ChatTurn } from "@/features/schedule-helper/lib/assistant/chat";

// 질문 하나를 처리합니다: 자료 검색 → 답변 생성 → 글자를 흘려보내기.
//
// 응답은 SSE입니다. 각 줄은 { type } 을 가진 JSON 한 덩어리:
//   meta  — 스레드 id와 근거 자료 목록 (본문보다 먼저 옵니다)
//   delta — 답변 글자 조각
//   done  — 끝
//   error — 중간에 실패한 경우

export const maxDuration = 60;

/** 프롬프트에 넣을 직전 대화 수. 너무 길면 자료가 밀려나므로 짧게 유지합니다. */
const HISTORY_TURNS = 8;

// 근거 칩을 고르는 기준.
//
// 절대 임계값(예: 0.3 이상)은 여기서 쓸 수 없습니다 — Gemini 임베딩은 기준선이 높아서
// 아무 상관 없는 두 문장("학교폭력 조치사항 삭제 시기" ↔ "오늘 점심 메뉴")도 0.73이 나옵니다.
// 실측으로 확인한 사실이며, 그래서 "가장 잘 맞은 조각과 얼마나 가까운가"라는 상대 기준을 씁니다.
const CITATION_MARGIN = 0.06;
const MAX_CITATIONS = 3;

interface Citation {
  documentId: string;
  fileName: string;
  page: number | null;
}

function pickCitations(hits: SearchHit[]): Citation[] {
  if (hits.length === 0) return [];
  const best = hits[0].similarity;

  const seen = new Set<string>();
  const picked: Citation[] = [];
  for (const hit of hits) {
    if (best - hit.similarity > CITATION_MARGIN) break; // hits는 유사도 내림차순
    const key = `${hit.documentId}#${hit.page ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push({ documentId: hit.documentId, fileName: hit.fileName, page: hit.page });
    if (picked.length >= MAX_CITATIONS) break;
  }
  return picked;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const access = await loadBotAccess(id, session.user);
  if (!access || !access.canUse) {
    return NextResponse.json({ error: "챗봇을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const requestedThreadId = typeof body?.threadId === "string" ? body.threadId : null;
  if (!question) {
    return NextResponse.json({ error: "질문을 입력해 주세요." }, { status: 400 });
  }

  let apiKey: string;
  try {
    apiKey = await requireApiKey(access.bot.schoolId);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "API 키를 확인할 수 없습니다." },
      { status: 400 }
    );
  }

  const readyDocs = await prisma.assistantDocument.count({ where: { botId: id, status: "ready" } });
  if (readyDocs === 0) {
    return NextResponse.json(
      { error: "아직 분석이 끝난 자료가 없습니다. 자료를 올리고 분석이 끝난 뒤에 물어봐 주세요." },
      { status: 400 }
    );
  }

  // 스레드 확보 — 남의 스레드를 넘겨받아 이어쓰지 못하도록 userId까지 확인합니다.
  let thread = requestedThreadId
    ? await prisma.assistantThread.findFirst({
        where: { id: requestedThreadId, botId: id, userId: session.user.id },
        select: { id: true },
      })
    : null;
  if (!thread) {
    thread = await prisma.assistantThread.create({
      data: { botId: id, userId: session.user.id, title: titleFromQuestion(question) },
      select: { id: true },
    });
  }
  const threadId = thread.id;

  const previous = await prisma.assistantMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_TURNS,
    select: { role: true, content: true },
  });
  const history: ChatTurn[] = previous
    .reverse()
    .map((m) => ({ role: m.role === "model" ? "model" : "user", content: m.content }));

  let hits: SearchHit[];
  try {
    const queryVector = await embedQuery(apiKey, question);
    hits = await searchChunks(id, queryVector);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "자료를 검색하지 못했습니다." },
      { status: 502 }
    );
  }

  await prisma.assistantMessage.create({
    data: { threadId, role: "user", content: question },
  });

  const citations = pickCitations(hits);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

      send({ type: "meta", threadId, sources: citations });

      let answer = "";
      try {
        for await (const delta of streamAnswer({
          apiKey,
          persona: access.bot.persona,
          history,
          question,
          hits,
        })) {
          answer += delta;
          send({ type: "delta", text: delta });
        }
      } catch (error) {
        send({ type: "error", message: error instanceof Error ? error.message : "답변 생성에 실패했습니다." });
        controller.close();
        return;
      }

      // 모델이 "자료에 없다"고 답했다면 근거 칩을 붙이지 않습니다 —
      // 근거가 없다는 답 옆에 근거가 달려 있으면 읽는 사람이 오해합니다.
      const grounded = !answer.includes("확인할 수 없습니다");
      const finalCitations = grounded ? citations : [];

      await prisma.assistantMessage.create({
        data: { threadId, role: "model", content: answer, citations: JSON.stringify(finalCitations) },
      });
      await prisma.assistantThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });

      send({ type: "done", sources: finalCitations });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
