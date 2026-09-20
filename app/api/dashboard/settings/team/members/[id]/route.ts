import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/src/lib/auth";
import { hasPermission, requireMembershipPermission, Permission } from "@/src/lib/permissions";
import { db } from "@/src/lib/db";

const schema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  if (!session.membership) return NextResponse.json({ error: "لا توجد مدرسة مرتبطة بالحساب" }, { status: 403 });
  try { requireMembershipPermission(session.membership, Permission.TeamManage); } catch { return NextResponse.json({ error: "لا تملك صلاحية إدارة أعضاء الفريق" }, { status: 403 }); }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "حالة العضو غير صالحة" }, { status: 400 });
  const { id } = await params;
  const member = await db.schoolMembership.findFirst({ where: { id, schoolId: session.membership.schoolId }, select: { id: true, userId: true, role: true, status: true } });
  if (!member) return NextResponse.json({ error: "العضو غير موجود" }, { status: 404 });
  if (hasPermission(member.role, Permission.TeamManage)) return NextResponse.json({ error: "لا يمكن إيقاف مالك المدرسة أو تغيير حالته" }, { status: 403 });
  if (member.userId === session.user.id) return NextResponse.json({ error: "لا يمكنك إيقاف عضويتك بنفسك" }, { status: 400 });
  await db.$transaction(async (tx) => {
    await tx.schoolMembership.update({ where: { id: member.id }, data: { status: parsed.data.status } });
    await tx.auditLog.create({ data: { schoolId: session.membership!.schoolId, userId: session.user.id, action: parsed.data.status === "SUSPENDED" ? "TEAM_MEMBER_SUSPENDED" : "TEAM_MEMBER_REACTIVATED", entity: "SchoolMembership", entityId: member.id, metadata: { role: member.role } } });
  });
  return NextResponse.json({ updated: true });
}
