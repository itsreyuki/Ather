-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SCHOOL_OWNER', 'SCHOOL_ADMIN');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "WorkshopStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'POST_ASSESSMENT_AVAILABLE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssessmentPhase" AS ENUM ('PRE', 'POST');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('TEACHER_LOGIN');

-- CreateEnum
CREATE TYPE "SchoolType" AS ENUM ('GOVERNMENT', 'PRIVATE', 'OTHER');

-- CreateEnum
CREATE TYPE "SchoolGender" AS ENUM ('BOYS', 'GIRLS', 'MIXED', 'OTHER');

-- CreateEnum
CREATE TYPE "SchoolSetupStatus" AS ENUM ('SETUP_REQUIRED', 'ACTIVE');

-- CreateEnum
CREATE TYPE "AuthChallengePurpose" AS ENUM ('EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "StaffSource" AS ENUM ('NOOR_IMPORT', 'MANUAL');

-- CreateEnum
CREATE TYPE "StaffImportStatus" AS ENUM ('PREVIEWED', 'COMMITTED', 'FAILED');

-- CreateEnum
CREATE TYPE "WorkshopDeliveryMode" AS ENUM ('IN_PERSON', 'REMOTE', 'HYBRID');

-- CreateEnum
CREATE TYPE "FollowUpMeasurementStatus" AS ENUM ('PLANNED', 'OPEN', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TeamInvitationChannel" AS ENUM ('EMAIL', 'PHONE');

-- CreateEnum
CREATE TYPE "PiiRetentionMode" AS ENUM ('REVIEW_REQUIRED', 'REDACT_ON_APPROVAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phoneEncrypted" TEXT,
    "phoneLookupHash" TEXT,
    "phoneLast4" TEXT,
    "passwordHash" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ministryCode" TEXT NOT NULL,
    "educationAdministration" TEXT NOT NULL,
    "educationOffice" TEXT,
    "region" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "educationStage" TEXT NOT NULL,
    "schoolType" "SchoolType" NOT NULL,
    "genderType" "SchoolGender" NOT NULL,
    "principalName" TEXT NOT NULL,
    "officialPhoneEncrypted" TEXT,
    "setupStatus" "SchoolSetupStatus" NOT NULL DEFAULT 'SETUP_REQUIRED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamInvitation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "channel" "TeamInvitationChannel" NOT NULL,
    "targetHash" TEXT NOT NULL,
    "targetEncrypted" TEXT NOT NULL,
    "targetLast4" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'SCHOOL_ADMIN',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolPrivacySettings" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "auditRetentionDays" INTEGER NOT NULL DEFAULT 2555,
    "disabledStaffRetentionDays" INTEGER NOT NULL DEFAULT 2555,
    "piiRetentionMode" "PiiRetentionMode" NOT NULL DEFAULT 'REVIEW_REQUIRED',
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolPrivacySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "nationalIdHash" TEXT NOT NULL,
    "nationalIdLast4" TEXT,
    "phoneEncrypted" TEXT,
    "phoneLookupHash" TEXT,
    "phoneLast4" TEXT,
    "fullName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "specialization" TEXT,
    "email" TEXT,
    "employeeNumber" TEXT,
    "source" "StaffSource" NOT NULL DEFAULT 'NOOR_IMPORT',
    "manualOverrideFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffImportBatch" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "source" "StaffSource" NOT NULL DEFAULT 'NOOR_IMPORT',
    "status" "StaffImportStatus" NOT NULL DEFAULT 'PREVIEWED',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "missingCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "diff" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workshop" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "facilitator" TEXT,
    "location" TEXT,
    "providerOrganization" TEXT,
    "workshopType" TEXT,
    "category" TEXT,
    "deliveryMode" "WorkshopDeliveryMode" NOT NULL DEFAULT 'IN_PERSON',
    "locationOrUrl" TEXT,
    "objectives" TEXT,
    "notes" TEXT,
    "templateId" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "status" "WorkshopStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "postAssessmentSubmittedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "draftStep" INTEGER NOT NULL DEFAULT 0,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workshop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopParticipant" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopCriterion" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "guidance" TEXT,
    "managerPrompt" TEXT,
    "participantPrompt" TEXT,
    "weight" DOUBLE PRECISION NOT NULL,
    "targetValue" DOUBLE PRECISION,
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "WorkshopCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerAssessment" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "phase" "AssessmentPhase" NOT NULL,
    "score" INTEGER NOT NULL,
    "notes" TEXT,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagerAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherWorkshopEvaluation" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "rating" INTEGER,
    "contentQuality" INTEGER,
    "needFit" INTEGER,
    "deliveryQuality" INTEGER,
    "applicability" INTEGER,
    "comment" TEXT,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherWorkshopEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherCriterionEvaluation" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherCriterionEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OTPChallenge" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "candidateStaffIds" JSONB,
    "purpose" "OtpPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "consumedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "selectedSchoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OTPChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "AuthChallengePurpose" NOT NULL,
    "targetHash" TEXT NOT NULL,
    "codeHash" TEXT,
    "tokenHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "entityId" TEXT,
    "dedupeKey" TEXT,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriterionTemplate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL DEFAULT 'قالب مخصص',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "guidance" TEXT,
    "defaultWeight" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CriterionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopTemplate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workshopType" TEXT,
    "description" TEXT,
    "objectives" TEXT,
    "category" TEXT,
    "deliveryMode" "WorkshopDeliveryMode" NOT NULL DEFAULT 'IN_PERSON',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopTemplateCriterion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "guidance" TEXT,
    "weight" DOUBLE PRECISION NOT NULL,
    "targetValue" DOUBLE PRECISION,
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "WorkshopTemplateCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpMeasurement" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "offsetDays" INTEGER NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "FollowUpMeasurementStatus" NOT NULL DEFAULT 'PLANNED',
    "openedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUpMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpAssessment" (
    "id" TEXT NOT NULL,
    "followUpMeasurementId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSnapshot" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "engineVersion" TEXT NOT NULL,
    "immutable" BOOLEAN NOT NULL DEFAULT true,
    "snapshot" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,

    CONSTRAINT "ReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneLookupHash_key" ON "User"("phoneLookupHash");

-- CreateIndex
CREATE UNIQUE INDEX "School_slug_key" ON "School"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "School_ministryCode_key" ON "School"("ministryCode");

-- CreateIndex
CREATE INDEX "SchoolMembership_schoolId_status_idx" ON "SchoolMembership"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolMembership_userId_schoolId_key" ON "SchoolMembership"("userId", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamInvitation_tokenHash_key" ON "TeamInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "TeamInvitation_schoolId_expiresAt_acceptedAt_revokedAt_idx" ON "TeamInvitation"("schoolId", "expiresAt", "acceptedAt", "revokedAt");

-- CreateIndex
CREATE INDEX "TeamInvitation_schoolId_targetHash_createdAt_idx" ON "TeamInvitation"("schoolId", "targetHash", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolPrivacySettings_schoolId_key" ON "SchoolPrivacySettings"("schoolId");

-- CreateIndex
CREATE INDEX "StaffMember_schoolId_active_idx" ON "StaffMember"("schoolId", "active");

-- CreateIndex
CREATE INDEX "StaffMember_schoolId_phoneLookupHash_idx" ON "StaffMember"("schoolId", "phoneLookupHash");

-- CreateIndex
CREATE INDEX "StaffMember_phoneLookupHash_idx" ON "StaffMember"("phoneLookupHash");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_schoolId_nationalIdHash_key" ON "StaffMember"("schoolId", "nationalIdHash");

-- CreateIndex
CREATE INDEX "StaffImportBatch_schoolId_createdAt_idx" ON "StaffImportBatch"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffImportBatch_schoolId_status_createdAt_idx" ON "StaffImportBatch"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Workshop_schoolId_status_startsAt_idx" ON "Workshop"("schoolId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "Workshop_schoolId_status_endsAt_idx" ON "Workshop"("schoolId", "status", "endsAt");

-- CreateIndex
CREATE INDEX "WorkshopParticipant_staffId_joinedAt_idx" ON "WorkshopParticipant"("staffId", "joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopParticipant_workshopId_staffId_key" ON "WorkshopParticipant"("workshopId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopCriterion_workshopId_displayOrder_key" ON "WorkshopCriterion"("workshopId", "displayOrder");

-- CreateIndex
CREATE INDEX "ManagerAssessment_workshopId_phase_status_idx" ON "ManagerAssessment"("workshopId", "phase", "status");

-- CreateIndex
CREATE INDEX "ManagerAssessment_participantId_phase_status_idx" ON "ManagerAssessment"("participantId", "phase", "status");

-- CreateIndex
CREATE INDEX "ManagerAssessment_criterionId_phase_status_idx" ON "ManagerAssessment"("criterionId", "phase", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerAssessment_participantId_criterionId_phase_key" ON "ManagerAssessment"("participantId", "criterionId", "phase");

-- CreateIndex
CREATE INDEX "TeacherWorkshopEvaluation_workshopId_status_submittedAt_idx" ON "TeacherWorkshopEvaluation"("workshopId", "status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherWorkshopEvaluation_workshopId_staffId_key" ON "TeacherWorkshopEvaluation"("workshopId", "staffId");

-- CreateIndex
CREATE INDEX "TeacherCriterionEvaluation_criterionId_rating_idx" ON "TeacherCriterionEvaluation"("criterionId", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherCriterionEvaluation_evaluationId_criterionId_key" ON "TeacherCriterionEvaluation"("evaluationId", "criterionId");

-- CreateIndex
CREATE INDEX "OTPChallenge_staffId_purpose_expiresAt_idx" ON "OTPChallenge"("staffId", "purpose", "expiresAt");

-- CreateIndex
CREATE INDEX "OTPChallenge_purpose_expiresAt_consumedAt_idx" ON "OTPChallenge"("purpose", "expiresAt", "consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherSession_tokenHash_key" ON "TeacherSession"("tokenHash");

-- CreateIndex
CREATE INDEX "TeacherSession_staffId_schoolId_expiresAt_revokedAt_idx" ON "TeacherSession"("staffId", "schoolId", "expiresAt", "revokedAt");

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_createdAt_idx" ON "AuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_action_createdAt_idx" ON "AuditLog"("schoolId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_entity_entityId_createdAt_idx" ON "AuditLog"("schoolId", "entity", "entityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_revokedAt_idx" ON "Session"("userId", "expiresAt", "revokedAt");

-- CreateIndex
CREATE INDEX "AuthChallenge_userId_purpose_expiresAt_idx" ON "AuthChallenge"("userId", "purpose", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthChallenge_targetHash_purpose_expiresAt_idx" ON "AuthChallenge"("targetHash", "purpose", "expiresAt");

-- CreateIndex
CREATE INDEX "Notification_schoolId_readAt_createdAt_idx" ON "Notification"("schoolId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_schoolId_type_createdAt_idx" ON "Notification"("schoolId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_schoolId_dedupeKey_key" ON "Notification"("schoolId", "dedupeKey");

-- CreateIndex
CREATE INDEX "CriterionTemplate_schoolId_templateName_createdAt_idx" ON "CriterionTemplate"("schoolId", "templateName", "createdAt");

-- CreateIndex
CREATE INDEX "WorkshopTemplate_schoolId_updatedAt_idx" ON "WorkshopTemplate"("schoolId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopTemplateCriterion_templateId_displayOrder_key" ON "WorkshopTemplateCriterion"("templateId", "displayOrder");

-- CreateIndex
CREATE INDEX "FollowUpMeasurement_schoolId_status_dueAt_idx" ON "FollowUpMeasurement"("schoolId", "status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "FollowUpMeasurement_workshopId_offsetDays_key" ON "FollowUpMeasurement"("workshopId", "offsetDays");

-- CreateIndex
CREATE INDEX "FollowUpAssessment_followUpMeasurementId_criterionId_idx" ON "FollowUpAssessment"("followUpMeasurementId", "criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "FollowUpAssessment_followUpMeasurementId_participantId_crit_key" ON "FollowUpAssessment"("followUpMeasurementId", "participantId", "criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportSnapshot_workshopId_key" ON "ReportSnapshot"("workshopId");

-- CreateIndex
CREATE INDEX "ReportSnapshot_schoolId_generatedAt_idx" ON "ReportSnapshot"("schoolId", "generatedAt");

-- AddForeignKey
ALTER TABLE "SchoolMembership" ADD CONSTRAINT "SchoolMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolMembership" ADD CONSTRAINT "SchoolMembership_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolPrivacySettings" ADD CONSTRAINT "SchoolPrivacySettings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolPrivacySettings" ADD CONSTRAINT "SchoolPrivacySettings_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffImportBatch" ADD CONSTRAINT "StaffImportBatch_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workshop" ADD CONSTRAINT "Workshop_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workshop" ADD CONSTRAINT "Workshop_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkshopTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopParticipant" ADD CONSTRAINT "WorkshopParticipant_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopParticipant" ADD CONSTRAINT "WorkshopParticipant_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopCriterion" ADD CONSTRAINT "WorkshopCriterion_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerAssessment" ADD CONSTRAINT "ManagerAssessment_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerAssessment" ADD CONSTRAINT "ManagerAssessment_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "WorkshopParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerAssessment" ADD CONSTRAINT "ManagerAssessment_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "WorkshopCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherWorkshopEvaluation" ADD CONSTRAINT "TeacherWorkshopEvaluation_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherWorkshopEvaluation" ADD CONSTRAINT "TeacherWorkshopEvaluation_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherCriterionEvaluation" ADD CONSTRAINT "TeacherCriterionEvaluation_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "TeacherWorkshopEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherCriterionEvaluation" ADD CONSTRAINT "TeacherCriterionEvaluation_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "WorkshopCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OTPChallenge" ADD CONSTRAINT "OTPChallenge_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSession" ADD CONSTRAINT "TeacherSession_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSession" ADD CONSTRAINT "TeacherSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthChallenge" ADD CONSTRAINT "AuthChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterionTemplate" ADD CONSTRAINT "CriterionTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopTemplate" ADD CONSTRAINT "WorkshopTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopTemplateCriterion" ADD CONSTRAINT "WorkshopTemplateCriterion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkshopTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpMeasurement" ADD CONSTRAINT "FollowUpMeasurement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpMeasurement" ADD CONSTRAINT "FollowUpMeasurement_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpAssessment" ADD CONSTRAINT "FollowUpAssessment_followUpMeasurementId_fkey" FOREIGN KEY ("followUpMeasurementId") REFERENCES "FollowUpMeasurement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpAssessment" ADD CONSTRAINT "FollowUpAssessment_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "WorkshopParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpAssessment" ADD CONSTRAINT "FollowUpAssessment_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "WorkshopCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSnapshot" ADD CONSTRAINT "ReportSnapshot_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSnapshot" ADD CONSTRAINT "ReportSnapshot_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
