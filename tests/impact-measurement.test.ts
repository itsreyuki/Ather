import { describe, expect, it } from "vitest";
import { ImpactMeasurementService, IMPACT_ENGINE_VERSION, criterionMetric } from "../src/lib/impact-measurement-service";

const criterion = (id: string, weight: number, preScores: number[], postScores: number[]) => ({ id, name: id, weight, preScores, postScores });

describe("ImpactMeasurementService", () => {
  it("calculates criterion averages, delta, scale improvement, potential improvement, and weighted contributions", () => {
    const result = ImpactMeasurementService.calculateCriterion(criterion("knowledge", 50, [2, 3], [4, 5]));
    expect(result.preAverage).toBe(2.5);
    expect(result.postAverage).toBe(4.5);
    expect(result.delta).toBe(2);
    expect(result.scaleImprovementPercentage).toBe(50);
    expect(result.potentialImprovementPercentage).toBe(80);
    expect(result.weightedPreContribution).toBe(1.25);
    expect(result.weightedPostContribution).toBe(2.25);
    expect(result.weightedDeltaContribution).toBe(1);
  });

  it("returns null for unavailable metrics instead of manufacturing numbers", () => {
    const result = ImpactMeasurementService.calculateCriterion(criterion("missing", 100, [], [4, 5]));
    expect(result.preAverage).toBeNull();
    expect(result.delta).toBeNull();
    expect(result.scaleImprovementPercentage).toBeNull();
    expect(result.potentialImprovementPercentage).toBeNull();
    expect(result.weightedPreContribution).toBeNull();
    expect(result.distribution.pre.every((bucket) => bucket.percentage === null)).toBe(true);
  });

  it("handles pre score 5 safely for potential improvement", () => {
    const result = ImpactMeasurementService.calculateCriterion(criterion("mastery", 100, [5, 5], [5, 4]));
    expect(result.preAverage).toBe(5);
    expect(result.delta).toBe(-0.5);
    expect(result.scaleImprovementPercentage).toBe(-12.5);
    expect(result.potentialImprovementPercentage).toBeNull();
  });

  it("builds complete distributions with counts and percentages", () => {
    const result = ImpactMeasurementService.calculateCriterion(criterion("distribution", 100, [1, 2, 2, 5], [3, 3, 4, 5]));
    expect(result.distribution.pre).toEqual([
      { score: 1, count: 1, percentage: 25 },
      { score: 2, count: 2, percentage: 50 },
      { score: 3, count: 0, percentage: 0 },
      { score: 4, count: 0, percentage: 0 },
      { score: 5, count: 1, percentage: 25 },
    ]);
    expect(result.distribution.post[2]).toEqual({ score: 3, count: 2, percentage: 50 });
  });

  it("calculates weighted workshop aggregates and participant-level changes", () => {
    const result = ImpactMeasurementService.measure({
      criteria: [criterion("a", 60, [2, 4], [4, 5]), criterion("b", 40, [3, 3], [4, 5])],
      participants: [
        { participantId: "p1", preScores: { a: 2, b: 3 }, postScores: { a: 4, b: 4 } },
        { participantId: "p2", preScores: { a: 4, b: 3 }, postScores: { a: 5, b: 5 } },
      ],
    });
    expect(result.engineVersion).toBe(IMPACT_ENGINE_VERSION);
    expect(result.participantCount).toBe(2);
    expect(result.aggregates.weightedPreScore).toBe(3);
    expect(result.aggregates.weightedPostScore).toBe(4.5);
    expect(result.aggregates.weightedDelta).toBe(1.5);
    expect(result.aggregates.overallScaleImprovementPercentage).toBe(37.5);
    expect(result.aggregates.potentialImprovementPercentage).toBe(75);
    expect(result.aggregates.impactScore).toBe(1.5);
    expect(result.aggregates.managerAssessmentCompletionPercentage).toBe(100);
    expect(result.participantChanges).toEqual([
      { participantId: "p1", preWeightedScore: 2.4, postWeightedScore: 4, delta: 1.6 },
      { participantId: "p2", preWeightedScore: 3.6, postWeightedScore: 5, delta: 1.4 },
    ]);
  });

  it("does not report complete weighted aggregates when a criterion is missing", () => {
    const result = ImpactMeasurementService.measure({ criteria: [criterion("a", 50, [2], [4]), criterion("b", 50, [], [4])], participants: [{ participantId: "p1", preScores: { a: 2 }, postScores: { a: 4, b: 4 } }] });
    expect(result.aggregates.weightedPreScore).toBeNull();
    expect(result.aggregates.weightedPostScore).toBe(4);
    expect(result.aggregates.overallScaleImprovementPercentage).toBeNull();
    expect(result.aggregates.managerAssessmentCompletionPercentage).toBe(50);
    expect(result.participantChanges[0]).toEqual({ participantId: "p1", preWeightedScore: null, postWeightedScore: 4, delta: null });
  });

  it("calculates teacher response count, rate, averages, satisfaction index, and criterion averages separately", () => {
    const result = ImpactMeasurementService.measure({
      criteria: [criterion("a", 100, [2], [4])],
      participants: [{ participantId: "p1", preScores: { a: 2 }, postScores: { a: 4 } }, { participantId: "p2", preScores: { a: 2 }, postScores: { a: 4 } }],
      teacherResponses: [{ overallSatisfaction: 4, contentQuality: 5, needFit: 4, deliveryQuality: 3, applicability: 4, criteria: { a: 5 } }],
    });
    expect(result.teacherAggregates.responseCount).toBe(1);
    expect(result.teacherAggregates.responseRatePercentage).toBe(50);
    expect(result.teacherAggregates.evaluationAverage).toBe(4);
    expect(result.teacherAggregates.satisfactionIndex).toBe(80);
    expect(result.teacherAggregates.contentQualityAverage).toBe(5);
    expect(result.teacherAggregates.criterionAverages).toEqual([{ criterionId: "a", average: 5 }]);
  });

  it("uses the default 80/20 composite only when both source metrics exist", () => {
    const base = { criteria: [criterion("a", 100, [2], [4])], participants: [{ participantId: "p1", preScores: { a: 2 }, postScores: { a: 4 } }], teacherResponses: [{ overallSatisfaction: 4 }] };
    const result = ImpactMeasurementService.measure(base);
    expect(result.compositeImpact).toEqual({ outcomeWeight: 0.8, participantEvaluationWeight: 0.2, index: 56 });
    expect(ImpactMeasurementService.measure({ ...base, teacherResponses: [] }).compositeImpact.index).toBeNull();
  });

  it("accepts a configurable composite and rejects invalid weights", () => {
    const input = { criteria: [criterion("a", 100, [2], [4])], participants: [{ participantId: "p1", preScores: { a: 2 }, postScores: { a: 4 } }], teacherResponses: [{ overallSatisfaction: 5 }] };
    expect(ImpactMeasurementService.measure({ ...input, composite: { outcomeWeight: 0.6, participantEvaluationWeight: 0.4 } }).compositeImpact.index).toBe(70);
    expect(() => ImpactMeasurementService.measure({ ...input, composite: { outcomeWeight: 0.7, participantEvaluationWeight: 0.4 } })).toThrow("COMPOSITE_WEIGHTS_MUST_SUM_TO_ONE");
  });

  it("ignores malformed scores and retains compatibility output", () => {
    const result = criterionMetric([0, 1, 6, 3], [2, 4, 9]);
    expect(result.preAverage).toBe(2);
    expect(result.postAverage).toBe(3);
    expect(result.difference).toBe(1);
    expect(result.improvementOnScale).toBe(25);
    expect(result.distribution[0]).toEqual({ score: 1, pre: 1, post: 0 });
  });
});
