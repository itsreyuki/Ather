import { UserRole } from "@prisma/client";
import { db } from "./db";
import { requireMembershipPermission } from "./permissions";
import type { Permission as PermissionType } from "./permissions";

export async function requireUserSchoolPermission(userId: string, schoolId: string, permission: PermissionType) {
  const membership = await db.schoolMembership.findFirst({
    where: { userId, schoolId, status: "ACTIVE" },
    select: { id: true, userId: true, schoolId: true, role: true, status: true },
  });
  if (!membership) throw new Error("FORBIDDEN");
  return requireMembershipPermission(membership, permission);
}

export async function requireSchoolAccess(userId: string, schoolId: string, roles?: UserRole[]) {
  const membership = await db.schoolMembership.findFirst({
    where: { userId, schoolId, status: "ACTIVE", ...(roles?.length ? { role: { in: roles } } : {}) },
    select: { id: true, userId: true, schoolId: true, role: true },
  });
  if (!membership) throw new Error("FORBIDDEN");
  return membership;
}

export async function writeAuditLog(input: {
  schoolId?: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  return db.auditLog.create({
    data: {
      schoolId: input.schoolId,
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata: input.metadata,
    },
  });
}
