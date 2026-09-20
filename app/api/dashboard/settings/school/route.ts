import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/src/lib/auth";
import { requireMembershipPermission, Permission } from "@/src/lib/permissions";
import { db } from "@/src/lib/db";
import { encryptField, normalizePhone } from "@/src/lib/security";

const schema = z.object({ name: z.string().trim().min(2).max(200).optional(), educationAdministration: z.string().trim().min(2).max(200).optional(), educationOffice: z.string().trim().max(200).optional(), region: z.string().trim().min(2).max(120).optional(), city: z.string().trim().min(2).max(120).optional(), principalName: z.string().trim().min(2).max(200).optional(), officialPhone: z.string().trim().max(30).optional() }).strict();

export async function PATCH(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  if (!session.membership) return NextResponse.json({ error: "لا توجد مدرسة مرتبطة بالحساب" }, { status: 403 });
  try { requireMembershipPermission(session.membership, Permission.SchoolSettingsManage); } catch { return NextResponse.json({ error: "تغيير بيانات المدرسة متاح لمالك المدرسة فقط" }, { status: 403 }); }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "بيانات المدرسة غير صالحة" }, { status: 400 });
  const data = parsed.data;
  let officialPhone: string | null | undefined;
  if (data.officialPhone !== undefined) { const phone = normalizePhone(data.officialPhone); if (phone && !/^\+?\d{7,15}$/.test(phone)) return NextResponse.json({ error: "رقم التواصل الرسمي غير صالح" }, { status: 400 }); officialPhone = phone ? encryptField(phone) : null; }
  const fields = Object.keys(data);
  const school = await db.$transaction(async (tx) => {
    const updated = await tx.school.update({ where: { id: session.membership!.schoolId }, data: { ...(data.name !== undefined ? { name: data.name } : {}), ...(data.educationAdministration !== undefined ? { educationAdministration: data.educationAdministration } : {}), ...(data.educationOffice !== undefined ? { educationOffice: data.educationOffice || null } : {}), ...(data.region !== undefined ? { region: data.region } : {}), ...(data.city !== undefined ? { city: data.city } : {}), ...(data.principalName !== undefined ? { principalName: data.principalName } : {}), ...(officialPhone !== undefined ? { officialPhoneEncrypted: officialPhone } : {}) }, select: { id: true, name: true, updatedAt: true } });
    await tx.auditLog.create({ data: { schoolId: updated.id, userId: session.user.id, action: "SCHOOL_UPDATED", entity: "School", entityId: updated.id, metadata: { fields, source: "MANUAL_UPDATE" } } });
    return updated;
  });
  return NextResponse.json({ school });
}
