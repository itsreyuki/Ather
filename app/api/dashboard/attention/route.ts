import { NextResponse } from "next/server";
import { getSessionContext } from "@/src/lib/auth";
import { writeAuditLog } from "@/src/lib/authorization";
import { isCurrentDashboardAttention } from "@/src/lib/dashboard-data";
import { requireMembershipPermission, Permission } from "@/src/lib/permissions";
import { db } from "@/src/lib/db";

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session?.membership) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  try {
    requireMembershipPermission(session.membership, Permission.StaffRead);
  } catch {
    return NextResponse.json({ error: "لا تملك الصلاحية لتنفيذ هذا الإجراء" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { alertKey?: unknown; fingerprint?: unknown } | null;
  const alertKey = typeof body?.alertKey === "string" ? body.alertKey : "";
  const fingerprint = typeof body?.fingerprint === "string" ? body.fingerprint : "";
  if (!/^[a-z0-9:-]{1,120}$/.test(alertKey) || !/^[a-z0-9:_-]{1,200}$/i.test(fingerprint)) {
    return NextResponse.json({ error: "التنبيه غير صالح" }, { status: 400 });
  }
  if (!(await isCurrentDashboardAttention(session.membership.schoolId, alertKey, fingerprint))) {
    return NextResponse.json({ error: "لم يعد هذا التنبيه قائمًا" }, { status: 409 });
  }

  await db.dashboardAlertDismissal.upsert({
    where: { schoolId_alertKey_fingerprint: { schoolId: session.membership.schoolId, alertKey, fingerprint } },
    create: { schoolId: session.membership.schoolId, alertKey, fingerprint, dismissedByUserId: session.user.id },
    update: { dismissedByUserId: session.user.id, dismissedAt: new Date() },
  });
  await writeAuditLog({
    schoolId: session.membership.schoolId,
    userId: session.user.id,
    action: "DASHBOARD_ALERT_DISMISSED",
    entity: "DashboardAlertDismissal",
    metadata: { alertKey },
  });
  return NextResponse.json({ dismissed: true });
}
