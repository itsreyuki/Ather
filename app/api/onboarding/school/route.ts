import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { schoolOnboardingSchema } from "@/src/lib/auth-schemas";
import { getSessionContext } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { encryptField, normalizePhone } from "@/src/lib/security";

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  if (session.membership) return NextResponse.json({ error: "تم تجهيز مدرسة لهذا الحساب بالفعل" }, { status: 409 });
  const parsed = schoolOnboardingSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات المدرسة غير صالحة" }, { status: 400 });
  const input = parsed.data;
  try {
    const result = await db.$transaction(async (tx) => {
      const school = await tx.school.create({ data: { name: input.officialName, slug: `school-${randomUUID().slice(0, 8)}`, ministryCode: input.ministryCode.trim().toUpperCase(), educationAdministration: input.educationAdministration, educationOffice: input.educationOffice || undefined, region: input.region, city: input.city, educationStage: input.educationStage, schoolType: input.schoolType, genderType: input.genderType, principalName: input.principalName, officialPhoneEncrypted: input.officialPhone ? encryptField(normalizePhone(input.officialPhone)) : undefined } });
      await tx.schoolMembership.create({ data: { userId: session.user.id, schoolId: school.id, role: "SCHOOL_OWNER" } });
      await tx.auditLog.create({ data: { schoolId: school.id, userId: session.user.id, action: "SCHOOL_CREATED", entity: "School", entityId: school.id, metadata: { setupStatus: "SETUP_REQUIRED" } } });
      return school;
    });
    return NextResponse.json({ schoolId: result.id, nextPath: "/onboarding/import" }, { status: 201 });
  } catch { return NextResponse.json({ error: "تعذر إنشاء المدرسة. تحقق من الرقم الوزاري وحاول مرة أخرى." }, { status: 409 }); }
}
