-- CreateTable
CREATE TABLE "AdmissionGuideline" (
    "id" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "campus" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "admissionYear" INTEGER NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT '미확인',
    "data" JSONB NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionGuideline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionGuideline_admissionYear_shortName_campus_kind_key" ON "AdmissionGuideline"("admissionYear", "shortName", "campus", "kind");
