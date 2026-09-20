export { average, compositeImpact, criterionMetric } from "./impact-measurement-service";
export type { Score } from "./impact-measurement-service";

export const ratingLabels: Record<1 | 2 | 3 | 4 | 5, string> = { 1: "منخفض جدًا", 2: "منخفض", 3: "متوسط", 4: "مرتفع", 5: "مرتفع جدًا" };
