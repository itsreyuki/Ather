export const CRITERIA_WEIGHT_TOLERANCE = 0.01;

export function criteriaWeightTotal(criteria: Array<{ weight: number }>) {
  return criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
}

export function validateCriteriaWeights(criteria: Array<{ weight: number }>) {
  if (!criteria.length) return { ok: false as const, code: "CRITERIA_REQUIRED", total: 0 };
  const total = criteriaWeightTotal(criteria);
  if (criteria.some((criterion) => !Number.isFinite(criterion.weight) || criterion.weight < 0 || criterion.weight > 100)) return { ok: false as const, code: "CRITERIA_WEIGHT_INVALID", total };
  if (Math.abs(total - 100) > CRITERIA_WEIGHT_TOLERANCE) return { ok: false as const, code: "CRITERIA_WEIGHTS_MUST_SUM_TO_100", total };
  return { ok: true as const, code: "OK", total };
}

export function distributeCriteriaWeights(count: number) {
  if (!Number.isInteger(count) || count <= 0) return [];
  const base = Math.floor((100 / count) * 100) / 100;
  const weights = Array.from({ length: count }, () => base);
  weights[weights.length - 1] = Math.round((100 - base * (count - 1)) * 100) / 100;
  return weights;
}
