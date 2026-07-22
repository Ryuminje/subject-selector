-- CreateTable
CREATE TABLE "TrainingTitle" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "registeredByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingTitle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingTitle_schoolId_registeredByName_idx" ON "TrainingTitle"("schoolId", "registeredByName");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingTitle_schoolId_title_key" ON "TrainingTitle"("schoolId", "title");

-- AddForeignKey
ALTER TABLE "TrainingTitle" ADD CONSTRAINT "TrainingTitle_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
