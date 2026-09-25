-- Preserve the distinct Noor roster format and its administrative fields.
ALTER TABLE "StaffMember" ADD COLUMN "importFormat" TEXT;
ALTER TABLE "StaffMember" ADD COLUMN "educationAdministration" TEXT;
ALTER TABLE "StaffMember" ADD COLUMN "sourceSchoolName" TEXT;

CREATE INDEX "StaffMember_schoolId_importFormat_idx"
ON "StaffMember"("schoolId", "importFormat");
