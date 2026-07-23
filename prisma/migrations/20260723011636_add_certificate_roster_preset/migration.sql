-- AlterTable
ALTER TABLE "SignSession" ADD COLUMN     "rosterPresetName" TEXT;

-- CreateTable
CREATE TABLE "CertificateRosterPreset" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "names" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateRosterPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CertificateRosterPreset_schoolId_updatedAt_idx" ON "CertificateRosterPreset"("schoolId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateRosterPreset_schoolId_name_key" ON "CertificateRosterPreset"("schoolId", "name");

-- AddForeignKey
ALTER TABLE "CertificateRosterPreset" ADD CONSTRAINT "CertificateRosterPreset_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
