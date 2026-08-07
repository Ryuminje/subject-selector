import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadBotAccess, requireApiKey } from "@/features/schedule-helper/lib/assistant/access";
import { extractDocumentText } from "@/features/schedule-helper/lib/assistant/extractText";
import { chunkPages } from "@/features/schedule-helper/lib/assistant/chunk";
import { embedDocuments, RateLimitError } from "@/features/schedule-helper/lib/assistant/embed";
import { insertChunks, pendingChunks, setEmbeddings } from "@/features/schedule-helper/lib/assistant/search";
import { INGEST_BATCH } from "@/features/schedule-helper/lib/assistant/config";

// 자료 분석을 "조금씩" 진행시키는 라우트.
//
// 큐 서버를 따로 두지 않고, 화면이 이 라우트를 status가 ready/failed가 될 때까지 반복 호출합니다.
// 호출 한 번이 하는 일은 둘 중 하나뿐입니다:
//   pending    → 텍스트 추출 + 조각 나눠 저장 (임베딩은 아직)
//   processing → 임베딩이 비어 있는 조각을 INGEST_BATCH개만큼 채움
// 이렇게 잘라두면 서버리스 함수 시간 제한에 걸리지 않고, 진행률도 공짜로 얻습니다.

export const maxDuration = 60;

interface Progress {
  status: string;
  pageCount: number | null;
  chunkCount: number;
  embeddedCount: number;
  error: string | null;
  /** 속도 제한에 걸려 잠시 쉬는 중 — 화면은 이만큼 기다렸다 다시 호출하면 됩니다. */
  waitMs?: number;
  notice?: string;
}

export async function POST(request: Request, context: { params: Promise<{ docId: string }> }) {
  const { docId } = await context.params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const document = await prisma.assistantDocument.findUnique({
    where: { id: docId },
    select: {
      id: true,
      botId: true,
      fileName: true,
      status: true,
      pageCount: true,
      chunkCount: true,
      embeddedCount: true,
      error: true,
    },
  });
  if (!document) {
    return NextResponse.json({ error: "자료를 찾을 수 없습니다." }, { status: 404 });
  }

  const access = await loadBotAccess(document.botId, session.user);
  if (!access) {
    return NextResponse.json({ error: "자료를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!access.canManage) {
    return NextResponse.json({ error: "만든 사람만 자료를 분석할 수 있습니다." }, { status: 403 });
  }

  // ?retry=1 이면 실패한 자료를 되살립니다. 속도 제한처럼 시간이 지나면 풀리는 오류가 많아서,
  // 파일을 지우고 다시 올리지 않아도 이어서 분석할 수 있어야 합니다.
  const retry = new URL(request.url).searchParams.get("retry") === "1";
  let status = document.status;
  if (retry && status === "failed") {
    // 조각이 이미 만들어져 있으면 임베딩 단계부터, 아니면 텍스트 추출부터 다시.
    status = document.chunkCount > 0 ? "processing" : "pending";
    await prisma.assistantDocument.update({
      where: { id: docId },
      data: { status, error: null },
    });
  }

  // 이미 끝난 자료는 그대로 알려주고 끝냅니다 — 화면의 반복 호출이 여기서 멈춥니다.
  if (status === "ready" || status === "failed") {
    return NextResponse.json({
      status,
      pageCount: document.pageCount,
      chunkCount: document.chunkCount,
      embeddedCount: document.embeddedCount,
      error: document.error,
    } satisfies Progress);
  }

  const fail = async (message: string) => {
    await prisma.assistantDocument.update({
      where: { id: docId },
      data: { status: "failed", error: message },
    });
    return NextResponse.json({
      status: "failed",
      pageCount: document.pageCount,
      chunkCount: document.chunkCount,
      embeddedCount: document.embeddedCount,
      error: message,
    } satisfies Progress);
  };

  let apiKey: string;
  try {
    apiKey = await requireApiKey(access.bot.schoolId);
  } catch (error) {
    return await fail(error instanceof Error ? error.message : "API 키를 확인할 수 없습니다.");
  }

  // ── 1단계: 텍스트 추출 + 조각 저장 ────────────────────────────────────────
  if (status === "pending") {
    try {
      const row = await prisma.assistantDocument.findUnique({
        where: { id: docId },
        select: { fileBytes: true },
      });
      if (!row) return await fail("자료 원본을 읽을 수 없습니다.");

      const extracted = await extractDocumentText(document.fileName, Buffer.from(row.fileBytes));
      const chunks = chunkPages(extracted.pages);
      if (chunks.length === 0) {
        return await fail("파일에서 검색할 내용을 만들지 못했습니다.");
      }

      await insertChunks(docId, document.botId, chunks);
      await prisma.assistantDocument.update({
        where: { id: docId },
        data: {
          status: "processing",
          pageCount: extracted.pageCount,
          chunkCount: chunks.length,
          embeddedCount: 0,
          error: null,
        },
      });

      return NextResponse.json({
        status: "processing",
        pageCount: extracted.pageCount,
        chunkCount: chunks.length,
        embeddedCount: 0,
        error: null,
      } satisfies Progress);
    } catch (error) {
      return await fail(error instanceof Error ? error.message : "자료를 분석하지 못했습니다.");
    }
  }

  // ── 2단계: 임베딩을 조금씩 채우기 ────────────────────────────────────────
  try {
    const batch = await pendingChunks(docId, INGEST_BATCH);

    if (batch.length === 0) {
      await prisma.assistantDocument.update({
        where: { id: docId },
        data: { status: "ready", embeddedCount: document.chunkCount, error: null },
      });
      return NextResponse.json({
        status: "ready",
        pageCount: document.pageCount,
        chunkCount: document.chunkCount,
        embeddedCount: document.chunkCount,
        error: null,
      } satisfies Progress);
    }

    const vectors = await embedDocuments(apiKey, batch.map((c) => c.content));
    await setEmbeddings(batch.map((chunk, i) => ({ id: chunk.id, embedding: vectors[i] })));

    const embeddedCount = Math.min(document.embeddedCount + batch.length, document.chunkCount);
    const done = embeddedCount >= document.chunkCount;
    await prisma.assistantDocument.update({
      where: { id: docId },
      data: { embeddedCount, status: done ? "ready" : "processing" },
    });

    return NextResponse.json({
      status: done ? "ready" : "processing",
      pageCount: document.pageCount,
      chunkCount: document.chunkCount,
      embeddedCount,
      error: null,
    } satisfies Progress);
  } catch (error) {
    // 속도 제한은 "실패"가 아닙니다. 상태를 processing 그대로 두고 잠깐 기다리라고만 알려주면,
    // 화면이 이어서 호출해 남은 조각부터 계속 채웁니다 — 이미 넣은 임베딩은 그대로 살아 있습니다.
    if (error instanceof RateLimitError) {
      return NextResponse.json({
        status: "processing",
        pageCount: document.pageCount,
        chunkCount: document.chunkCount,
        embeddedCount: document.embeddedCount,
        error: null,
        waitMs: error.retryAfterMs || 15000,
        notice: "Gemini 요청이 몰려 잠시 쉬는 중입니다. 곧 이어서 분석합니다.",
      } satisfies Progress);
    }
    return await fail(error instanceof Error ? error.message : "자료를 분석하지 못했습니다.");
  }
}
