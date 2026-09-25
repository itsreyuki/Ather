import ExcelJS from "exceljs";
import { Prisma, ProfessionalGrowthPlanStatus, ProgramType, WorkshopStatus } from "@prisma/client";
import { db } from "./db";
import { exportSafeSpreadsheetValue } from "./staff-import";

export const programTypeLabels: Record<ProgramType, string> = {
  TECHNICAL: "تقني",
  TECHNICAL_EDUCATIONAL: "تقني تعليمي",
  PROFESSIONAL: "مهني",
  PROFESSIONAL_EDUCATIONAL: "مهني تعليمي",
  EDUCATIONAL: "تربوي",
  EDUCATIONAL_EDUCATIONAL: "تربوي تعليمي",
};

export const programTypes = Object.keys(programTypeLabels) as ProgramType[];
const programTypeByLabel = new Map(
  Object.entries(programTypeLabels).map(([key, value]) => [value, key as ProgramType]),
);
const templateHeaders = ["اسم البرنامج", "نوع البرنامج", "المنفذ"] as const;
const MAX_PROGRAMS_PER_PLAN = 100;

export type PlanStaffCandidate = { id: string; fullName: string; jobTitle: string | null };
export type FacilitatorMatch =
  | { state: "MATCHED"; staffId: string; candidates: PlanStaffCandidate[] }
  | { state: "MISSING" | "AMBIGUOUS"; staffId: null; candidates: PlanStaffCandidate[] };
export type ImportedPlanProgram = {
  rowNumber: number;
  title: string;
  programType: ProgramType;
  facilitatorName: string;
  match: FacilitatorMatch;
};

export function normalizeProfessionalName(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/[ى]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function nameMatches(query: string[], candidate: string[]) {
  if (!query.length || !candidate.length) return false;
  const input = query.join(" ");
  const full = candidate.join(" ");
  if (input === full || full.startsWith(`${input} `)) return true;
  if (query.length === 1) return query[0] === candidate[0];
  return (
    (query[0] === candidate[0] && query[1] === candidate[1]) ||
    (query[0] === candidate[0] && query.at(-1) === candidate.at(-1))
  );
}

export function matchProfessionalFacilitator(value: string, staff: PlanStaffCandidate[]): FacilitatorMatch {
  const query = normalizeProfessionalName(value).split(" ").filter(Boolean);
  const candidates = staff.filter((item) =>
    nameMatches(query, normalizeProfessionalName(item.fullName).split(" ").filter(Boolean)),
  );
  if (candidates.length === 1) return { state: "MATCHED", staffId: candidates[0]!.id, candidates };
  return { state: candidates.length ? "AMBIGUOUS" : "MISSING", staffId: null, candidates };
}

function cellText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value && typeof value.text === "string")
    return value.text.trim();
  return String(value).trim();
}

function normalizedHeader(value: string) {
  return normalizeProfessionalName(value).replace(/\s+/g, " ");
}

export async function createProfessionalPlanTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ATHAR";
  const sheet = workbook.addWorksheet("البرامج");
  sheet.views = [{ rightToLeft: true }];
  sheet.addRow([...templateHeaders]);
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF176B49" } };
  sheet.columns = [{ width: 34 }, { width: 24 }, { width: 30 }];
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function parseProfessionalPlanWorkbook(file: File, staff: PlanStaffCandidate[]) {
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("ارفع نموذج Excel بصيغة XLSX فقط.");
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) throw new Error("حجم ملف النموذج غير صالح.");
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error("تعذر قراءة ملف Excel. حمّل نموذج الخطة ثم أعد تعبئته.");
  }
  const sheet = workbook.getWorksheet("البرامج");
  if (!sheet) throw new Error("لا توجد ورقة باسم «البرامج». استخدم نموذج الخطة المحمّل من أثر.");
  const headers = Array.from({ length: sheet.columnCount }, (_, index) =>
    cellText(sheet.getRow(1).getCell(index + 1).value),
  );
  if (
    headers.length !== templateHeaders.length ||
    headers.some((value, index) => normalizedHeader(value) !== normalizedHeader(templateHeaders[index]!))
  )
    throw new Error("الملف لا يطابق نموذج خطة النمو المهني. حمّل النموذج الرسمي ثم أعد تعبئته.");
  const rows: ImportedPlanProgram[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    let hasFormula = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.formula) hasFormula = true;
    });
    if (hasFormula) throw new Error(`الصف ${rowNumber} يحتوي صيغة غير مسموحة.`);
    const [title, typeLabel, facilitatorName] = templateHeaders.map((_, index) =>
      cellText(row.getCell(index + 1).value),
    );
    if (![title, typeLabel, facilitatorName].some(Boolean)) continue;
    if (!title || !typeLabel || !facilitatorName) throw new Error(`أكمل حقول الصف ${rowNumber} قبل الرفع.`);
    if (title.length > 200 || facilitatorName.length > 200)
      throw new Error(`بيانات الصف ${rowNumber} طويلة جدًا.`);
    const programType = programTypeByLabel.get(typeLabel.trim());
    if (!programType) throw new Error(`نوع البرنامج في الصف ${rowNumber} غير مدعوم.`);
    rows.push({
      rowNumber,
      title,
      programType,
      facilitatorName,
      match: matchProfessionalFacilitator(facilitatorName, staff),
    });
  }
  if (!rows.length) throw new Error("لا يحتوي النموذج على برامج قابلة للاستيراد.");
  if (rows.length > MAX_PROGRAMS_PER_PLAN) throw new Error("يتجاوز النموذج الحد الأعلى لعدد البرامج.");
  return rows;
}

