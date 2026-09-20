export const IMPACT_ENGINE_VERSION = "impact-v1.0.0";
const SCALE_MIN = 1;
const SCALE_MAX = 5;
const SCALE_RANGE = SCALE_MAX - SCALE_MIN;

export type Score = 1 | 2 | 3 | 4 | 5;

export type CriterionMeasurementInput = {
  id: string;
  name: string;
  weight: number;
  targetValue?: number | null;
  preScores: number[];
  postScores: number[];
};

export type ParticipantMeasurementInput = {
  participantId: string;
  preScores: Record<string, number | null | undefined>;
  postScores: Record<string, number | null | undefined>;
};

export type TeacherResponseInput = {
  overallSatisfaction?: number | null;
  contentQuality?: number | null;
  needFit?: number | null;
  deliveryQuality?: number | null;
  applicability?: number | null;
  criteria?: Record<string, number | null | undefined>;
};

export type CompositeImpactConfig = {
  outcomeWeight?: number;
  participantEvaluationWeight?: number;
};

export type DistributionBucket = {
  score: Score;
  count: number;
  percentage: number | null;
};

export type CriterionMeasurement = {
  criterionId: string;
  name: string;
  weight: number;
  targetValue: number | null;
  preCount: number;
  postCount: number;
  preAverage: number | null;
  postAverage: number | null;
  delta: number | null;
  scaleImprovementPercentage: number | null;
  potentialImprovementPercentage: number | null;
  weightedPreContribution: number | null;
  weightedPostContribution: number | null;
  weightedDeltaContribution: number | null;
  distribution: { pre: DistributionBucket[]; post: DistributionBucket[] };
};

export type ParticipantChange = {
  participantId: string;
  preWeightedScore: number | null;
  postWeightedScore: number | null;
  delta: number | null;
};

export type ImpactMeasurementResult = {
  engineVersion: string;
  participantCount: number;
  criteria: CriterionMeasurement[];
  participantChanges: ParticipantChange[];
  aggregates: {
    weightedPreScore: number | null;
    weightedPostScore: number | null;
    weightedDelta: number | null;
    overallScaleImprovementPercentage: number | null;
    potentialImprovementPercentage: number | null;
    impactScore: number | null;
    managerAssessmentCompletionPercentage: number | null;
  };
  teacherAggregates: {
    responseCount: number;
    responseRatePercentage: number | null;
    evaluationAverage: number | null;
    satisfactionIndex: number | null;
    contentQualityAverage: number | null;
    needFitAverage: number | null;
    deliveryQualityAverage: number | null;
    applicabilityAverage: number | null;
    criterionAverages: Array<{ criterionId: string; average: number | null }>;
  };
  compositeImpact: {
    outcomeWeight: number;
    participantEvaluationWeight: number;
    index: number | null;
  };
};

function validScore(value: number | null | undefined): value is Score {
  if (typeof value !== "number" || !Number.isInteger(value)) return false;
  return value >= SCALE_MIN && value <= SCALE_MAX;
}

function validScores(values: number[]) {
  return values.filter(validScore);
}

export function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function roundMetric(value: number | null) {
  return value === null ? null : Number(value.toFixed(6));
}

function distribution(values: number[]): DistributionBucket[] {
  const safeValues = validScores(values);
  return ([1, 2, 3, 4, 5] as Score[]).map((score) => ({
    score,
    count: safeValues.filter((value) => value === score).length,
    percentage: safeValues.length ? roundMetric((safeValues.filter((value) => value === score).length / safeValues.length) * 100) : null,
  }));
}

function weightedScore(scores: Record<string, number | null | undefined>, criteria: Array<{ id: string; weight: number }>) {
  if (!criteria.length || criteria.some((criterion) => !validScore(scores[criterion.id]))) return null;
  return roundMetric(criteria.reduce((sum, criterion) => sum + (scores[criterion.id] as number) * (criterion.weight / 100), 0));
}

function normalizeCompositeConfig(config: CompositeImpactConfig = {}) {
  const outcomeWeight = config.outcomeWeight ?? 0.8;
  const participantEvaluationWeight = config.participantEvaluationWeight ?? 0.2;
  if (outcomeWeight < 0 || participantEvaluationWeight < 0 || Math.abs(outcomeWeight + participantEvaluationWeight - 1) > 0.000001) throw new Error("COMPOSITE_WEIGHTS_MUST_SUM_TO_ONE");
  return { outcomeWeight, participantEvaluationWeight };
}

export class ImpactMeasurementService {
  static calculateCriterion(input: CriterionMeasurementInput): CriterionMeasurement {
    const pre = validScores(input.preScores);
    const post = validScores(input.postScores);
    const preAverage = average(pre);
    const postAverage = average(post);
    const delta = preAverage === null || postAverage === null ? null : postAverage - preAverage;
    const potentialImprovementPercentage = preAverage === null || postAverage === null || preAverage >= SCALE_MAX ? null : roundMetric((delta! / (SCALE_MAX - preAverage)) * 100);
    const weight = Number.isFinite(input.weight) && input.weight >= 0 ? input.weight : 0;
    return {
      criterionId: input.id,
      name: input.name,
      weight,
      targetValue: input.targetValue ?? null,
      preCount: pre.length,
      postCount: post.length,
      preAverage: roundMetric(preAverage),
      postAverage: roundMetric(postAverage),
      delta: roundMetric(delta),
      scaleImprovementPercentage: delta === null ? null : roundMetric((delta / SCALE_RANGE) * 100),
      potentialImprovementPercentage,
      weightedPreContribution: preAverage === null ? null : roundMetric(preAverage * (weight / 100)),
      weightedPostContribution: postAverage === null ? null : roundMetric(postAverage * (weight / 100)),
      weightedDeltaContribution: delta === null ? null : roundMetric(delta * (weight / 100)),
      distribution: { pre: distribution(pre), post: distribution(post) },
    };
  }

