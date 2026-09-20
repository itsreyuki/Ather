import { describe, expect, it } from "vitest";
import { hasPermission, Permission } from "../src/lib/permissions";

describe("centralized school permissions", () => {
  it("gives the owner full access", () => {
    expect(Object.values(Permission).every((permission) => hasPermission("SCHOOL_OWNER", permission))).toBe(true);
  });

  it("limits admins to operational school work", () => {
    expect(hasPermission("SCHOOL_ADMIN", Permission.StaffWrite)).toBe(true);
    expect(hasPermission("SCHOOL_ADMIN", Permission.WorkshopsFinalize)).toBe(true);
    expect(hasPermission("SCHOOL_ADMIN", Permission.ReportsRead)).toBe(true);
    expect(hasPermission("SCHOOL_ADMIN", Permission.ReportsExportParticipants)).toBe(false);
    expect(hasPermission("SCHOOL_ADMIN", Permission.TeamManage)).toBe(false);
    expect(hasPermission("SCHOOL_ADMIN", Permission.SchoolOwnershipTransfer)).toBe(false);
    expect(hasPermission("SCHOOL_ADMIN", Permission.SchoolSecurityManage)).toBe(false);
  });
});
