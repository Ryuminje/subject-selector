-- CreateTable
CREATE TABLE "CertificateRosterExtra" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateRosterExtra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CertificateRosterExtra_schoolId_name_key" ON "CertificateRosterExtra"("schoolId", "name");

-- AddForeignKey
ALTER TABLE "CertificateRosterExtra" ADD CONSTRAINT "CertificateRosterExtra_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