export async function refreshProfessionalGrowthPlanStatus(
  tx: Prisma.TransactionClient,
  input: { schoolId: string; planId: string; userId?: string },
) {
  const plan = await tx.professionalGrowthPlan.findFirst({
    where: { id: input.planId, schoolId: input.schoolId },
    select: {
      id: true,
      status: true,
      programs: {
        where: { deletedAt: null },
        select: { finalizedAt: true, cancelledAt: true, postAssessmentSubmittedAt: true },
      },
    },
  });
  if (!plan) return null;
  const programs = plan.programs;
  const allPrepared =
    programs.length > 0 && programs.every((program) => Boolean(program.finalizedAt || program.cancelledAt));
  const allTerminal =
    programs.length > 0 &&
    programs.every((program) => Boolean(program.postAssessmentSubmittedAt || program.cancelledAt));
  const status = allTerminal
    ? ProfessionalGrowthPlanStatus.COMPLETED
    : allPrepared
      ? ProfessionalGrowthPlanStatus.ACTIVE
      : ProfessionalGrowthPlanStatus.DRAFT;
  if (status === plan.status) return status;
  const now = new Date();
  await tx.professionalGrowthPlan.update({
    where: { id: plan.id },
    data: {
      status,
      ...(status === ProfessionalGrowthPlanStatus.ACTIVE ? { activatedAt: now } : {}),
      ...(status === ProfessionalGrowthPlanStatus.COMPLETED ? { completedAt: now } : {}),
    },
  });
  await tx.auditLog.create({
    data: {
      schoolId: input.schoolId,
      userId: input.userId,
      action:
        status === ProfessionalGrowthPlanStatus.ACTIVE
          ? "PROFESSIONAL_GROWTH_PLAN_ACTIVATED"
          : "PROFESSIONAL_GROWTH_PLAN_STATUS_UPDATED",
      entity: "ProfessionalGrowthPlan",
      entityId: plan.id,
      metadata: { status },
    },
  });
  return status;
}

