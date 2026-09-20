-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "phoneEncrypted" TEXT,
    "phoneLookupHash" TEXT,
    "phoneLast4" TEXT,
    "passwordHash" TEXT,
    "emailVerifiedAt" DATETIME,
    "phoneVerifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ministryCode" TEXT NOT NULL,
    "educationAdministration" TEXT NOT NULL,
    "educationOffice" TEXT,
    "region" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "educationStage" TEXT NOT NULL,
    "schoolType" TEXT NOT NULL,
    "genderType" TEXT NOT NULL,
    "principalName" TEXT NOT NULL,
    "officialPhoneEncrypted" TEXT,
    "setupStatus" TEXT NOT NULL DEFAULT 'SETUP_REQUIRED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SchoolMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SchoolMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SchoolMembership_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamInvitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "targetHash" TEXT NOT NULL,
    "targetEncrypted" TEXT NOT NULL,
    "targetLast4" TEXT,
    "role" TEXT NOT NULL DEFAULT 'SCHOOL_ADMIN',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "acceptedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamInvitation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SchoolPrivacySettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "auditRetentionDays" INTEGER NOT NULL DEFAULT 2555,
    "disabledStaffRetentionDays" INTEGER NOT NULL DEFAULT 2555,
    "piiRetentionMode" TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED',
    "updatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchoolPrivacySettings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SchoolPrivacySettings_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "source" TEXT NOT NULL DEFAULT 'NOOR_IMPORT',
    "manualOverrideFields" JSONB NOT NULL DEFAULT [],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffMember_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'NOOR_IMPORT',
    "status" TEXT NOT NULL DEFAULT 'PREVIEWED',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "missingCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "diff" JSONB,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffImportBatch_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Workshop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "facilitator" TEXT,
    "location" TEXT,
    "providerOrganization" TEXT,
    "workshopType" TEXT,
    "category" TEXT,
    "deliveryMode" TEXT NOT NULL DEFAULT 'IN_PERSON',
    "locationOrUrl" TEXT,
    "objectives" TEXT,
    "notes" TEXT,
    "templateId" TEXT,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedAt" DATETIME,
    "completedAt" DATETIME,
    "finalizedAt" DATETIME,
    "postAssessmentSubmittedAt" DATETIME,
    "cancelledAt" DATETIME,
    "draftStep" INTEGER NOT NULL DEFAULT 0,
    "cancellationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Workshop_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Workshop_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkshopTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkshopParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workshopId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkshopParticipant_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkshopParticipant_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkshopCriterion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workshopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "guidance" TEXT,
    "managerPrompt" TEXT,
    "participantPrompt" TEXT,
    "weight" REAL NOT NULL,
    "targetValue" REAL,
    "displayOrder" INTEGER NOT NULL,
    CONSTRAINT "WorkshopCriterion_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManagerAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workshopId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ManagerAssessment_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ManagerAssessment_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "WorkshopParticipant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ManagerAssessment_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "WorkshopCriterion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeacherWorkshopEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workshopId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "rating" INTEGER,
    "contentQuality" INTEGER,
    "needFit" INTEGER,
    "deliveryQuality" INTEGER,
    "applicability" INTEGER,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeacherWorkshopEvaluation_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeacherWorkshopEvaluation_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeacherCriterionEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evaluationId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "rating" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeacherCriterionEvaluation_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "TeacherWorkshopEvaluation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeacherCriterionEvaluation_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "WorkshopCriterion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OTPChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "candidateStaffIds" JSONB,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "lastSentAt" DATETIME,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "consumedAt" DATETIME,
    "verifiedAt" DATETIME,
    "selectedSchoolId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OTPChallenge_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeacherSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherSession_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeacherSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuthChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "targetHash" TEXT NOT NULL,
    "codeHash" TEXT,
    "tokenHash" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "entityId" TEXT,
    "dedupeKey" TEXT,
    "metadata" JSONB,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CriterionTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL DEFAULT 'قالب مخصص',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "guidance" TEXT,
    "defaultWeight" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CriterionTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkshopTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workshopType" TEXT,
    "description" TEXT,
    "objectives" TEXT,
    "category" TEXT,
    "deliveryMode" TEXT NOT NULL DEFAULT 'IN_PERSON',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkshopTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkshopTemplateCriterion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "guidance" TEXT,
    "weight" REAL NOT NULL,
    "targetValue" REAL,
    "displayOrder" INTEGER NOT NULL,
    CONSTRAINT "WorkshopTemplateCriterion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkshopTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FollowUpMeasurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "offsetDays" INTEGER NOT NULL,
    "dueAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "openedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FollowUpMeasurement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FollowUpMeasurement_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FollowUpAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "followUpMeasurementId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FollowUpAssessment_followUpMeasurementId_fkey" FOREIGN KEY ("followUpMeasurementId") REFERENCES "FollowUpMeasurement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FollowUpAssessment_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "WorkshopParticipant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FollowUpAssessment_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "WorkshopCriterion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReportSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "engineVersion" TEXT NOT NULL,
    "immutable" BOOLEAN NOT NULL DEFAULT true,
    "participantCount" INTEGER NOT NULL DEFAULT 0,
    "overallScaleImprovement" REAL,
    "impactScore" REAL,
    "teacherResponseRate" REAL,
    "snapshot" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,
    CONSTRAINT "ReportSnapshot_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReportSnapshot_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
CREATE UNIQUE INDEX "FollowUpAssessment_followUpMeasurementId_participantId_criterionId_key" ON "FollowUpAssessment"("followUpMeasurementId", "participantId", "criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportSnapshot_workshopId_key" ON "ReportSnapshot"("workshopId");

-- CreateIndex
CREATE INDEX "ReportSnapshot_schoolId_generatedAt_idx" ON "ReportSnapshot"("schoolId", "generatedAt");
