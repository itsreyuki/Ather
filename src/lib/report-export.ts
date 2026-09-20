import ExcelJS from "exceljs";
import { exportSafeSpreadsheetValue } from "./staff-import";
import type { ReportPayload } from "./reporting";

const numberFormatter = new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 });
const dateFormatter = new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" });

function text(value: string | null | undefined) {
  return exportSafeSpreadsheetValue(value ?? "—");
}

function number(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : value;
}

function displayNumber(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : numberFormatter.format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

export function reportFileName(payload: ReportPayload, extension: "pdf" | "xlsx") {
  const parsed = new Date(payload.generatedAt);
  const date = Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
  return `athar-workshop-report-${date}.${extension}`;
}

function styleWorksheet(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ rightToLeft: true }];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF176B49" } };
  sheet.getRow(1).alignment = { horizontal: "right", vertical: "middle" };
  sheet.getRow(1).height = 24;
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = { ...cell.alignment, vertical: "middle", wrapText: true };
      cell.border = { bottom: { style: "thin", color: { argb: "FFD9E5DF" } } };
    });
  });
  sheet.autoFilter = { from: "A1", to: { row: Math.max(sheet.rowCount, 1), column: Math.max(sheet.columnCount, 1) } };
}

function addKeyValueRows(sheet: ExcelJS.Worksheet, rows: Array<[string, string | number]>) {
  sheet.addRow(["الحقل", "القيمة"]);
  for (const [label, value] of rows) sheet.addRow([text(label), typeof value === "number" ? value : text(value)]);
  styleWorksheet(sheet);
  sheet.columns = [{ width: 30 }, { width: 42 }];
}

export async function createReportWorkbook(input: { payload: ReportPayload; reportId: string; includeParticipants: boolean }) {
  const { payload, reportId, includeParticipants } = input;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ATHAR";
  workbook.lastModifiedBy = "ATHAR";
  workbook.created = new Date();
  workbook.modified = new Date();

  const summary = workbook.addWorksheet("Summary");
  const workshop = payload.workshop;
  const school = payload.school;
  addKeyValueRows(summary, [
    ["رقم التقرير", reportId],
    ["المدرسة", school?.name ?? "—"],
    ["الورشة", workshop?.title ?? "—"],
    ["الفترة", `${formatDate(workshop?.startsAt)} — ${formatDate(workshop?.endsAt)}`],
    ["مقدم الورشة", workshop?.facilitator ?? "—"],
    ["المجال", workshop?.category ?? "—"],
    ["عدد المشاركين", payload.participantCount],
    ["تاريخ الإصدار", formatDate(payload.generatedAt)],
    ["المتوسط القبلي", number(payload.aggregates.weightedPreScore)],
    ["المتوسط البعدي", number(payload.aggregates.weightedPostScore)],
    ["الفرق", number(payload.aggregates.weightedDelta)],
    ["التحسن على المقياس %", number(payload.aggregates.overallScaleImprovementPercentage)],
    ["مؤشر الأثر المركب", number(payload.compositeImpact.index)],
    ["معدل استجابة المتدربين %", number(payload.teacherAggregates.responseRatePercentage)],
    ["ملاحظة منهجية", "المؤشرات ناتجة عن مقارنة القياس القبلي والبعدي وتقييمات المشاركين، ولا تثبت علاقة سببية."],
  ]);

  const criteria = workbook.addWorksheet("Criteria");
  criteria.addRow(["المعيار", "الوزن %", "الهدف", "القبلي", "البعدي", "الفرق", "التحسن على المقياس %", "التحسن المحتمل %", "الحالة"]);
  for (const criterion of payload.criteria) {
    criteria.addRow([text(criterion.name), criterion.weight, number(criterion.targetValue), number(criterion.preAverage), number(criterion.postAverage), number(criterion.delta), number(criterion.scaleImprovementPercentage), number(criterion.potentialImprovementPercentage), text(criterion.delta === null ? "غير مكتمل" : criterion.delta > 0 ? "تحسن" : criterion.delta < 0 ? "يحتاج متابعة" : "ثابت")]);
  }
  criteria.columns = [{ width: 30 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 20 }, { width: 20 }, { width: 18 }];
  styleWorksheet(criteria);

  const prePost = workbook.addWorksheet("Pre Post");
  prePost.addRow(["المعيار", "القبلي", "البعدي", "الفرق", "قبلي 1", "قبلي 2", "قبلي 3", "قبلي 4", "قبلي 5", "بعدي 1", "بعدي 2", "بعدي 3", "بعدي 4", "بعدي 5"]);
  for (const criterion of payload.criteria) {
    prePost.addRow([
      text(criterion.name), number(criterion.preAverage), number(criterion.postAverage), number(criterion.delta),
      ...criterion.distribution.pre.map((item) => item.count), ...criterion.distribution.post.map((item) => item.count),
    ]);
  }
  prePost.columns = [{ width: 30 }, ...Array.from({ length: 13 }, () => ({ width: 12 }))];
  styleWorksheet(prePost);

  const participants = workbook.addWorksheet("Participants");
  participants.addRow(["المشارك", "المسمى الوظيفي", "المتوسط القبلي المرجح", "المتوسط البعدي المرجح", "الفرق"]);
  if (includeParticipants) {
    payload.participantChanges.forEach((participant, index) => participants.addRow([text(participant.fullName || `مشارك ${index + 1}`), text(participant.jobTitle), number(participant.preWeightedScore), number(participant.postWeightedScore), number(participant.delta)]));
  } else {
    participants.addRow([text("غير متاح"), text("لا يملك المستخدم صلاحية تصدير تفاصيل المشاركين"), "—", "—", "—"]);
  }
  participants.columns = [{ width: 30 }, { width: 24 }, { width: 22 }, { width: 22 }, { width: 14 }];
  styleWorksheet(participants);

  const teacherFeedback = workbook.addWorksheet("Teacher Feedback");
  addKeyValueRows(teacherFeedback, [
    ["عدد الردود", payload.teacherAggregates.responseCount],
    ["معدل الاستجابة %", number(payload.teacherAggregates.responseRatePercentage)],
    ["متوسط التقييم", number(payload.teacherAggregates.evaluationAverage)],
    ["مؤشر الرضا %", number(payload.teacherAggregates.satisfactionIndex)],
    ["جودة المحتوى", number(payload.teacherAggregates.contentQualityAverage)],
    ["ملاءمة الورشة للاحتياج", number(payload.teacherAggregates.needFitAverage)],
    ["جودة التقديم", number(payload.teacherAggregates.deliveryQualityAverage)],
    ["قابلية التطبيق", number(payload.teacherAggregates.applicabilityAverage)],
  ]);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export { displayNumber };
