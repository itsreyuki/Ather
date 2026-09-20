import { describe, expect, it } from "vitest";
import { retentionPolicy } from "../src/lib/retention";

describe("privacy retention policy", () => {
  it("clamps retention settings and never enables automatic deletion", () => {
    expect(retentionPolicy({ auditRetentionDays: 1, disabledStaffRetentionDays: 99999 })).toEqual({ auditRetentionDays: 30, disabledStaffRetentionDays: 3650, piiRetentionMode: "REVIEW_REQUIRED", automaticDeletion: false });
  });
});
