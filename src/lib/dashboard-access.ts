import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { getSessionContext } from "./auth";
import { requireMembershipPermission, type Permission } from "./permissions";

export function assertApiPermission(session: { membership?: { role: UserRole; status?: string } | null } | null, permission: Permission) {
  if (!session?.membership) return NextResponse.json({ error: "لا توجد مدرسة مرتبطة بالحساب" }, { status: 403 });
  try { requireMembershipPermission(session.membership, permission); return null; } catch { return NextResponse.json({ error: "لا تملك الصلاحية لتنفيذ هذا الإجراء" }, { status: 403 }); }
}

export async function requireDashboardContext(options: { allowSetup?: boolean; permission?: Permission } = {}) {
  const session = await getSessionContext();
  if (!session) redirect("/auth/login");
  if (!session.membership) redirect("/onboarding");
  if (options.permission) {
    try { requireMembershipPermission(session.membership, options.permission); } catch { redirect("/dashboard"); }
  }
  if (!options.allowSetup && session.membership.school.setupStatus === "SETUP_REQUIRED") redirect("/onboarding/import");
  return session;
}
