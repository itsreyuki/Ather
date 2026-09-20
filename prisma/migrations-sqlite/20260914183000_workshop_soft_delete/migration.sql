-- Preserve workshop history while removing it from operational views.
ALTER TABLE "Workshop" ADD COLUMN "deletedAt" DATETIME;

CREATE INDEX "Workshop_schoolId_deletedAt_updatedAt_idx"
ON "Workshop"("schoolId", "deletedAt", "updatedAt");
