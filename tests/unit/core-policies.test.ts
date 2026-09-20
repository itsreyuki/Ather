import { describe, expect, it } from "vitest";
import { validateCriteriaWeights, distributeCriteriaWeights } from "../../src/lib/criteria";
import { getWorkshopEffectiveState } from "../../src/lib/workshop";
import { nationalIdLookupHash, normalizeNationalId, normalizePhone } from "../../src/lib/security";

process.env.ID_LOOKUP_SECRET ??= Buffer.from("unit-test-id-lookup-secret-32-bytes").toString("base64");

describe("core domain policies", () => {
  it("validates criterion weights and distributes rounding residue", () => {
    expect(validateCriteriaWeights([]).code).toBe("CRITERIA_REQUIRED");
    expect(validateCriteriaWeights([{ weight: 50 }, { weight: 49.98 }]).code).toBe("CRITERIA_WEIGHTS_MUST_SUM_TO_100");
    expect(validateCriteriaWeights([{ weight: 50 }, { weight: 50 }]).ok).toBe(true);
    expect(distributeCriteriaWeights(3)).toEqual([33.33, 33.33, 33.34]);
    expect(distributeCriteriaWeights(0)).toEqual([]);
  });

  it("has deterministic workshop boundary transitions", () => {
    const workshop = { finalizedAt: new Date("2026-08-15T09:00:00Z"), cancelledAt: null, startsAt: new Date("2026-08-15T10:00:00Z"), endsAt: new Date("2026-08-15T12:00:00Z"), postAssessmentSubmittedAt: null };
    expect(getWorkshopEffectiveState(workshop, new Date("2026-08-15T10:00:00Z"))).toBe("IN_PROGRESS");
    expect(getWorkshopEffectiveState(workshop, new Date("2026-08-15T12:00:00Z"))).toBe("POST_ASSESSMENT_AVAILABLE");
    expect(getWorkshopEffectiveState({ ...workshop, cancelledAt: new Date("2026-08-15T11:00:00Z") }, new Date("2026-08-15T13:00:00Z"))).toBe("CANCELLED");
  });

  it("normalizes contacts and keeps identity lookup opaque", () => {
    expect(normalizeNationalId(" 123-456-7890 ")).toBe("123-456-7890");
    expect(normalizePhone(" +966 (50) 123-4567 ")).toBe("+966501234567");
    const first = nationalIdLookupHash("1234567890");
    expect(first).toBe(nationalIdLookupHash(" 1234567890 "));
    expect(first).not.toContain("1234567890");
  });

});
