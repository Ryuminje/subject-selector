-- 이름 붙여 저장하는 교체·보강 작업 세트(수업교체 도우미 트레이의 서버판, 계정별 전용).

-- CreateTable
CREATE TABLE "MakeupBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entries" TEXT NOT NULL,
    "baseDate" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MakeupBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MakeupBatch_userId_updatedAt_idx" ON "MakeupBatch"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MakeupBatch_userId_name_key" ON "MakeupBatch"("userId", "name");

-- AddForeignKey
ALTER TABLE "MakeupBatch" ADD CONSTRAINT "MakeupBatch_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
