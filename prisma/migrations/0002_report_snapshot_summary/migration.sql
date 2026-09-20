ALTER TABLE "ReportSnapshot"
  ADD COLUMN "participantCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "overallScaleImprovement" DOUBLE PRECISION,
  ADD COLUMN "impactScore" DOUBLE PRECISION,
  ADD COLUMN "teacherResponseRate" DOUBLE PRECISION;