export async function buildProfessionalGrowthPlanSnapshot(schoolId: string, planId: string) {
  return db.$transaction(async (tx) => {
    const plan = await tx.professionalGrowthPlan.findFirst({
      where: { id: planId, schoolId },
      include: {
        school: {
          select: { id: true, name: true, ministryCode: true, educationAdministration: true, city: true },
        },
        programs: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          include: {
            report: {
              select: {
                id: true,
                snapshot: true,
                impactScore: true,
                overallScaleImprovement: true,
                teacherResponseRate: true,
              },
            },
          },
        },
        report: true,
      },
    });
    if (!plan) throw new Error("PLAN_NOT_FOUND");
    if (plan.report) return plan.report;
    if (plan.status !== ProfessionalGrowthPlanStatus.COMPLETED) throw new Error("PLAN_NOT_COMPLETE");
    const rows = plan.programs.map((program) => ({
      id: program.id,
      title: program.title,
      programType: program.programType,
      programTypeLabel: program.programType ? programTypeLabels[program.programType] : "غير محدد",
      facilitator: program.facilitator,
      status: program.status,
      participantCount: undefined,
      impact: program.cancelledAt ? null : (program.report?.impactScore ?? null),
      scaleImprovement: program.cancelledAt ? null : (program.report?.overallScaleImprovement ?? null),
      teacherResponseRate: program.cancelledAt ? null : (program.report?.teacherResponseRate ?? null),
      reportId: program.report?.id ?? null,
      cancelled: Boolean(program.cancelledAt),
    }));
    const measured = rows.filter((row) => !row.cancelled && row.reportId);
    const average = (values: Array<number | null>) => {
      const usable = values.filter((value): value is number => value !== null && Number.isFinite(value));
      return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
    };
    const snapshot = {
      generatedAt: new Date().toISOString(),
      plan: { id: plan.id, title: plan.title, periodLabel: plan.periodLabel, status: plan.status },
      school: plan.school,
      summary: {
        programCount: rows.length,
        completedProgramCount: measured.length,
        cancelledProgramCount: rows.filter((row) => row.cancelled).length,
        averageImpact: average(measured.map((row) => row.impact)),
        averageScaleImprovement: average(measured.map((row) => row.scaleImprovement)),
        averageTeacherResponseRate: average(measured.map((row) => row.teacherResponseRate)),
      },
      programs: rows,
      methodology:
        "يعرض التقرير مؤشرات كل برنامج مكتمل بصورة مستقلة، ومتوسطات وصفية للبرامج غير الملغاة دون دمج القياسات الفردية بين البرامج.",
    };
    try {
      return await tx.professionalGrowthPlanReportSnapshot.create({
        data: { schoolId, planId, immutable: true, snapshot },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        return tx.professionalGrowthPlanReportSnapshot.findUniqueOrThrow({ where: { planId } });
      throw error;
    }
  });
}

export async function createProfessionalPlanWorkbook(snapshot: Record<string, unknown>) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ATHAR";
  const plan = snapshot.plan as { title?: string; periodLabel?: string } | undefined;
  const summary = snapshot.summary as Record<string, unknown> | undefined;
  const sheet = workbook.addWorksheet("ملخص الخطة");
  sheet.views = [{ rightToLeft: true }];
  sheet.addRows([
    ["الحقل", "القيمة"],
    ["الخطة", exportSafeSpreadsheetValue(plan?.title ?? "—")],
    ["الفترة", exportSafeSpreadsheetValue(plan?.periodLabel ?? "—")],
    ["عدد البرامج", summary?.programCount ?? "—"],
    ["متوسط مؤشر الأثر", summary?.averageImpact ?? "—"],
    ["متوسط التحسن", summary?.averageScaleImprovement ?? "—"],
    ["معدل استجابة المشاركين", summary?.averageTeacherResponseRate ?? "—"],
  ]);
  const programs = workbook.addWorksheet("البرامج");
  programs.views = [{ rightToLeft: true }];
  programs.addRow(["البرنامج", "النوع", "المنفذ", "الحالة", "مؤشر الأثر", "التحسن", "استجابة المشاركين"]);
  for (const program of (snapshot.programs as Array<Record<string, unknown>> | undefined) ?? [])
    programs.addRow(
      [
        "title",
        "programTypeLabel",
        "facilitator",
        "status",
        "impact",
        "scaleImprovement",
        "teacherResponseRate",
      ].map((key) => exportSafeSpreadsheetValue(String(program[key] ?? "—"))),
    );
  for (const tab of [sheet, programs]) {
    tab.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    tab.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF176B49" } };
    tab.columns = Array.from({ length: Math.max(2, tab.columnCount) }, () => ({ width: 24 }));
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function professionalPlanReportFileName(extension: "xlsx" | "pdf") {
  return `athar-professional-growth-plan-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

export function planWorkshopState(
  status: WorkshopStatus,
  finalizedAt: Date | null,
  cancelledAt: Date | null,
  completedAt: Date | null,
) {
  if (cancelledAt) return "ملغى";
  if (completedAt || status === WorkshopStatus.COMPLETED) return "مكتمل";
  if (!finalizedAt) return "أكمل الإعداد والقياس القبلي";
  return "بانتظار التنفيذ أو القياس البعدي";
}
