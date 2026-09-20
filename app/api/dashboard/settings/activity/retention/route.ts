import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/src/lib/auth";
import { requireMembershipPermission, Permission } from "@/src/lib/permissions";
import { db } from "@/src/lib/db";
import { normalizeRetentionDays } from "@/src/lib/retention";

const schema = z.object({ auditRetentionDays: z.number().int(), disabledStaffRetentionDays: z.number().int(), piiRetentionMode: z.enum(["REVIEW_REQUIRED", "REDACT_ON_APPROVAL"]) });

async function ownerSession() {
  const session = await getSessionContext();
  if (!session) return { response: NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 }) };
  if (!session.membership) return { response: NextResponse.json({ error: "لا توجد مدرسة مرتبطة بالحساب" }, { status: 403 }) };
  try { requireMembershipPermission(session.membership, Permission.SchoolSettingsManage); } catch { return { response: NextResponse.json({ error: "هذه الإعدادات متاحة لمالك المدرسة فقط" }, { status: 403 }) }; }
  return { session };
}

export async function GET() {
  const auth = await ownerSession();
  if (auth.response) return auth.response;
  const settings = await db.schoolPrivacySettings.upsert({ where: { schoolId: auth.session.membership!.schoolId }, create: { schoolId: auth.session.membership!.schoolId }, update: {}, select: { auditRetentionDays: true, disabledStaffRetentionDays: true, piiRetentionMode: true, updatedAt: true } });
  return NextResponse.json({ settings, automaticDeletion: false });
}

export async function PATCH(request: Request) {
  const auth = await ownerSession();
  if (auth.response) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "إعدادات الاحتفاظ غير صالحة" }, { status: 400 });
  const settings = await db.$transaction(async (tx) => {
    const updated = await tx.schoolPrivacySettings.upsert({ where: { schoolId: auth.session.membership!.schoolId }, create: { schoolId: auth.session.membership!.schoolId, auditRetentionDays: normalizeRetentionDays(parsed.data.auditRetentionDays), disabledStaffRetentionDays: normalizeRetentionDays(parsed.data.disabledStaffRetentionDays), piiRetentionMode: parsed.data.piiRetentionMode, updatedByUserId: auth.session.user.id }, update: { auditRetentionDays: normalizeRetentionDays(parsed.data.auditRetentionDays), disabledStaffRetentionDays: normalizeRetentionDays(parsed.data.disabledStaffRetentionDays), piiRetentionMode: parsed.data.piiRetentionMode, updatedByUserId: auth.session.user.id }, select: { auditRetentionDays: true, disabledStaffRetentionDays: true, piiRetentionMode: true, updatedAt: true } });
    await tx.auditLog.create({ data: { schoolId: auth.session.membership!.schoolId, userId: auth.session.user.id, action: "PRIVACY_RETENTION_SETTINGS_UPDATED", entity: "SchoolPrivacySettings", entityId: auth.session.membership!.schoolId, metadata: { auditRetentionDays: updated.auditRetentionDays, disabledStaffRetentionDays: updated.disabledStaffRetentionDays, piiRetentionMode: updated.piiRetentionMode, automaticDeletion: false } } });
    return updated;
  });
  return NextResponse.json({ settings, automaticDeletion: false });
}
