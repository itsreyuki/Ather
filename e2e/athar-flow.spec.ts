import { expect, test, type Page } from "@playwright/test";
import { registrationPassword, rosterFixture, uniqueEmail } from "./fixtures";
import { db } from "../src/lib/db";

const databaseConfigured = Boolean(process.env.DATABASE_URL);
const preConfirmation = "اعتماد وبدء عملية القياس";
const postConfirmation = "اعتماد التقييمات وإنهاء قياس الورشة";
const createdEmails = new Set<string>();

test.beforeEach(async ({}, testInfo) => {
  testInfo.skip(!databaseConfigured, "E2E requires DATABASE_URL and an applied Prisma schema");
});

test.afterEach(async () => {
  for (const email of createdEmails) {
    const user = await db.user.findUnique({ where: { email }, select: { id: true, memberships: { select: { schoolId: true } } } });
    if (!user) continue;
    for (const { schoolId } of user.memberships) {
      await db.$transaction(async (tx) => {
        await tx.reportSnapshot.deleteMany({ where: { schoolId } });
        await tx.workshop.deleteMany({ where: { schoolId } });
        await tx.auditLog.deleteMany({ where: { schoolId } });
        await tx.school.deleteMany({ where: { id: schoolId } });
      });
    }
    await db.auditLog.deleteMany({ where: { userId: user.id } });
    await db.user.deleteMany({ where: { id: user.id } });
  }
  createdEmails.clear();
});

test.afterAll(async () => {
  await db.$disconnect();
});

async function setClock(page: Page, now: string) {
  const response = await page.request.post("/api/test/clock", { data: { now } });
  expect(response.ok()).toBeTruthy();
}

