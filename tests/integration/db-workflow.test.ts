import ExcelJS from "exceljs";
import { AssessmentPhase, WorkshopStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { nationalIdLookupHash, phoneLookupHash, encryptField, decryptField } from "../../src/lib/security";
import { analyzeStaffWorkbook } from "../../src/lib/staff-import";
import { findTeacherCandidates } from "../../src/lib/teacher-auth";
import { finalizePostAssessment, finalizeWorkshopMeasurement } from "../../src/lib/workshop-service";
import { saveManagerAssessments } from "../../src/lib/manager-assessment-service";
import { registerManagerAccount } from "../../src/lib/registration-service";
import { db } from "../../src/lib/db";

process.env.ID_LOOKUP_SECRET ??= Buffer.from("integration-id-lookup-secret-32-bytes").toString("base64");
process.env.FIELD_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
process.env.AUTH_SECRET ??= Buffer.from("integration-auth-secret-32-bytes-long").toString("base64");

const enabled = Boolean(process.env.DATABASE_URL);
const describeDatabase = enabled ? describe : describe.skip;

describeDatabase("Athar database workflow integration", () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let userId = "";
  let schoolId = "";
  let otherSchoolId = "";
  let staffId = "";
  let workshopId = "";
  let participantId = "";
  let criterionId = "";

  beforeAll(async () => {
    process.env.ATHAR_E2E = "true";
    process.env.ATHAR_TEST_NOW = "2026-08-15T09:00:00.000Z";
    const registered = await registerManagerAccount({ email: `integration-${suffix}@example.test`, password: "Integration-password-123", createManagerSession: false });
    const user = registered.user;
    userId = user.id;
    const school = await db.school.create({ data: { name: `Integration School ${suffix}`, slug: `integration-${suffix}`, ministryCode: `I-${suffix.slice(-20)}`, educationAdministration: "Integration Admin", region: "Test Region", city: "Test City", educationStage: "PRIMARY", schoolType: "GOVERNMENT", genderType: "MIXED", principalName: "Integration Principal" } });
    schoolId = school.id;
    await db.schoolMembership.create({ data: { userId, schoolId, role: "SCHOOL_OWNER" } });
    const otherSchool = await db.school.create({ data: { name: `Other School ${suffix}`, slug: `other-${suffix}`, ministryCode: `O-${suffix.slice(-20)}`, educationAdministration: "Other Admin", region: "Other Region", city: "Other City", educationStage: "PRIMARY", schoolType: "GOVERNMENT", genderType: "MIXED", principalName: "Other Principal" } });
    otherSchoolId = otherSchool.id;
  });

  afterAll(async () => {
    if (schoolId) await db.school.delete({ where: { id: schoolId } }).catch(() => undefined);
    if (otherSchoolId) await db.school.delete({ where: { id: otherSchoolId } }).catch(() => undefined);
    if (userId) await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    delete process.env.ATHAR_E2E;
    delete process.env.ATHAR_TEST_NOW;
    await db.$disconnect();
  });

  it("registers/onboards a tenant and imports a real XLSX fixture", async () => {
    await db.auditLog.create({ data: { schoolId, userId, action: "SCHOOL_CREATED", entity: "School", entityId: schoolId, metadata: { setupStatus: "SETUP_REQUIRED" } } });
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Roster").addRows([["Name", "National ID", "Phone", "Job Title"], ["A Teacher", "1000000001", "0501234567", "Teacher"], ["B Teacher", "1000000002", "0501234567", "Teacher"]]);
    const bytes = await workbook.xlsx.writeBuffer();
    const analysis = await analyzeStaffWorkbook({ bytes, fileName: "integration-fixture.xlsx" });
    expect(analysis.validRows).toBe(2);
    expect(analysis.duplicatePhoneRows).toBe(1);
    const rows = analysis.rows.filter((row) => !row.errors.length);
    await db.$transaction(async (tx) => {
      for (const row of rows) await tx.staffMember.create({ data: { schoolId, fullName: row.fullName, nationalIdHash: row.nationalIdHash, nationalIdLast4: row.nationalIdLast4, phoneEncrypted: row.phone ? encryptField(row.phone) : null, phoneLookupHash: row.phone ? phoneLookupHash(row.phone) : null, phoneLast4: row.phoneLast4, source: "NOOR_IMPORT" } });
      await tx.school.update({ where: { id: schoolId }, data: { setupStatus: "ACTIVE" } });
    });
    const staff = await db.staffMember.findFirstOrThrow({ where: { schoolId, nationalIdHash: nationalIdLookupHash("1000000001") } });
    staffId = staff.id;
    expect(decryptField(staff.phoneEncrypted!)).toBe("0501234567");
    await expect(db.staffMember.create({ data: { schoolId, fullName: "Duplicate Identity", nationalIdHash: staff.nationalIdHash, nationalIdLast4: "0001", source: "NOOR_IMPORT" } })).rejects.toMatchObject({ code: "P2002" });
    const changedPhone = "0507654321";
    await db.staffMember.update({ where: { id: staffId }, data: { phoneEncrypted: encryptField(changedPhone), phoneLookupHash: phoneLookupHash(changedPhone), phoneLast4: changedPhone.slice(-4) } });
    expect(decryptField((await db.staffMember.findUniqueOrThrow({ where: { id: staffId } })).phoneEncrypted!)).toBe(changedPhone);
  });

  it("creates, finalizes, locks, time-transitions, and snapshots a workshop", async () => {
    const staff = await db.staffMember.findMany({ where: { schoolId }, take: 1 });
    staffId = staff[0].id;
    const workshop = await db.workshop.create({ data: { schoolId, title: "Integration Workshop", facilitator: "Facilitator", startsAt: new Date("2026-08-15T10:00:00Z"), endsAt: new Date("2026-08-15T12:00:00Z"), status: WorkshopStatus.DRAFT } });
    workshopId = workshop.id;
    const participant = await db.workshopParticipant.create({ data: { workshopId, staffId } });
    participantId = participant.id;
    const criterion = await db.workshopCriterion.create({ data: { workshopId, name: "Application", weight: 100, displayOrder: 0 } });
    criterionId = criterion.id;
    await db.managerAssessment.create({ data: { workshopId, participantId, criterionId, phase: AssessmentPhase.PRE, score: 5 } });

    const finalized = await Promise.allSettled([finalizeWorkshopMeasurement(schoolId, workshopId, userId), finalizeWorkshopMeasurement(schoolId, workshopId, userId)]);
    expect(finalized.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(finalized.filter((result) => result.status === "rejected")).toHaveLength(1);
    await expect(saveManagerAssessments({ schoolId, workshopId, phase: AssessmentPhase.PRE, items: [{ participantId, criterionId, score: 4 }] })).rejects.toThrow("ASSESSMENT_LOCKED");
    await db.managerAssessment.create({ data: { workshopId, participantId, criterionId, phase: AssessmentPhase.POST, score: 4 } });
    await expect(finalizePostAssessment(schoolId, workshopId, userId)).rejects.toThrow("WORKSHOP_NOT_READY");
    process.env.ATHAR_TEST_NOW = "2026-08-15T13:00:00.000Z";
    const report = await finalizePostAssessment(schoolId, workshopId, userId);
    expect(report.workshopId).toBe(workshopId);
    expect((await db.workshop.findUniqueOrThrow({ where: { id: workshopId } })).status).toBe(WorkshopStatus.COMPLETED);
    await expect(finalizePostAssessment(schoolId, workshopId, userId)).rejects.toThrow();
    expect((await db.reportSnapshot.findUniqueOrThrow({ where: { workshopId } })).immutable).toBe(true);
  });

  it("supports identity-based teacher lookup and proves tenant-scoped reads", async () => {
    const candidates = await findTeacherCandidates(nationalIdLookupHash("1000000001"));
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ id: staffId, schoolId });
    expect(await db.workshop.findFirst({ where: { id: workshopId, schoolId: otherSchoolId } })).toBeNull();
    expect(await db.reportSnapshot.findFirst({ where: { workshopId, schoolId: otherSchoolId } })).toBeNull();
    await db.staffMember.update({ where: { id: staffId }, data: { active: false } });
    expect((await db.workshopParticipant.findUniqueOrThrow({ where: { id: participantId } })).staffId).toBe(staffId);
  });
});
