export type ReportDistribution = { score: 1 | 2 | 3 | 4 | 5; count: number; percentage: number | null };
export type ReportCriterion = { criterionId: string; name: string; category?: string | null; weight: number; targetValue: number | null; preAverage: number | null; postAverage: number | null; delta: number | null; scaleImprovementPercentage: number | null; potentialImprovementPercentage: number | null; weightedPreContribution: number | null; weightedPostContribution: number | null; weightedDeltaContribution: number | null; distribution: { pre: ReportDistribution[]; post: ReportDistribution[] } };
export type ReportParticipantChange = { participantId: string; fullName?: string; jobTitle?: string | null; preWeightedScore: number | null; postWeightedScore: number | null; delta: number | null };
export type ReportPayload = { generatedAt: string; engineVersion: string; participantCount: number; criteria: ReportCriterion[]; participantChanges: ReportParticipantChange[]; aggregates: { weightedPreScore: number | null; weightedPostScore: number | null; weightedDelta: number | null; overallScaleImprovementPercentage: number | null; potentialImprovementPercentage: number | null; impactScore: number | null; managerAssessmentCompletionPercentage: number | null }; teacherAggregates: { responseCount: number; responseRatePercentage: number | null; evaluationAverage: number | null; satisfactionIndex: number | null; contentQualityAverage: number | null; needFitAverage: number | null; deliveryQualityAverage: number | null; applicabilityAverage: number | null; criterionAverages: Array<{ criterionId: string; average: number | null }> }; compositeImpact: { outcomeWeight: number; participantEvaluationWeight: number; index: number | null }; workshop?: { id?: string; title?: string; description?: string | null; facilitator?: string | null; providerOrganization?: string | null; category?: string | null; startsAt?: string | null; endsAt?: string | null; objectives?: string | null }; school?: { id?: string; name?: string; ministryCode?: string; educationAdministration?: string; region?: string; city?: string; educationStage?: string; schoolType?: string; genderType?: string } };

