import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/src/lib/auth";
import { assertApiPermission } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";
import { encryptField, normalizeEmail, normalizePhone, phoneLookupHash } from "@/src/lib/security";
import { staffOverrideFields } from "@/src/lib/staff-overrides";

const updateSchema = z
  .object({
    phone: z.string().trim().max(30).optional(),
    email: z.string().trim().max(200).optional(),
    jobTitle: z.string().trim().max(200).optional(),
    specialization: z.string().trim().max(200).optional(),
  })
  .strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session?.membership) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const denied = assertApiPermission(session, Permission.StaffWrite);
  if (denied) return denied;
  const { id } = await params;
  const staff = await db.staffMember.findFirst({
    where: { id, schoolId: session.membership.schoolId },
    select: { id: true, phoneEncrypted: true, manualOverrideFields: true },
  });
  if (!staff) return NextResponse.json({ error: "لم يتم العثور على المنسوب" }, { status: 404 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "بيانات التعديل غير صالحة" }, { status: 400 });
  const input = parsed.data;
  const data: {
    phoneEncrypted?: string | null;
    phoneLookupHash?: string | null;
    phoneLast4?: string | null;
    email?: string | null;
    jobTitle?: string | null;
    specialization?: string | null;
    manualOverrideFields?: string[];
  } = {};
  const fields: string[] = [];
  if (input.phone !== undefined) {
    const phone = normalizePhone(input.phone);
    if (phone && !/^\+?\d{7,15}$/.test(phone))
      return NextResponse.json({ error: "رقم الجوال غير صالح" }, { status: 400 });
    data.phoneEncrypted = phone ? encryptField(phone) : null;
    data.phoneLookupHash = phone ? phoneLookupHash(phone) : null;
    data.phoneLast4 = phone ? phone.slice(-4) : null;
    fields.push("phone");
  }
  if (input.email !== undefined) {
    const email = normalizeEmail(input.email);
    if (email && !/^\S+@\S+\.\S+$/.test(email))
      return NextResponse.json({ error: "البريد الإلكتروني غير صالح" }, { status: 400 });
    data.email = email || null;
    fields.push("email");
  }
  if (input.jobTitle !== undefined) {
    data.jobTitle = input.jobTitle || null;
    fields.push("jobTitle");
  }
  if (input.specialization !== undefined) {
    data.specialization = input.specialization || null;
    fields.push("specialization");
  }
  if (!fields.length) return NextResponse.json({ error: "لم يتم إرسال أي تعديل" }, { status: 400 });
  data.manualOverrideFields = [...new Set([...staffOverrideFields(staff.manualOverrideFields), ...fields])];
  await db.$transaction(async (tx) => {
    await tx.staffMember.update({ where: { id: staff.id }, data });
    await tx.auditLog.create({
      data: {
        schoolId: session.membership!.schoolId,
        userId: session.user.id,
        action: fields.includes("phone") ? "STAFF_PHONE_CORRECTED" : "STAFF_MANUALLY_UPDATED",
        entity: "StaffMember",
        entityId: staff.id,
        metadata: { fields, source: "MANUAL_UPDATE" },
      },
    });
  });
  return NextResponse.json({ updated: true, fields });
}
