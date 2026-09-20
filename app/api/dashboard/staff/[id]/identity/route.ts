import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/src/lib/auth";
import { assertApiPermission } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";
import { nationalIdLookupHash, normalizeNoorUsername } from "@/src/lib/security";
import { staffOverrideFields } from "@/src/lib/staff-overrides";

const identitySchema = z.object({
  nationalId: z.string().trim().min(3).max(64),
  confirmation: z.literal("تغيير اسم المستخدم"),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session?.membership) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const denied = assertApiPermission(session, Permission.SchoolSecurityManage);
  if (denied) return denied;
  const { id } = await params;
  const parsed = identitySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "اكتب عبارة التأكيد المطلوبة واسم مستخدم صالحًا" }, { status: 400 });
  const nationalId = normalizeNoorUsername(parsed.data.nationalId);
  if (!/^[\p{L}\p{N}._-]{3,64}$/u.test(nationalId))
    return NextResponse.json({ error: "اسم المستخدم في نور غير صالح" }, { status: 400 });
  const staff = await db.staffMember.findFirst({
    where: { id, schoolId: session.membership.schoolId },
    select: { id: true, nationalIdHash: true, nationalIdLast4: true, manualOverrideFields: true },
  });
  if (!staff) return NextResponse.json({ error: "لم يتم العثور على المنسوب" }, { status: 404 });
  const hash = nationalIdLookupHash(nationalId);
  const conflict = await db.staffMember.findFirst({
    where: { schoolId: session.membership.schoolId, nationalIdHash: hash, id: { not: staff.id } },
    select: { id: true },
  });
  if (conflict)
    return NextResponse.json({ error: "اسم المستخدم في نور مستخدم لمنسوب آخر في المدرسة" }, { status: 409 });
  await db.$transaction(async (tx) => {
    await tx.staffMember.update({
      where: { id: staff.id },
      data: {
        nationalIdHash: hash,
        nationalIdLast4: nationalId.slice(-4),
        manualOverrideFields: [...new Set([...staffOverrideFields(staff.manualOverrideFields), "nationalId"])],
      },
    });
    await tx.auditLog.create({
      data: {
        schoolId: session.membership!.schoolId,
        userId: session.user.id,
        action: "STAFF_IDENTITY_CORRECTED",
        entity: "StaffMember",
        entityId: staff.id,
        metadata: {
          field: "nationalId",
          oldLast4: staff.nationalIdLast4,
          newLast4: nationalId.slice(-4),
          source: "MANUAL_UPDATE",
        },
      },
    });
  });
  return NextResponse.json({ updated: true, nationalIdLast4: nationalId.slice(-4) });
}
