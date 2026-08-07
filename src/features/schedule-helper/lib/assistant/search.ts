// pgvector를 만지는 유일한 파일.
//
// Prisma는 vector 타입을 직접 다루지 못해 스키마에서 Unsupported로 선언했고, 넣고 빼는 일은
// 전부 여기 raw SQL이 담당합니다. 검색 방식을 바꾸게 되면(예: 다른 벡터 DB) 이 파일만 갈아끼우면
// 되도록 나머지 코드는 아래 세 함수 밖을 모릅니다.
//
// DB가 NAS(한국)에 있고 앱은 Vercel(미국)에서 도는 구조라 왕복 횟수가 곧 응답 시간입니다.
// 그래서 조각을 하나씩 넣지 않고 항상 한 문장에 여러 행을 몰아 처리합니다.

import { prisma } from "@/lib/prisma";
import { TOP_K } from "./config";
import type { Chunk } from "./chunk";

/** number[] → pgvector 리터럴. 파라미터로 넘긴 뒤 SQL에서 ::vector로 캐스팅합니다. */
function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

/** 한 문장에 넣을 최대 행 수 — 파라미터 개수와 요청 크기를 적당히 유지합니다. */
const INSERT_ROWS = 200;

/**
 * 조각을 embedding 없이 먼저 저장합니다. 임베딩은 /ingest가 여러 번 나눠 채웁니다.
 * id는 Prisma를 거치지 않으므로 DB의 gen_random_uuid()로 만듭니다(내부 식별자라 형식은 무관).
 */
export async function insertChunks(documentId: string, botId: string, chunks: Chunk[]): Promise<void> {
  for (let i = 0; i < chunks.length; i += INSERT_ROWS) {
    const slice = chunks.slice(i, i + INSERT_ROWS);
    const params: unknown[] = [];
    const rows = slice.map((chunk) => {
      const base = params.length;
      params.push(documentId, botId, chunk.ordinal, chunk.page, chunk.content);
      return `(gen_random_uuid()::text, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
    });

    await prisma.$executeRawUnsafe(
      `INSERT INTO "AssistantChunk" (id, "documentId", "botId", ordinal, page, content)
       VALUES ${rows.join(", ")}`,
      ...params
    );
  }
}

/** 아직 임베딩이 없는 조각을 순서대로 가져옵니다 (/ingest가 이어서 처리할 대상). */
export async function pendingChunks(
  documentId: string,
  limit: number
): Promise<{ id: string; content: string }[]> {
  return prisma.$queryRawUnsafe<{ id: string; content: string }[]>(
    `SELECT id, content
       FROM "AssistantChunk"
      WHERE "documentId" = $1 AND embedding IS NULL
      ORDER BY ordinal
      LIMIT $2`,
    documentId,
    limit
  );
}

/** 임베딩 여러 개를 한 문장으로 채웁니다. */
export async function setEmbeddings(entries: { id: string; embedding: number[] }[]): Promise<void> {
  if (entries.length === 0) return;

  const params: unknown[] = [];
  const values = entries.map((entry) => {
    const base = params.length;
    params.push(entry.id, toVectorLiteral(entry.embedding));
    return `($${base + 1}::text, $${base + 2}::text)`;
  });

  await prisma.$executeRawUnsafe(
    `UPDATE "AssistantChunk" AS c
        SET embedding = v.emb::vector
       FROM (VALUES ${values.join(", ")}) AS v(id, emb)
      WHERE c.id = v.id`,
    ...params
  );
}

export interface SearchHit {
  chunkId: string;
  documentId: string;
  fileName: string;
  page: number | null;
  content: string;
  similarity: number;
}

/**
 * 질문 벡터와 가장 가까운 조각을 찾습니다. 챗봇 하나의 자료만 대상이며,
 * 이 경계가 "예산 자료가 학적 질문에 섞이지 않는다"는 약속을 실제로 지키는 지점입니다.
 */
export async function searchChunks(botId: string, queryEmbedding: number[], limit = TOP_K): Promise<SearchHit[]> {
  const rows = await prisma.$queryRawUnsafe<
    { chunkId: string; documentId: string; fileName: string; page: number | null; content: string; similarity: number }[]
  >(
    `SELECT c.id            AS "chunkId",
            c."documentId"  AS "documentId",
            d."fileName"    AS "fileName",
            c.page          AS page,
            c.content       AS content,
            1 - (c.embedding <=> $1::vector) AS similarity
       FROM "AssistantChunk" c
       JOIN "AssistantDocument" d ON d.id = c."documentId"
      WHERE c."botId" = $2 AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> $1::vector
      LIMIT $3`,
    toVectorLiteral(queryEmbedding),
    botId,
    limit
  );

  return rows;
}
