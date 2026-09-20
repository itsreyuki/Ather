import { describe, expect, it } from "vitest";
import { FOLLOW_UP_OFFSETS, getFollowUpDueAt, isSupportedFollowUpOffset } from "../src/lib/follow-up-measurement";

describe("follow-up measurement architecture", () => {
  it("supports the planned 30/60/90 day offsets", () => {
    expect(FOLLOW_UP_OFFSETS).toEqual([30, 60, 90]);
    expect(isSupportedFollowUpOffset(60)).toBe(true);
    expect(isSupportedFollowUpOffset(45)).toBe(false);
  });

  it("calculates due dates without changing the completion date", () => {
    const completedAt = new Date("2026-08-15T00:00:00.000Z");
    expect(getFollowUpDueAt(completedAt, 30).toISOString()).toBe("2026-09-14T00:00:00.000Z");
    expect(completedAt.toISOString()).toBe("2026-08-15T00:00:00.000Z");
  });
});
