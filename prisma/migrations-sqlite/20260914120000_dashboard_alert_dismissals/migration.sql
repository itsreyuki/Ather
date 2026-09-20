-- CreateTable
CREATE TABLE "DashboardAlertDismissal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "alertKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "dismissedByUserId" TEXT,
    "dismissedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DashboardAlertDismissal_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DashboardAlertDismissal_dismissedByUserId_fkey" FOREIGN KEY ("dismissedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DashboardAlertDismissal_schoolId_alertKey_fingerprint_key" ON "DashboardAlertDismissal"("schoolId", "alertKey", "fingerprint");

-- CreateIndex
CREATE INDEX "DashboardAlertDismissal_schoolId_dismissedAt_idx" ON "DashboardAlertDismissal"("schoolId", "dismissedAt");
