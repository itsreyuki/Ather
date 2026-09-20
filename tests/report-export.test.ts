import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { ReportPdfDocument } from "../src/lib/report-pdf";
import { createReportWorkbook, reportFileName } from "../src/lib/report-export";
import type { ReportPayload } from "../src/lib/reporting";
import { normalizeReportPayload } from "../src/lib/reporting";

const payload: ReportPayload = {
  generatedAt: "2026-08-15T10:00:00.000Z",
  engineVersion: "impact-v1.0.0",
  participantCount: 2,
  participantChanges: [{ participantId: "p1", fullName: "=HYPERLINK(\"https://example.com\")", jobTitle: "معلم", preWeightedScore: 2, postWeightedScore: 4, delta: 2 }],
  criteria: [{ criterionId: "c1", name: "تطبيق المعرفة", weight: 100, targetValue: 4, preAverage: 2, postAverage: 4, delta: 2, scaleImprovementPercentage: 50, potentialImprovementPercentage: 66.67, weightedPreContribution: 2, weightedPostContribution: 4, weightedDeltaContribution: 2, distribution: { pre: [1, 2, 3, 4, 5].map((score) => ({ score: score as 1 | 2 | 3 | 4 | 5, count: score === 2 ? 1 : 0, percentage: score === 2 ? 100 : 0 })), post: [1, 2, 3, 4, 5].map((score) => ({ score: score as 1 | 2 | 3 | 4 | 5, count: score === 4 ? 1 : 0, percentage: score === 4 ? 100 : 0 })) } }],
  aggregates: { weightedPreScore: 2, weightedPostScore: 4, weightedDelta: 2, overallScaleImprovementPercentage: 50, potentialImprovementPercentage: 66.67, impactScore: 2, managerAssessmentCompletionPercentage: 100 },
  teacherAggregates: { responseCount: 1, responseRatePercentage: 50, evaluationAverage: 4, satisfactionIndex: 80, contentQualityAverage: 4, needFitAverage: 4, deliveryQualityAverage: 4, applicabilityAverage: 4, criterionAverages: [] },
  compositeImpact: { outcomeWeight: 0.8, participantEvaluationWeight: 0.2, index: 2.4 },
  workshop: { id: "w1", title: "ورشة تجريبية", facilitator: "مقدم", category: "تطوير", startsAt: "2026-08-15T08:00:00.000Z", endsAt: "2026-08-15T10:00:00.000Z" },
  school: { name: "مدرسة أثر" },
};

describe("report exports", () => {
  it("creates safe, structured Excel sheets without formula injection", async () => {
    const buffer = await createReportWorkbook({ payload, reportId: "report-1", includeParticipants: true });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Summary", "Criteria", "Pre Post", "Participants", "Teacher Feedback"]);
    expect(workbook.getWorksheet("Participants")?.getCell("A2").value).toBe("'=HYPERLINK(\"https://example.com\")");
  });

  it("renders an actual PDF and uses a safe date-based filename", async () => {
    const pdf = await renderToBuffer(createElement(ReportPdfDocument, { payload, reportId: "report-1" }) as unknown as Parameters<typeof renderToBuffer>[0]);
    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    expect(reportFileName(payload, "xlsx")).toBe("athar-workshop-report-2026-08-15.xlsx");
  });

  it("keeps old snapshot versions readable without inventing missing teacher data", () => {
    const old = normalizeReportPayload({ engineVersion: "impact-v0", participantCount: 1, criteria: [], aggregates: { weightedPreScore: 5, weightedPostScore: 4, weightedDelta: -1 }, teacherAggregates: { responseCount: 0, responseRatePercentage: null } });
    expect(old?.engineVersion).toBe("impact-v0");
    expect(old?.aggregates.weightedDelta).toBe(-1);
    expect(old?.teacherAggregates.responseCount).toBe(0);
    expect(normalizeReportPayload({ engineVersion: "broken" })).toBeNull();
  });
});
