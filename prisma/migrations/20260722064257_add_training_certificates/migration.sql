-- AlterTable
ALTER TABLE "School" ADD COLUMN     "geminiApiKey" TEXT;

-- CreateTable
CREATE TABLE "TrainingCertificate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherName" TEXT NOT NULL,
    "trainingTitle" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "certDate" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileBytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignSession" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "trainingTitles" TEXT NOT NULL,
    "rosterSnapshot" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "SignSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignSessionSignature" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "teacherName" TEXT NOT NULL,
    "trainingTitle" TEXT NOT NULL,
    "signaturePng" BYTEA NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignSessionSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingCertificate_schoolId_teacherName_idx" ON "TrainingCertificate"("schoolId", "teacherName");

-- CreateIndex
CREATE INDEX "TrainingCertificate_schoolId_trainingTitle_idx" ON "TrainingCertificate"("schoolId", "trainingTitle");

-- CreateIndex
CREATE INDEX "SignSession_schoolId_createdAt_idx" ON "SignSession"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "SignSessionSignature_sessionId_idx" ON "SignSessionSignature"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SignSessionSignature_sessionId_teacherName_trainingTitle_key" ON "SignSessionSignature"("sessionId", "teacherName", "trainingTitle");

-- AddForeignKey
ALTER TABLE "TrainingCertificate" ADD CONSTRAINT "TrainingCertificate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignSession" ADD CONSTRAINT "SignSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignSessionSignature" ADD CONSTRAINT "SignSessionSignature_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SignSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
