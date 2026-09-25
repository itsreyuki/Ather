CREATE TABLE "ProfessionalGrowthPlan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "schoolId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "periodLabel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "activatedAt" DATETIME,
  "completedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ProfessionalGrowthPlan_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ProfessionalGrowthPlanReportSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "schoolId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "immutable" BOOLEAN NOT NULL DEFAULT true,
  "snapshot" JSONB NOT NULL,
  CONSTRAINT "ProfessionalGrowthPlanReportSnapshot_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProfessionalGrowthPlanReportSnapshot_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ProfessionalGrowthPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "Workshop" ADD COLUMN "professionalGrowthPlanId" TEXT;
ALTER TABLE "Workshop" ADD COLUMN "facilitatorStaffId" TEXT;
ALTER TABLE "Workshop" ADD COLUMN "programType" TEXT;

CREATE UNIQUE INDEX "ProfessionalGrowthPlanReportSnapshot_planId_key" ON "ProfessionalGrowthPlanReportSnapshot"("planId");
CREATE INDEX "ProfessionalGrowthPlan_schoolId_status_updatedAt_idx" ON "ProfessionalGrowthPlan"("schoolId", "status", "updatedAt");
CREATE INDEX "ProfessionalGrowthPlanReportSnapshot_schoolId_generatedAt_idx" ON "ProfessionalGrowthPlanReportSnapshot"("schoolId", "generatedAt");
CREATE INDEX "Workshop_professionalGrowthPlanId_status_idx" ON "Workshop"("professionalGrowthPlanId", "status");
CREATE INDEX "Workshop_facilitatorStaffId_idx" ON "Workshop"("facilitatorStaffId");
