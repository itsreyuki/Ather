import type { UserRole } from "@prisma/client";

export const Permission = {
  SchoolSettingsManage: "school.settings.manage",
  SchoolSecurityManage: "school.security.manage",
  SchoolOwnershipTransfer: "school.ownership.transfer",
  StaffRead: "staff.read",
  StaffWrite: "staff.write",
  WorkshopsRead: "workshops.read",
  WorkshopsCreate: "workshops.create",
  WorkshopsWrite: "workshops.write",
  WorkshopsDelete: "workshops.delete",
  WorkshopsFinalize: "workshops.finalize",
  ReportsRead: "reports.read",
  ReportsExportParticipants: "reports.export.participants",
  AuditRead: "audit.read",
  TeamManage: "team.manage",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

const permissionsByRole: Record<UserRole, readonly Permission[]> = {
  SCHOOL_OWNER: Object.values(Permission),
  SCHOOL_ADMIN: [Permission.StaffRead, Permission.StaffWrite, Permission.WorkshopsRead, Permission.WorkshopsCreate, Permission.WorkshopsWrite, Permission.WorkshopsFinalize, Permission.WorkshopsDelete, Permission.ReportsRead, Permission.AuditRead],
};

export function hasPermission(role: UserRole, permission: Permission) {
  return permissionsByRole[role].includes(permission);
}

export function requireMembershipPermission(membership: { role: UserRole; status?: string }, permission: Permission) {
  if (membership.status && membership.status !== "ACTIVE") throw new Error("FORBIDDEN");
  if (!hasPermission(membership.role, permission)) throw new Error("FORBIDDEN");
  return membership;
}
