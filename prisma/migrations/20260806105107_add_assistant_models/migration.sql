-- 업무 AI 파트너의 자료 검색은 pgvector에 의존합니다. 새 환경에 배포할 때 확장이 먼저
-- 깔려 있지 않으면 아래 vector(768) 컬럼 생성이 실패하므로 여기서 함께 보장합니다.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "AssistantBot" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "emoji" TEXT NOT NULL DEFAULT '🤖',
    "accent" TEXT NOT NULL DEFAULT 'amber',
    "persona" TEXT,
    "starters" TEXT NOT NULL DEFAULT '[]',
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantBot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantDocument" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "fileBytes" BYTEA NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "pageCount" INTEGER,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "embeddedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "page" INTEGER,
    "content" TEXT NOT NULL,
    "embedding" vector(768),

    CONSTRAINT "AssistantChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantThread" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '새 대화',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "citations" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantBot_schoolId_ownerUserId_idx" ON "AssistantBot"("schoolId", "ownerUserId");

-- CreateIndex
CREATE INDEX "AssistantDocument_botId_idx" ON "AssistantDocument"("botId");

-- CreateIndex
CREATE INDEX "AssistantChunk_botId_idx" ON "AssistantChunk"("botId");

-- CreateIndex
CREATE INDEX "AssistantChunk_documentId_idx" ON "AssistantChunk"("documentId");

-- CreateIndex
CREATE INDEX "AssistantThread_botId_userId_updatedAt_idx" ON "AssistantThread"("botId", "userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AssistantMessage_threadId_createdAt_idx" ON "AssistantMessage"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "AssistantBot" ADD CONSTRAINT "AssistantBot_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantDocument" ADD CONSTRAINT "AssistantDocument_botId_fkey" FOREIGN KEY ("botId") REFERENCES "AssistantBot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantChunk" ADD CONSTRAINT "AssistantChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AssistantDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantThread" ADD CONSTRAINT "AssistantThread_botId_fkey" FOREIGN KEY ("botId") REFERENCES "AssistantBot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AssistantThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 유사도 검색용 근사 최근접 인덱스. Prisma는 vector 인덱스를 스키마로 표현하지 못해
-- 여기서 직접 만듭니다 — 스키마를 다시 만들 일이 있으면 이 줄을 빠뜨리지 마세요.
-- 코사인 거리(<=>)로 검색하므로 vector_cosine_ops를 씁니다 (search.ts의 ORDER BY와 짝).
CREATE INDEX "AssistantChunk_embedding_idx" ON "AssistantChunk" USING hnsw ("embedding" vector_cosine_ops);