function objectValue(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function numberValue(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function stringValue(value: unknown, fallback: string) { return typeof value === "string" ? value : fallback; }
function distributionValue(value: unknown, key: "pre" | "post"): ReportDistribution[] {
  const source = Array.isArray(value) ? value : [];
  return ([1, 2, 3, 4, 5] as const).map((score, index) => {
    const item = objectValue(source[index]);
    const count = numberValue(item?.count ?? item?.[key]) ?? 0;
    return { score, count, percentage: numberValue(item?.percentage) };
  });
}

export function normalizeReportPayload(value: unknown): ReportPayload | null {
  const root = objectValue(value);
  if (!root) return null;
  if (!Array.isArray(root.criteria) && !objectValue(root.aggregates) && typeof root.participantCount !== "number") return null;
  const criteria = (Array.isArray(root.criteria) ? root.criteria : []).map((item, index) => {
    const criterion = objectValue(item);
    const distributionRoot = objectValue(criterion?.distribution);
    const preDistribution = distributionValue(distributionRoot?.pre ?? criterion?.distribution, "pre");
    const postDistribution = distributionValue(distributionRoot?.post ?? criterion?.distribution, "post");
    return { criterionId: stringValue(criterion?.criterionId, `criterion-${index}`), name: stringValue(criterion?.name, "معيار"), weight: numberValue(criterion?.weight) ?? 0, targetValue: numberValue(criterion?.targetValue), preAverage: numberValue(criterion?.preAverage), postAverage: numberValue(criterion?.postAverage), delta: numberValue(criterion?.delta ?? criterion?.difference), scaleImprovementPercentage: numberValue(criterion?.scaleImprovementPercentage ?? criterion?.improvementOnScale), potentialImprovementPercentage: numberValue(criterion?.potentialImprovementPercentage ?? criterion?.potentialImprovement), weightedPreContribution: numberValue(criterion?.weightedPreContribution), weightedPostContribution: numberValue(criterion?.weightedPostContribution), weightedDeltaContribution: numberValue(criterion?.weightedDeltaContribution), distribution: { pre: preDistribution, post: postDistribution } };
  });
  const aggregates = objectValue(root.aggregates) ?? {};
  const teacher = objectValue(root.teacherAggregates) ?? objectValue(root.participantFeedback) ?? {};
  const composite = objectValue(root.compositeImpact) ?? {};
  const workshop = objectValue(root.workshop);
  const school = objectValue(root.school);
  const participantChanges = Array.isArray(root.participantChanges) ? root.participantChanges.flatMap((item) => { const row = objectValue(item); return row ? [{ participantId: stringValue(row.participantId, ""), fullName: typeof row.fullName === "string" ? row.fullName : undefined, jobTitle: typeof row.jobTitle === "string" ? row.jobTitle : null, preWeightedScore: numberValue(row.preWeightedScore), postWeightedScore: numberValue(row.postWeightedScore), delta: numberValue(row.delta) }] : []; }) : [];
  return { generatedAt: stringValue(root.generatedAt, ""), engineVersion: stringValue(root.engineVersion, "legacy"), participantCount: numberValue(root.participantCount) ?? 0, criteria, participantChanges, aggregates: { weightedPreScore: numberValue(aggregates.weightedPreScore), weightedPostScore: numberValue(aggregates.weightedPostScore), weightedDelta: numberValue(aggregates.weightedDelta), overallScaleImprovementPercentage: numberValue(aggregates.overallScaleImprovementPercentage), potentialImprovementPercentage: numberValue(aggregates.potentialImprovementPercentage), impactScore: numberValue(aggregates.impactScore), managerAssessmentCompletionPercentage: numberValue(aggregates.managerAssessmentCompletionPercentage) }, teacherAggregates: { responseCount: numberValue(teacher.responseCount ?? teacher.submittedCount) ?? 0, responseRatePercentage: numberValue(teacher.responseRatePercentage), evaluationAverage: numberValue(teacher.evaluationAverage ?? teacher.overallSatisfactionAverage), satisfactionIndex: numberValue(teacher.satisfactionIndex), contentQualityAverage: numberValue(teacher.contentQualityAverage), needFitAverage: numberValue(teacher.needFitAverage), deliveryQualityAverage: numberValue(teacher.deliveryQualityAverage), applicabilityAverage: numberValue(teacher.applicabilityAverage), criterionAverages: Array.isArray(teacher.criterionAverages) ? teacher.criterionAverages.flatMap((item) => { const row = objectValue(item); return row ? [{ criterionId: stringValue(row.criterionId, ""), average: numberValue(row.average) }] : []; }) : [] }, compositeImpact: { outcomeWeight: numberValue(composite.outcomeWeight) ?? 0.8, participantEvaluationWeight: numberValue(composite.participantEvaluationWeight) ?? 0.2, index: numberValue(composite.index) }, workshop: workshop ? { id: typeof workshop.id === "string" ? workshop.id : undefined, title: typeof workshop.title === "string" ? workshop.title : undefined, description: typeof workshop.description === "string" ? workshop.description : null, facilitator: typeof workshop.facilitator === "string" ? workshop.facilitator : null, providerOrganization: typeof workshop.providerOrganization === "string" ? workshop.providerOrganization : null, category: typeof workshop.category === "string" ? workshop.category : null, startsAt: typeof workshop.startsAt === "string" ? workshop.startsAt : null, endsAt: typeof workshop.endsAt === "string" ? workshop.endsAt : null, objectives: typeof workshop.objectives === "string" ? workshop.objectives : null } : undefined, school: school ? { id: typeof school.id === "string" ? school.id : undefined, name: typeof school.name === "string" ? school.name : undefined, ministryCode: typeof school.ministryCode === "string" ? school.ministryCode : undefined, educationAdministration: typeof school.educationAdministration === "string" ? school.educationAdministration : undefined, region: typeof school.region === "string" ? school.region : undefined, city: typeof school.city === "string" ? school.city : undefined, educationStage: typeof school.educationStage === "string" ? school.educationStage : undefined, schoolType: typeof school.schoolType === "string" ? school.schoolType : undefined, genderType: typeof school.genderType === "string" ? school.genderType : undefined } : undefined };
}

export type ReportInsights = { highest: string | null; lowest: string | null; exceededTargets: string[]; followUp: string[]; improvedParticipantPercentage: number | null };

export function buildReportInsights(report: ReportPayload): ReportInsights {
  const measurable = report.criteria.filter((criterion) => criterion.delta !== null);
  const highest = measurable.length ? [...measurable].sort((a, b) => (b.delta ?? -Infinity) - (a.delta ?? -Infinity))[0].name : null;
  const lowest = measurable.length ? [...measurable].sort((a, b) => (a.delta ?? Infinity) - (b.delta ?? Infinity))[0].name : null;
  const changes = report.participantChanges ?? [];
  const measuredChanges = changes.filter((change) => change.delta !== null);
  return { highest, lowest, exceededTargets: report.criteria.filter((criterion) => criterion.targetValue !== null && criterion.postAverage !== null && criterion.postAverage >= criterion.targetValue).map((criterion) => criterion.name), followUp: report.criteria.filter((criterion) => criterion.delta === null || (criterion.delta ?? 0) <= 0).map((criterion) => criterion.name), improvedParticipantPercentage: measuredChanges.length ? (measuredChanges.filter((change) => (change.delta ?? 0) > 0).length / measuredChanges.length) * 100 : null };
}

export type ReportsOverviewRow = { reportId: string; workshopId: string; title: string; category: string; presenter: string; status: string; generatedAt: Date; workshopDate?: Date | null; payload: ReportPayload };
export type ReportsOverview = { stats: { workshopCount: number; participantCount: number; averageImpact: number | null; comparisonCount: number }; trend: Array<{ label: string; impact: number | null; workshopCount: number }>; categories: Array<{ name: string; impact: number | null }>; needsFollowUp: ReportsOverviewRow[] };

export function buildReportsOverview(rows: ReportsOverviewRow[]): ReportsOverview {
  const average = (values: Array<number | null>) => { const valid = values.filter((value): value is number => value !== null && Number.isFinite(value)); return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null; };
  const trendMap = new Map<string, ReportsOverviewRow[]>();
  const categoryMap = new Map<string, ReportsOverviewRow[]>();
  for (const row of rows) { const date = new Intl.DateTimeFormat("ar-SA", { month: "short", year: "numeric" }).format(row.generatedAt); trendMap.set(date, [...(trendMap.get(date) ?? []), row]); const category = row.category || "غير مصنف"; categoryMap.set(category, [...(categoryMap.get(category) ?? []), row]); }
  const impact = (row: ReportsOverviewRow) => row.payload.aggregates.overallScaleImprovementPercentage;
  const trend = [...trendMap.entries()].map(([label, items]) => ({ label, impact: average(items.map(impact)), workshopCount: items.length }));
  const categories = [...categoryMap.entries()].map(([name, items]) => ({ name, impact: average(items.map(impact)) })).sort((a, b) => (b.impact ?? -Infinity) - (a.impact ?? -Infinity)).slice(0, 6);
  const needsFollowUp = rows.filter((row) => { const insights = buildReportInsights(row.payload); return insights.followUp.length > 0 || (row.payload.teacherAggregates.responseRatePercentage !== null && row.payload.teacherAggregates.responseRatePercentage < 50); });
  return { stats: { workshopCount: rows.length, participantCount: rows.reduce((sum, row) => sum + row.payload.participantCount, 0), averageImpact: average(rows.map(impact)), comparisonCount: rows.filter((row) => row.payload.aggregates.weightedPreScore !== null && row.payload.aggregates.weightedPostScore !== null).length }, trend, categories, needsFollowUp };
}

export type ImpactBand = { id: string; label: string; min: number | null; max: number | null; tone: "success" | "info" | "warning" | "neutral" | "error" };
export const DEFAULT_IMPACT_BANDS: ImpactBand[] = [
  { id: "high", label: "تحسن مرتفع", min: 50, max: null, tone: "success" },
  { id: "good", label: "تحسن جيد", min: 25, max: 50, tone: "info" },
  { id: "limited", label: "تحسن محدود", min: 5, max: 25, tone: "warning" },
  { id: "flat", label: "لا تغير جوهري", min: -5, max: 5, tone: "neutral" },
  { id: "decline", label: "تراجع", min: null, max: -5, tone: "error" },
];

export function resolveImpactBand(value: number | null, bands: ImpactBand[] = DEFAULT_IMPACT_BANDS): ImpactBand | null {
  if (value === null || !Number.isFinite(value)) return null;
  return bands.find((band) => (band.min === null || value >= band.min) && (band.max === null || value < band.max)) ?? null;
}

export type ExecutiveSummary = {
  participantCount: number;
  overallChange: number | null;
  bestCriterion: { name: string; change: number | null } | null;
  lowestCriterion: { name: string; change: number | null } | null;
  participantEvaluation: { average: number | null; satisfaction: number | null; responseRate: number | null };
  goals: { status: "achieved" | "partial" | "not-met" | "not-defined"; achievedCount: number; totalCount: number };
};

export function buildExecutiveSummary(report: ReportPayload): ExecutiveSummary {
  const measurable = report.criteria.filter((criterion) => criterion.delta !== null);
  const sorted = [...measurable].sort((a, b) => (b.scaleImprovementPercentage ?? -Infinity) - (a.scaleImprovementPercentage ?? -Infinity));
  const targets = report.criteria.filter((criterion) => criterion.targetValue !== null);
  const achievedCount = targets.filter((criterion) => criterion.postAverage !== null && criterion.postAverage >= criterion.targetValue!).length;
  const goalStatus = targets.length === 0 ? "not-defined" : achievedCount === targets.length ? "achieved" : achievedCount > 0 ? "partial" : "not-met";
  return {
    participantCount: report.participantCount,
    overallChange: report.aggregates.overallScaleImprovementPercentage,
    bestCriterion: sorted[0] ? { name: sorted[0].name, change: sorted[0].scaleImprovementPercentage } : null,
    lowestCriterion: sorted.at(-1) ? { name: sorted.at(-1)!.name, change: sorted.at(-1)!.scaleImprovementPercentage } : null,
    participantEvaluation: { average: report.teacherAggregates.evaluationAverage, satisfaction: report.teacherAggregates.satisfactionIndex, responseRate: report.teacherAggregates.responseRatePercentage },
    goals: { status: goalStatus, achievedCount, totalCount: targets.length },
  };
}

export type ReportComparisonRow = { reportId: string; workshopId: string; title: string; category: string; participantCount: number; pre: number | null; post: number | null; impact: number | null; teacherAverage: number | null; responseRate: number | null };

export function buildReportComparison(rows: ReportsOverviewRow[], selectedIds: string[]): ReportComparisonRow[] {
  const selected = selectedIds.length ? rows.filter((row) => selectedIds.includes(row.reportId)).slice(0, 5) : [];
  return selected.map((row) => ({ reportId: row.reportId, workshopId: row.workshopId, title: row.title, category: row.category, participantCount: row.payload.participantCount, pre: row.payload.aggregates.weightedPreScore, post: row.payload.aggregates.weightedPostScore, impact: row.payload.aggregates.overallScaleImprovementPercentage, teacherAverage: row.payload.teacherAggregates.evaluationAverage, responseRate: row.payload.teacherAggregates.responseRatePercentage }));
}

export type CriterionTrend = { key: string; name: string; points: Array<{ label: string; date: Date; improvement: number | null; workshopTitle: string }>; followUp: boolean };

export function buildCriterionTrends(rows: ReportsOverviewRow[]): CriterionTrend[] {
  const groups = new Map<string, CriterionTrend>();
  for (const row of rows) {
    const date = row.workshopDate ?? row.generatedAt;
    for (const criterion of row.payload.criteria) {
      const key = `${criterion.name.trim().toLocaleLowerCase("ar")}::${criterion.category ?? ""}`;
      const current = groups.get(key) ?? { key, name: criterion.name, points: [], followUp: false };
      current.points.push({ label: new Intl.DateTimeFormat("ar-SA", { month: "short", year: "numeric" }).format(date), date, improvement: criterion.scaleImprovementPercentage, workshopTitle: row.title });
      groups.set(key, current);
    }
  }
  return [...groups.values()].filter((trend) => trend.points.length >= 2).map((trend) => {
    const points = [...trend.points].sort((a, b) => a.date.getTime() - b.date.getTime());
    const values = points.map((point) => point.improvement).filter((value): value is number => value !== null);
    return { ...trend, points, followUp: values.length >= 2 && values.every((value) => value <= 0) };
  });
}
