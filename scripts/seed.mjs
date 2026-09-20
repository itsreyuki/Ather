import { readFileSync } from "node:fs";
import { createCipheriv, createHmac, randomBytes, scryptSync } from "node:crypto";
import prismaClient from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Load a local .env without adding a runtime dependency just for the seed script.
try {
  const envText = readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*["']?([^"']*)["']?\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
} catch {
  // Environment variables can be supplied by the shell/CI instead.
}

if (process.env.NODE_ENV === "production") throw new Error("Development seed is disabled in production.");
if (process.env.ATHAR_SEED !== "true") throw new Error("Set ATHAR_SEED=true to run the development seed.");

const databaseUrl = process.env.DATABASE_URL ?? "file:./data/athar.db";
const { PrismaClient } = prismaClient;
const idSecret = process.env.LOOKUP_HMAC_SECRET || process.env.ID_LOOKUP_SECRET;
const fieldKey = process.env.APP_ENCRYPTION_KEY || process.env.FIELD_ENCRYPTION_KEY;
if (!idSecret || !fieldKey) throw new Error("DATABASE_URL, LOOKUP_HMAC_SECRET, and APP_ENCRYPTION_KEY are required.");
const encryptionKey = Buffer.from(fieldKey, "base64");
if (encryptionKey.length !== 32) throw new Error("APP_ENCRYPTION_KEY must decode to exactly 32 bytes.");

const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });
const seedSlug = "demo-alnama-model-school";
const demoEmail = process.env.SEED_DEMO_EMAIL ?? "demo.manager@athar.local";
const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "Demo-only-password-123!";
const now = new Date();