async function registerAndOnboard(page: Page, prefix: string, importStaff = true) {
  const email = await uniqueEmail(prefix);
  createdEmails.add(email);
  const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-8);
  const teacherNationalId = `99${uniqueSuffix}`;
  await page.goto("/auth/register");
  await page.locator("#register-email").fill(email);
  await page.locator("#register-password").fill(registrationPassword);
  await page.locator("#register-confirmPassword").fill(registrationPassword);
  await page.locator("form.auth-form button[type=submit]").click();
  await expect(page).toHaveURL(/\/onboarding/);

  const fields: Record<string, string> = {
    officialName: `${prefix} School`,
    ministryCode: `${prefix}-${Date.now()}`,
    educationAdministration: "E2E Administration",
    region: "E2E Region",
    city: "E2E City",
    educationStage: "Primary",
    principalName: "E2E Principal",
  };
  for (const [id, value] of Object.entries(fields)) {
    const field = page.locator(`#${id}`);
    if (await field.evaluate((element) => element.tagName === "SELECT")) await field.selectOption({ index: 2 });
    else await field.fill(value);
  }
  await page.locator(".onboarding-form button[type=submit]").click();
  await page.locator(".review-step .button-primary").click();
  await expect(page).toHaveURL(/\/onboarding\/import/);

  if (importStaff) {
    await page.locator('input[type="file"]').setInputFiles({ name: "e2e-roster.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: await rosterFixture(teacherNationalId) });
    await page.locator(".import-action-row button").click();
    await expect(page.locator(".import-preview-table")).toBeVisible();
    await page.locator(".form-actions button.button-primary").click();
    await expect(page.locator(".import-success")).toBeVisible();
  }
  return { email, teacherNationalId };
}

test("manager completes the measurement lifecycle through teacher portal and report export", async ({ page, browser }) => {
  await setClock(page, "2026-08-15T09:00:00.000Z");
  const manager = await registerAndOnboard(page, "E2E-A");

  await page.goto("/dashboard/staff");
  const staffHref = await page.locator('a[href^="/dashboard/staff/"]:not([href="/dashboard/staff/import"])').first().getAttribute("href");
  expect(staffHref).toBeTruthy();
  const staffId = staffHref!.split("/").pop()!;

  const create = await page.request.post("/api/dashboard/workshops", { data: { title: "E2E Impact Workshop", facilitator: "E2E Facilitator", category: "Practice", startsAt: "2026-08-15T10:00", endsAt: "2026-08-15T11:00", objectives: "Measure transfer" } });
  expect(create.status()).toBe(201);
  const workshopId = (await create.json()).id as string;
  const participants = await page.request.put(`/api/dashboard/workshops/${workshopId}/participants`, { data: { staffIds: [staffId] } });
  expect(participants.ok()).toBeTruthy();
  const participantId = ((await participants.json()).participants[0].id) as string;
  const criteria = await page.request.put(`/api/dashboard/workshops/${workshopId}/criteria`, { data: { criteria: [{ name: "Application", description: "Transfer", category: "Outcome", guidance: "Observe", weight: 100, targetValue: 4 }] } });
  expect(criteria.ok()).toBeTruthy();
  const criterionId = ((await criteria.json()).criteria[0].id) as string;
  const pre = await page.request.put(`/api/dashboard/workshops/${workshopId}/evaluations`, { data: { phase: "PRE", items: [{ participantId, criterionId, score: 3 }] } });
  expect(pre.ok()).toBeTruthy();
  const finalized = await page.request.post(`/api/dashboard/workshops/${workshopId}/finalize`, { data: { confirmation: preConfirmation } });
  expect(finalized.ok()).toBeTruthy();

  await setClock(page, "2026-08-15T10:30:00.000Z");
  const teacher = await browser.newContext();
  const teacherPage = await teacher.newPage();
  await teacherPage.goto("/teacher");
  await teacherPage.locator("#teacher-id").fill(manager.teacherNationalId);
  await teacherPage.locator(".teacher-auth-card form.auth-form").first().locator("button[type=submit]").click();
  const evaluationLink = teacherPage.locator(`a[href="/teacher/workshops/${workshopId}/evaluate"]`).first();
  await expect(evaluationLink).toBeVisible();
  await evaluationLink.click();
  await teacherPage.locator('.teacher-criteria-list [role="radio"]').nth(4).click();
  await teacherPage.on("dialog", (dialog) => void dialog.accept());
  await teacherPage.locator(".teacher-evaluation-actions button[type=button]").click();
  await expect(teacherPage.locator(".teacher-evaluation-success")).toBeVisible();

  await setClock(page, "2026-08-15T12:00:00.000Z");
  const post = await page.request.put(`/api/dashboard/workshops/${workshopId}/evaluations`, { data: { phase: "POST", items: [{ participantId, criterionId, score: 4 }] } });
  expect(post.ok()).toBeTruthy();
  const completed = await page.request.post(`/api/dashboard/workshops/${workshopId}/finalize-post`, { data: { confirmation: postConfirmation } });
  expect(completed.ok()).toBeTruthy();
  await page.goto(`/dashboard/workshops/${workshopId}/report`);
  await expect(page.locator(".report-page")).toBeVisible();
  const exportResponse = await page.request.get(`/api/dashboard/workshops/${workshopId}/report/export?format=xlsx`);
  expect(exportResponse.ok()).toBeTruthy();
  expect(exportResponse.headers()["content-type"]).toContain("spreadsheet");
  const pdfResponse = await page.request.get(`/api/dashboard/workshops/${workshopId}/report/export?format=pdf`);
  expect(pdfResponse.ok()).toBeTruthy();
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  expect((await pdfResponse.body()).byteLength).toBeGreaterThan(10_000);
  await teacher.close();
});

test("school A cannot mutate school B workshop", async ({ page, browser }) => {
  await setClock(page, "2026-08-15T09:00:00.000Z");
  await registerAndOnboard(page, "E2E-A-isolation");
  const schoolB = await browser.newContext();
  const schoolBPage = await schoolB.newPage();
  await registerAndOnboard(schoolBPage, "E2E-B-isolation", false);
  const created = await schoolBPage.request.post("/api/dashboard/workshops", { data: { title: "School B Draft" } });
  expect(created.status()).toBe(201);
  const schoolBWorkshopId = (await created.json()).id as string;
  const response = await page.request.patch(`/api/dashboard/workshops/${schoolBWorkshopId}`, { data: { title: "Cross tenant mutation" } });
  expect(response.status()).toBe(404);
  await schoolB.close();
});
