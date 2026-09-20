import { NextResponse } from "next/server";
import { getSessionContext } from "@/src/lib/auth";
import { assertApiPermission } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session?.membership)
    return NextResponse.json({ error: "لا توجد مدرسة نشطة لهذا الحساب" }, { status: 401 });
  const denied = assertApiPermission(session, Permission.StaffWrite);
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { staffIds?: unknown } | null;
  const staffIds = Array.isArray(body?.staffIds)
    ? body.staffIds.filter((id): id is string => typeof id === "string").slice(0, 1000)
    : [];
  if (!staffIds.length) return NextResponse.json({ error: "لم يتم تحديد سجلات للتعطيل" }, { status: 400 });
  const result = await db.$transaction(async (tx) => {
    const update = await tx.staffMember.updateMany({
      where: { id: { in: staffIds }, schoolId: session.membership!.schoolId, active: true },
      data: { active: false },
    });
    await tx.auditLog.create({
      data: {
        schoolId: session.membership!.schoolId,
        userId: session.user.id,
        action: "STAFF_MARKED_INACTIVE_AFTER_IMPORT_DIFF",
        entity: "StaffMember",
        metadata: { count: update.count },
      },
    });
    return update.count;
  });
  return NextResponse.json({ deactivated: result });
}
