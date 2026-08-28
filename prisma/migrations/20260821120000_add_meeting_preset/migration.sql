-- 협의회 시간 찾기의 계정별 교사 프리셋.
--
-- ⚠️ `prisma migrate diff`가 만들어 준 SQL에는 `DROP INDEX "AssistantChunk_embedding_idx"`가
-- 섞여 나옵니다. 그 HNSW 인덱스는 Prisma 스키마로 표현할 수 없어 손으로 넣은 것이라
-- Prisma가 "없어야 할 인덱스"로 오해하는 것입니다. 지우면 AI 파트너의 자료 검색이 느려지므로
-- 여기서는 일부러 뺐습니다. 앞으로 마이그레이션을 만들 때도 그 줄은 항상 지우고 쓰세요.

-- CreateTable
CREATE TABLE "MeetingPreset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teachers" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingPreset_userId_updatedAt_idx" ON "MeetingPreset"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingPreset_userId_name_key" ON "MeetingPreset"("userId", "name");

-- AddForeignKey
ALTER TABLE "MeetingPreset" ADD CONSTRAINT "MeetingPreset_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
