CREATE TABLE "LicenseCode" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "codeHash" TEXT NOT NULL,
  "codeLast4" TEXT NOT NULL,
  "label" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "redeemedAt" DATETIME,
  "redeemedUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "LicenseCode_redeemedUserId_fkey" FOREIGN KEY ("redeemedUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "LicenseCode_codeHash_key" ON "LicenseCode"("codeHash");
CREATE INDEX "LicenseCode_status_createdAt_idx" ON "LicenseCode"("status", "createdAt");
CREATE INDEX "LicenseCode_redeemedUserId_redeemedAt_idx" ON "LicenseCode"("redeemedUserId", "redeemedAt");
