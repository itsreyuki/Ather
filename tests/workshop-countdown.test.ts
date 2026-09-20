import { describe, expect, it } from "vitest";
import { getWorkshopCountdown, getWorkshopEffectiveState } from "../src/lib/workshop";
import { parseWorkshopDate, validateWorkshopSchedule } from "../src/lib/workshop-schedule";

const base = { finalizedAt: new Date("2026-08-10T08:00:00Z"), cancelledAt: null, startsAt: new Date("2026-08-15T10:00:00Z"), endsAt: new Date("2026-08-15T12:00:00Z"), postAssessmentSubmittedAt: null };

describe("server workshop time helpers", () => {
  it("derives scheduled, in-progress, and post states from server time", () => {
    expect(getWorkshopEffectiveState(base, new Date("2026-08-15T09:00:00Z"))).toBe("SCHEDULED");
    expect(getWorkshopEffectiveState(base, new Date("2026-08-15T11:00:00Z"))).toBe("IN_PROGRESS");
    expect(getWorkshopEffectiveState(base, new Date("2026-08-15T13:00:00Z"))).toBe("POST_ASSESSMENT_AVAILABLE");
  });

  it("returns a target and server timestamp without mutating workshop state", () => {
    const result = getWorkshopCountdown(base, new Date("2026-08-15T09:00:00Z"));
    expect(result.targetAt).toBe("2026-08-15T10:00:00.000Z");
    expect(result.serverNow).toBe("2026-08-15T09:00:00.000Z");
    expect(base.postAssessmentSubmittedAt).toBeNull();
  });

  it("parses datetime-local deterministically and rejects invalid schedules", () => {
    expect(parseWorkshopDate("2026-08-15T10:00")?.toISOString()).toBe("2026-08-15T10:00:00.000Z");
    const start = new Date("2026-08-15T10:00:00Z");
    expect(validateWorkshopSchedule({ startsAt: start, endsAt: new Date("2026-08-15T09:00:00Z") }).code).toBe("WORKSHOP_END_BEFORE_START");
    expect(validateWorkshopSchedule({ startsAt: null, endsAt: null }).code).toBe("WORKSHOP_DATES_REQUIRED");
  });
});
