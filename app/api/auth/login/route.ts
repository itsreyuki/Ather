import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { loginSchema } from "@/src/lib/auth-schemas";
import { createSession } from "@/src/lib/auth";
import { contactLookupHash, normalizeEmail, normalizePhone, phoneLookupHash, verifyPassword } from "@/src/lib/security";

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "بيانات الدخول غير صالحة" }, { status: 400 });
  const identity = parsed.data.identity.trim();
  const isEmail = identity.includes("@");
  const user = await db.user.findFirst({ where: isEmail ? { email: normalizeEmail(identity) } : { phoneLookupHash: phoneLookupHash(normalizePhone(identity)) }, include: { memberships: { where: { status: "ACTIVE" }, include: { school: true } } } });
  if (!user?.passwordHash || !verifyPassword(parsed.data.password, user.passwordHash)) {
    const memberships = user?.memberships ?? [];
    if (memberships.length) await Promise.all(memberships.map((membership) => db.auditLog.create({ data: { schoolId: membership.schoolId, userId: user?.id, action: "LOGIN_FAILED", entity: "Session", metadata: { identifierHash: contactLookupHash(identity), reason: "INVALID_CREDENTIALS" } } })));
    else await db.auditLog.create({ data: { userId: user?.id, action: "LOGIN_FAILED", entity: "Session", metadata: { identifierHash: contactLookupHash(identity), reason: "INVALID_CREDENTIALS" } } });
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
  }
  await createSession(user.id);
  await Promise.all((user.memberships.length ? user.memberships : [{ schoolId: null }]).map((membership) => db.auditLog.create({ data: { schoolId: membership.schoolId, userId: user.id, action: "LOGIN_SUCCESS", entity: "Session", metadata: { channel: isEmail ? "email" : "phone" } } })));
  const membership = user.memberships[0];
  const nextPath = !membership ? "/onboarding" : membership.school.setupStatus === "SETUP_REQUIRED" ? "/onboarding/import" : "/dashboard";
  return NextResponse.json({ nextPath });
}