function hash(value) { return createHmac("sha256", Buffer.from(idSecret, "base64")).update(value).digest("hex"); }
function passwordHash(value) { const salt = randomBytes(16); const derived = scryptSync(value, salt, 64, { N: 16384, r: 8, p: 1 }); return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`; }
function encrypt(value) { const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv); const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]); return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join("."); }
function inHours(hours) { return new Date(now.getTime() + hours * 60 * 60 * 1000); }
function inDays(days) { return inHours(days * 24); }
function plusHours(date, hours) { return new Date(date.getTime() + hours * 60 * 60 * 1000); }
function round(value) { return Number(value.toFixed(2)); }
function average(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
function distribution(values) { return [1, 2, 3, 4, 5].map((score) => { const count = values.filter((value) => value === score).length; return { score, count, percentage: values.length ? round((count / values.length) * 100) : null }; }); }

const criterionSpecs = [
  { name: "تطبيق المعرفة", category: "المعرفة", description: "تطبيق ما تم تعلمه في الممارسة.", guidance: "قارن الأداء بالمواقف العملية.", weight: 40, targetValue: 4 },
  { name: "جودة الأداء", category: "الأداء", description: "تحسن جودة تنفيذ المهام.", guidance: "استخدم شواهد الأداء اليومية.", weight: 35, targetValue: 4 },
  { name: "الثقة المهنية", category: "السلوك", description: "الثقة في استخدام المهارة الجديدة.", guidance: "اعتمد على السلوك الملحوظ.", weight: 25, targetValue: 4 },
];

function reportPayload(workshop, school, criteria, participants, teacherCount) {
  const reportCriteria = criteria.map((criterion, index) => {
    const pre = participants.map((participant) => participant.pre[index]);
    const post = participants.map((participant) => participant.post[index]);
    const preAverage = average(pre); const postAverage = average(post); const delta = postAverage - preAverage;
    return { criterionId: criterion.id, name: criterion.name, weight: criterion.weight, targetValue: criterion.targetValue, preAverage: round(preAverage), postAverage: round(postAverage), delta: round(delta), scaleImprovementPercentage: round((delta / 4) * 100), potentialImprovementPercentage: preAverage >= 5 ? null : round((delta / (5 - preAverage)) * 100), weightedPreContribution: round(preAverage * criterion.weight / 100), weightedPostContribution: round(postAverage * criterion.weight / 100), weightedDeltaContribution: round(delta * criterion.weight / 100), distribution: { pre: distribution(pre), post: distribution(post) } };
  });
  const weightedPreScore = round(reportCriteria.reduce((sum, criterion) => sum + criterion.weightedPreContribution, 0));
  const weightedPostScore = round(reportCriteria.reduce((sum, criterion) => sum + criterion.weightedPostContribution, 0));
  const weightedDelta = round(weightedPostScore - weightedPreScore);
  const overallScaleImprovementPercentage = round(weightedDelta / 4 * 100);
  const potentialImprovementPercentage = weightedPreScore >= 5 ? null : round(weightedDelta / (5 - weightedPreScore) * 100);
  const participantChanges = participants.map((participant, index) => {
    const preWeightedScore = round(participant.pre.reduce((sum, score, criterionIndex) => sum + score * criteria[criterionIndex].weight / 100, 0));
    const postWeightedScore = round(participant.post.reduce((sum, score, criterionIndex) => sum + score * criteria[criterionIndex].weight / 100, 0));
    return { participantId: participant.id, fullName: participant.fullName, jobTitle: participant.jobTitle, preWeightedScore, postWeightedScore, delta: round(postWeightedScore - preWeightedScore), index };
  });
  const responseRatePercentage = round(teacherCount / participants.length * 100);
  const evaluationAverage = teacherCount ? 4.4 : null;
  const satisfactionIndex = evaluationAverage === null ? null : round(evaluationAverage / 5 * 100);
  return { generatedAt: now.toISOString(), engineVersion: "impact-v1.0.0", participantCount: participants.length, criteria: reportCriteria, participantChanges, aggregates: { weightedPreScore, weightedPostScore, weightedDelta, overallScaleImprovementPercentage, potentialImprovementPercentage, impactScore: weightedDelta, managerAssessmentCompletionPercentage: 100 }, teacherAggregates: { responseCount: teacherCount, responseRatePercentage, evaluationAverage, satisfactionIndex, contentQualityAverage: teacherCount ? 4.5 : null, needFitAverage: teacherCount ? 4.3 : null, deliveryQualityAverage: teacherCount ? 4.4 : null, applicabilityAverage: teacherCount ? 4.2 : null, criterionAverages: criteria.map((criterion) => ({ criterionId: criterion.id, average: teacherCount ? 4.3 : null })) }, compositeImpact: { outcomeWeight: 0.8, participantEvaluationWeight: 0.2, index: teacherCount ? round(overallScaleImprovementPercentage * 0.8 + satisfactionIndex * 0.2) : null }, workshop: { id: workshop.id, title: workshop.title, description: workshop.description, facilitator: workshop.facilitator, providerOrganization: workshop.providerOrganization, category: workshop.category, startsAt: workshop.startsAt?.toISOString() ?? null, endsAt: workshop.endsAt?.toISOString() ?? null, objectives: workshop.objectives }, school: { id: school.id, name: school.name, ministryCode: school.ministryCode, educationAdministration: school.educationAdministration, region: school.region, city: school.city, educationStage: school.educationStage, schoolType: school.schoolType, genderType: school.genderType } };
}

async function createWorkshop({ school, user, staff, title, category, startsAt, endsAt, status, finalizedAt, completedAt, postSubmitted, participantCount, report }) {
  const workshop = await db.workshop.create({ data: { schoolId: school.id, title, description: "بيانات تطويرية وهمية لمراجعة واجهات أثر.", facilitator: "مقدم تجريبي", providerOrganization: "جهة تدريبية افتراضية", category, deliveryMode: "IN_PERSON", locationOrUrl: "قاعة تجريبية 01", startsAt, endsAt, objectives: "هدف تجريبي لمراجعة رحلة القياس.", status, finalizedAt, completedAt, postAssessmentSubmittedAt: postSubmitted, approvedAt: finalizedAt, draftStep: finalizedAt ? 5 : 2 } });
  const criteria = [];
  for (const [displayOrder, spec] of criterionSpecs.entries()) criteria.push(await db.workshopCriterion.create({ data: { workshopId: workshop.id, ...spec, displayOrder } }));
  const selected = staff.slice(0, participantCount);
  const participants = [];
  for (const person of selected) participants.push({ ...(await db.workshopParticipant.create({ data: { workshopId: workshop.id, staffId: person.id } })), fullName: person.fullName, jobTitle: person.jobTitle });
  const measuredParticipants = participants.map((participant, index) => ({ ...participant, pre: criteria.map((_, criterionIndex) => Math.min(5, 2 + ((index + criterionIndex) % 3))), post: criteria.map((_, criterionIndex) => Math.min(5, 3 + ((index + criterionIndex) % 3))) }));
  if (finalizedAt) {
    for (const participant of measuredParticipants) for (const [criterionIndex, criterion] of criteria.entries()) {
      await db.managerAssessment.create({ data: { workshopId: workshop.id, participantId: participant.id, criterionId: criterion.id, phase: "PRE", score: participant.pre[criterionIndex], status: "SUBMITTED", submittedAt: finalizedAt } });
      if (postSubmitted) await db.managerAssessment.create({ data: { workshopId: workshop.id, participantId: participant.id, criterionId: criterion.id, phase: "POST", score: participant.post[criterionIndex], status: "SUBMITTED", submittedAt: postSubmitted } });
    }
  }
  const responseCount = postSubmitted ? Math.min(6, participants.length) : status === "IN_PROGRESS" ? Math.min(3, participants.length) : 0;
  for (const participant of participants.slice(0, responseCount)) {
    const evaluation = await db.teacherWorkshopEvaluation.create({ data: { workshopId: workshop.id, staffId: participant.staffId, rating: 4, contentQuality: 5, needFit: 4, deliveryQuality: 4, applicability: 4, status: "SUBMITTED", submittedAt: postSubmitted ?? now } });
    for (const criterion of criteria) await db.teacherCriterionEvaluation.create({ data: { evaluationId: evaluation.id, criterionId: criterion.id, rating: 4 } });
  }
  if (report && postSubmitted) {
    const payload = reportPayload(workshop, school, criteria, measuredParticipants, responseCount);
    await db.reportSnapshot.create({ data: { schoolId: school.id, workshopId: workshop.id, engineVersion: "impact-v1.0.0", immutable: true, snapshot: payload, metrics: payload, generatedAt: postSubmitted } });
  }
  await db.auditLog.create({ data: { schoolId: school.id, userId: user.id, action: finalizedAt ? postSubmitted ? "REPORT_GENERATED" : "WORKSHOP_FINALIZED" : "WORKSHOP_CREATED", entity: "Workshop", entityId: workshop.id, metadata: { seed: true, status } } });
  return workshop;
}

async function main() {
  const oldSchool = await db.school.findUnique({ where: { slug: seedSlug }, select: { id: true } });
  if (oldSchool) {
    // Staff is intentionally RESTRICTed from deletion so historical workshop
    // participation cannot be lost accidentally. A development re-seed is
    // explicit, so remove the old demo graph in dependency order first.
    await db.$transaction(async (tx) => {
      const oldWorkshops = await tx.workshop.findMany({ where: { schoolId: oldSchool.id }, select: { id: true } });
      const workshopIds = oldWorkshops.map((workshop) => workshop.id);
      const oldFollowUps = await tx.followUpMeasurement.findMany({ where: { schoolId: oldSchool.id }, select: { id: true } });
      const followUpIds = oldFollowUps.map((followUp) => followUp.id);
      const oldEvaluations = workshopIds.length
        ? await tx.teacherWorkshopEvaluation.findMany({ where: { workshopId: { in: workshopIds } }, select: { id: true } })
        : [];

      if (oldEvaluations.length) {
        await tx.teacherCriterionEvaluation.deleteMany({ where: { evaluationId: { in: oldEvaluations.map((evaluation) => evaluation.id) } } });
        await tx.teacherWorkshopEvaluation.deleteMany({ where: { id: { in: oldEvaluations.map((evaluation) => evaluation.id) } } });
      }
      if (workshopIds.length) {
        await tx.managerAssessment.deleteMany({ where: { workshopId: { in: workshopIds } } });
        await tx.workshopParticipant.deleteMany({ where: { workshopId: { in: workshopIds } } });
        await tx.reportSnapshot.deleteMany({ where: { workshopId: { in: workshopIds } } });
      }
      if (followUpIds.length) await tx.followUpAssessment.deleteMany({ where: { followUpMeasurementId: { in: followUpIds } } });
      await tx.followUpMeasurement.deleteMany({ where: { schoolId: oldSchool.id } });
      await tx.workshop.deleteMany({ where: { schoolId: oldSchool.id } });
      await tx.auditLog.deleteMany({ where: { schoolId: oldSchool.id } });
      await tx.notification.deleteMany({ where: { schoolId: oldSchool.id } });
      await tx.staffImportBatch.deleteMany({ where: { schoolId: oldSchool.id } });
      await tx.schoolPrivacySettings.deleteMany({ where: { schoolId: oldSchool.id } });
      await tx.school.delete({ where: { id: oldSchool.id } });
    });
  }
  await db.user.deleteMany({ where: { email: demoEmail } });
  const user = await db.user.create({ data: { email: demoEmail, passwordHash: passwordHash(demoPassword), emailVerifiedAt: now } });
  const school = await db.school.create({ data: { name: "مدرسة النماء النموذجية", slug: seedSlug, ministryCode: "DEMO-ATHAR-0001", educationAdministration: "إدارة تعليم تجريبية", educationOffice: "مكتب تعليم تجريبي", region: "منطقة تجريبية", city: "مدينة تجريبية", educationStage: "المرحلة الابتدائية", schoolType: "GOVERNMENT", genderType: "OTHER", principalName: "مدير تجريبي", officialPhoneEncrypted: encrypt("0500000000"), setupStatus: "ACTIVE" } });
  await db.schoolMembership.create({ data: { userId: user.id, schoolId: school.id, role: "SCHOOL_OWNER" } });
  const names = ["أمل", "بدر", "تالا", "جود", "حسام", "دانية", "راشد", "ريم", "سامي", "شهد", "صالح", "ضي", "طارق", "عبير", "فهد", "لينا", "مازن", "نورا", "هاني", "وعد", "ياسر", "زينة"];
  const specialties = ["رياضيات", "علوم", "لغة عربية", "لغة إنجليزية", "تقنية", "تربية فنية", "تربية بدنية", "إرشاد طلابي"];
  const staff = [];
  for (let index = 0; index < 35; index += 1) {
    const fakeId = `990000${String(index + 1).padStart(4, "0")}`;
    const fakePhone = (index + 1) % 11 === 0 ? null : `050000${String(index + 1).padStart(4, "0")}`;
    staff.push(await db.staffMember.create({ data: { schoolId: school.id, fullName: `${names[index % names.length]} موظف تجريبي ${String(index + 1).padStart(2, "0")}`, nationalIdHash: hash(fakeId), nationalIdLast4: fakeId.slice(-4), phoneEncrypted: fakePhone ? encrypt(fakePhone) : null, phoneLookupHash: fakePhone ? hash(fakePhone) : null, phoneLast4: fakePhone?.slice(-4) ?? null, jobTitle: index % 5 === 0 ? "وكيل تجريبي" : "معلم تجريبي", specialization: specialties[index % specialties.length], email: `staff-${String(index + 1).padStart(2, "0")}@athar.local`, employeeNumber: `DEMO-EMP-${String(index + 1).padStart(3, "0")}`, source: "NOOR_IMPORT", active: true } }));
  }
  await db.criterionTemplate.createMany({ data: criterionSpecs.map((spec) => ({ schoolId: school.id, templateName: "قالب أثر تجريبي", name: spec.name, description: spec.description, category: spec.category, guidance: spec.guidance, defaultWeight: spec.weight })) });
  await db.workshopTemplate.create({ data: { schoolId: school.id, name: "قالب ورشة تجريبي", workshopType: "تطوير مهني", description: "قالب تطويري لمراجعة إنشاء الورش.", objectives: "تجربة أهداف الورشة والقوالب.", category: "تطوير مهني", deliveryMode: "IN_PERSON", criteria: { create: criterionSpecs.map((spec, displayOrder) => ({ name: spec.name, description: spec.description, category: spec.category, guidance: spec.guidance, weight: spec.weight, targetValue: spec.targetValue, displayOrder })) } } });
  await createWorkshop({ school, user, staff, title: "تطبيق التعلم النشط", category: "استراتيجيات التدريس", startsAt: inDays(-30), endsAt: plusHours(inDays(-30), 4), finalizedAt: inDays(-31), completedAt: inDays(-29), postSubmitted: inDays(-28), status: "COMPLETED", participantCount: 18, report: true });
  await createWorkshop({ school, user, staff: staff.slice(5), title: "بناء مجتمعات التعلم", category: "القيادة المدرسية", startsAt: inDays(-18), endsAt: plusHours(inDays(-18), 3), finalizedAt: inDays(-19), completedAt: inDays(-17), postSubmitted: inDays(-16), status: "COMPLETED", participantCount: 14, report: true });
  await createWorkshop({ school, user, staff: staff.slice(10), title: "مختبر الممارسة الصفية", category: "استراتيجيات التدريس", startsAt: inHours(-1), endsAt: inHours(4), finalizedAt: inHours(-2), status: "IN_PROGRESS", participantCount: 16, report: false });
  await createWorkshop({ school, user, staff: staff.slice(15), title: "التقويم من أجل التعلم", category: "التقويم", startsAt: inDays(2), endsAt: plusHours(inDays(2), 4), finalizedAt: inHours(-2), status: "SCHEDULED", participantCount: 12, report: false });
  await createWorkshop({ school, user, staff: staff.slice(20), title: "التعلم الرقمي في الصف", category: "التقنية", startsAt: inDays(-3), endsAt: inHours(-2), finalizedAt: inDays(-4), status: "POST_ASSESSMENT_AVAILABLE", participantCount: 10, report: false });
  await createWorkshop({ school, user, staff: staff.slice(25), title: "ورشة جديدة - مسودة", category: "", startsAt: null, endsAt: null, finalizedAt: null, status: "DRAFT", participantCount: 0, report: false });
  await db.notification.createMany({ data: [{ schoolId: school.id, type: "WORKSHOP_POST_READY", title: "التقييم البعدي متاح", body: "ورشة التعلم الرقمي في الصف جاهزة لاستكمال القياس البعدي.", href: "/dashboard/workshops", entityId: null }, { schoolId: school.id, type: "IMPORT_COMPLETED", title: "تم استيراد المنسوبين", body: "تم تجهيز 35 سجلًا تجريبيًا للمراجعة.", href: "/dashboard/staff", entityId: null }, { schoolId: school.id, type: "WORKSHOP_STARTED", title: "بدأت ورشة تجريبية", body: "ورشة مختبر الممارسة الصفية قيد التنفيذ.", href: "/dashboard/workshops", entityId: null }] });
  await db.schoolPrivacySettings.create({ data: { schoolId: school.id } });
  console.log(`Seeded ${school.name} with ${staff.length} fake staff records.`);
  console.log(`Demo email: ${demoEmail}`);
  console.log(`Demo password: ${demoPassword}`);
  console.log("All IDs and phone numbers are synthetic development values.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await db.$disconnect(); });
