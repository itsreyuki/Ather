import { describe, expect, it } from "vitest";
import { buildCriterionTrends, buildExecutiveSummary, buildReportComparison, resolveImpactBand, type ReportPayload, type ReportsOverviewRow } from "../src/lib/reporting";

function payload(overrides: Partial<ReportPayload> = {}): ReportPayload {
  return {
    generatedAt: "2026-05-01T00:00:00.000Z", engineVersion: "impact-v1.0.0", participantCount: 10, criteria: [
      { criterionId: "knowledge", name: "تطبيق المعرفة", weight: 60, targetValue: 4, preAverage: 2, postAverage: 4.4, delta: 2.4, scaleImprovementPercentage: 60, potentialImprovementPercentage: 80, weightedPreContribution: 1.2, weightedPostContribution: 2.64, weightedDeltaContribution: 1.44, distribution: { pre: [], post: [] } },
      { criterionId: "quality", name: "جودة الأداء", weight: 40, targetValue: 4, preAverage: 3.5, postAverage: 3.2, delta: -0.3, scaleImprovementPercentage: -7.5, potentialImprovementPercentage: -20, weightedPreContribution: 1.4, weightedPostContribution: 1.28, weightedDeltaContribution: -0.12, distribution: { pre: [], post: [] } },
    ], participantChanges: [], aggregates: { weightedPreScore: 2.6, weightedPostScore: 3.8, weightedDelta: 1.2, overallScaleImprovementPercentage: 30, potentialImprovementPercentage: 50, impactScore: 1.2, managerAssessmentCompletionPercentage: 100 }, teacherAggregates: { responseCount: 8, responseRatePercentage: 80, evaluationAverage: 4.2, satisfactionIndex: 84, contentQualityAverage: 4, needFitAverage: 4, deliveryQualityAverage: 4, applicabilityAverage: 4, criterionAverages: [] }, compositeImpact: { outcomeWeight: 0.8, participantEvaluationWeight: 0.2, index: 40 }, ...overrides,
  };
}

function row(id: string, date: string, report: ReportPayload): ReportsOverviewRow { return { reportId: id, workshopId: `workshop-${id}`, title: `ورشة ${id}`, category: "القيادة", presenter: "مقدم", status: "COMPLETED", generatedAt: new Date(date), workshopDate: new Date(date), payload: report }; }

describe("decision-ready reporting", () => {
  it("resolves configurable impact bands without turning them into scientific claims", () => {
    expect(resolveImpactBand(60)?.id).toBe("high");
    expect(resolveImpactBand(25)?.id).toBe("good");
    expect(resolveImpactBand(0)?.id).toBe("flat");
    expect(resolveImpactBand(-7)?.id).toBe("decline");
    expect(resolveImpactBand(null)).toBeNull();
  });

  it("builds an executive summary and reports target achievement separately", () => {
    const result = buildExecutiveSummary(payload());
    expect(result.participantCount).toBe(10);
    expect(result.overallChange).toBe(30);
    expect(result.bestCriterion?.name).toBe("تطبيق المعرفة");
    expect(result.lowestCriterion?.name).toBe("جودة الأداء");
    expect(result.goals).toEqual({ status: "partial", achievedCount: 1, totalCount: 2 });
    expect(result.participantEvaluation).toMatchObject({ average: 4.2, satisfaction: 84, responseRate: 80 });
  });

  it("selects at most five reports for comparison and exposes decision metrics", () => {
    const rows = ["a", "b", "c", "d", "e", "f"].map((id, index) => row(id, `2026-0${index + 1}-01T00:00:00.000Z`, payload({ participantCount: index + 1 })));
    const result = buildReportComparison(rows, rows.map((item) => item.reportId));
    expect(result).toHaveLength(5);
    expect(result[0]).toMatchObject({ title: "ورشة a", participantCount: 1, impact: 30, pre: 2.6, post: 3.8, teacherAverage: 4.2, responseRate: 80 });
  });

  it("builds repeated criterion trends and marks a consistently non-improving area", () => {
    const reports = [
      row("jan", "2026-01-01T00:00:00.000Z", payload()),
      row("mar", "2026-03-01T00:00:00.000Z", payload({ criteria: [payload().criteria[0], { ...payload().criteria[1], scaleImprovementPercentage: 0, delta: 0 }] })),
      row("may", "2026-05-01T00:00:00.000Z", payload({ criteria: [payload().criteria[0], { ...payload().criteria[1], scaleImprovementPercentage: -5, delta: -0.2 }] })),
    ];
    const trends = buildCriterionTrends(reports);
    expect(trends.find((item) => item.name === "جودة الأداء")?.points).toHaveLength(3);
    expect(trends.find((item) => item.name === "جودة الأداء")?.followUp).toBe(true);
    expect(trends.find((item) => item.name === "تطبيق المعرفة")?.followUp).toBe(false);
  });
});
