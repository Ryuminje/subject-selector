-- DropIndex
DROP INDEX "SignSessionSignature_sessionId_teacherName_trainingTitle_key";

-- AlterTable
ALTER TABLE "SignSessionSignature" DROP COLUMN "trainingTitle";

-- CreateIndex
CREATE UNIQUE INDEX "SignSessionSignature_sessionId_teacherName_key" ON "SignSessionSignature"("sessionId", "teacherName");
