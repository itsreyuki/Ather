-- Keep the latest Noor source visible without retaining the raw upload.
ALTER TABLE "StaffMember" ADD COLUMN "importSourceName" TEXT;
ALTER TABLE "StaffMember" ADD COLUMN "importSourceFileName" TEXT;
ALTER TABLE "StaffMember" ADD COLUMN "importReviewFlags" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "StaffMember" ADD COLUMN "importReviewRequired" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "StaffMember_schoolId_importSourceName_idx"
ON "StaffMember"("schoolId", "importSourceName");

CREATE INDEX "StaffMember_schoolId_active_importReviewRequired_idx"
ON "StaffMember"("schoolId", "active", "importReviewRequired");
