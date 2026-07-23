-- AlterTable
ALTER TABLE "user" ADD COLUMN     "loginId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_schoolId_loginId_key" ON "user"("schoolId", "loginId");
