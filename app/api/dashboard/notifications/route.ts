import { NextResponse } from "next/server";
import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { getNotificationCenter, markAllNotificationsRead, markNotificationRead } from "@/src/lib/notification-service";

export async function GET() {
  const session = await requireDashboardContext({ allowSetup: true });
  if (!session.membership) return NextResponse.json({ items: [], unreadCount: 0 });
  return NextResponse.json(await getNotificationCenter(session.membership.schoolId));
}

export async function PATCH(request: Request) {
  const session = await requireDashboardContext({ allowSetup: true });
  if (!session.membership) return NextResponse.json({ error: "لا توجد مدرسة مرتبطة بالحساب" }, { status: 409 });
  const body = await request.json().catch(() => null) as { id?: string; all?: boolean } | null;
  if (body?.all) await markAllNotificationsRead(session.membership.schoolId);
  else if (body?.id) await markNotificationRead(session.membership.schoolId, body.id);
  else return NextResponse.json({ error: "الإشعار غير محدد" }, { status: 400 });
  return NextResponse.json(await getNotificationCenter(session.membership.schoolId));
}