  static measure(input: { criteria: CriterionMeasurementInput[]; participants: ParticipantMeasurementInput[]; teacherResponses?: TeacherResponseInput[]; composite?: CompositeImpactConfig }): ImpactMeasurementResult {
    const composite = normalizeCompositeConfig(input.composite);
    const criteria = input.criteria.map((criterion) => this.calculateCriterion(criterion));
    const criterionWeights = input.criteria.map((criterion) => ({ id: criterion.id, weight: criterion.weight }));
    const participantChanges = input.participants.map((participant) => {
      const preWeightedScore = weightedScore(participant.preScores, criterionWeights);
      const postWeightedScore = weightedScore(participant.postScores, criterionWeights);
      return { participantId: participant.participantId, preWeightedScore, postWeightedScore, delta: preWeightedScore === null || postWeightedScore === null ? null : roundMetric(postWeightedScore - preWeightedScore) };
    });
    const weightedPreScore = criteria.every((criterion) => criterion.preAverage !== null) ? roundMetric(criteria.reduce((sum, criterion) => sum + (criterion.weightedPreContribution ?? 0), 0)) : null;
    const weightedPostScore = criteria.every((criterion) => criterion.postAverage !== null) ? roundMetric(criteria.reduce((sum, criterion) => sum + (criterion.weightedPostContribution ?? 0), 0)) : null;
    const weightedDelta = weightedPreScore === null || weightedPostScore === null ? null : roundMetric(weightedPostScore - weightedPreScore);
    const overallScaleImprovementPercentage = weightedDelta === null ? null : roundMetric((weightedDelta / SCALE_RANGE) * 100);
    const potentialImprovementPercentage = weightedPreScore === null || weightedPostScore === null || weightedPreScore >= SCALE_MAX ? null : roundMetric((weightedDelta! / (SCALE_MAX - weightedPreScore)) * 100);
    const expectedManagerAssessments = input.participants.length * input.criteria.length;
    const completedManagerAssessments = input.participants.reduce((count, participant) => count + input.criteria.filter((criterion) => validScore(participant.preScores[criterion.id]) && validScore(participant.postScores[criterion.id])).length, 0);
    const managerAssessmentCompletionPercentage = expectedManagerAssessments ? roundMetric((completedManagerAssessments / expectedManagerAssessments) * 100) : null;
    const teacherResponses = input.teacherResponses ?? [];
    const teacherEvaluationAverage = average(teacherResponses.flatMap((response) => validScore(response.overallSatisfaction) ? [response.overallSatisfaction] : []));
    const satisfactionIndex = teacherEvaluationAverage === null ? null : roundMetric((teacherEvaluationAverage / SCALE_MAX) * 100);
    const teacherAverage = (field: keyof Omit<TeacherResponseInput, "criteria">) => average(teacherResponses.flatMap((response) => validScore(response[field] as number | null | undefined) ? [response[field] as number] : []));
    const criterionAverages = input.criteria.map((criterion) => ({ criterionId: criterion.id, average: average(teacherResponses.flatMap((response) => validScore(response.criteria?.[criterion.id]) ? [response.criteria[criterion.id] as number] : [])) }));
    return {
      engineVersion: IMPACT_ENGINE_VERSION,
      participantCount: input.participants.length,
      criteria,
      participantChanges,
      aggregates: { weightedPreScore, weightedPostScore, weightedDelta, overallScaleImprovementPercentage, potentialImprovementPercentage, impactScore: weightedDelta, managerAssessmentCompletionPercentage },
      teacherAggregates: { responseCount: teacherResponses.length, responseRatePercentage: input.participants.length ? roundMetric((teacherResponses.length / input.participants.length) * 100) : null, evaluationAverage: roundMetric(teacherEvaluationAverage), satisfactionIndex, contentQualityAverage: roundMetric(teacherAverage("contentQuality")), needFitAverage: roundMetric(teacherAverage("needFit")), deliveryQualityAverage: roundMetric(teacherAverage("deliveryQuality")), applicabilityAverage: roundMetric(teacherAverage("applicability")), criterionAverages: criterionAverages.map((item) => ({ ...item, average: roundMetric(item.average) })) },
      compositeImpact: { ...composite, index: overallScaleImprovementPercentage === null || satisfactionIndex === null ? null : roundMetric(overallScaleImprovementPercentage * composite.outcomeWeight + satisfactionIndex * composite.participantEvaluationWeight) },
    };
  }
}

export function criterionMetric(pre: number[], post: number[]) {
  const metric = ImpactMeasurementService.calculateCriterion({ id: "criterion", name: "", weight: 100, preScores: pre, postScores: post });
  return { preAverage: metric.preAverage, postAverage: metric.postAverage, difference: metric.delta, changePoints: metric.delta, improvementOnScale: metric.scaleImprovementPercentage, potentialImprovement: metric.potentialImprovementPercentage, distribution: [1, 2, 3, 4, 5].map((score) => ({ score, pre: metric.distribution.pre[score - 1].count, post: metric.distribution.post[score - 1].count })) };
}

export function compositeImpact(prePostImprovement: number, teacherRating: number, prePostWeight = 0.8) {
  const config = normalizeCompositeConfig({ outcomeWeight: prePostWeight, participantEvaluationWeight: 1 - prePostWeight });
  return prePostImprovement * config.outcomeWeight + teacherRating * config.participantEvaluationWeight;
}
