import { NextResponse } from "next/server";
import { z } from "zod";
import { createTeacherSession } from "@/src/lib/teacher-session";
import { auditTeacherSecurity, findTeacherCandidates, identityHash, TEACHER_GENERIC_MESSAGE } from "@/src/lib/teacher-auth";
import { checkTeacherRisk, securityFingerprint } from "@/src/lib/teacher-security";

const schema = z.object({
  username: z.string().trim().min(3).max(64).optional(),
  nationalId: z.string().trim().min(3).max(64).optional(),
}).refine((value) => Boolean(value.username || value.nationalId), { message: "اسم المستخدم مطلوب" }).transform((value) => ({ username: value.username ?? value.nationalId! }));

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: TEACHER_GENERIC_MESSAGE }, { status: 400 });
  const identifierHash = identityHash(parsed.data.username);
  const risk = await checkTeacherRisk(request, identifierHash);
  if (!risk.allowed) {
    await auditTeacherSecurity({ action: "TEACHER_LOGIN_RATE_LIMITED", identifierHash, metadata: { ipFingerprint: securityFingerprint(risk.ip), userAgentFingerprint: securityFingerprint(risk.userAgent), riskScore: risk.riskScore, reasons: risk.reasons.join(",").slice(0, 100), retryAfterSeconds: risk.retryAfterSeconds } });
    return NextResponse.json({ error: "محاولات كثيرة. أعد المحاولة لاحقًا." }, { status: 429, headers: { "Retry-After": String(risk.retryAfterSeconds) } });
  }

  const candidates = await findTeacherCandidates(identifierHash);
  const schools = [...new Map(candidates.map((candidate) => [candidate.school.id, candidate.school])).values()];
  if (!schools.length) {
    await auditTeacherSecurity({ action: "TEACHER_LOGIN_LOOKUP_MISS", identifierHash, metadata: { ipFingerprint: securityFingerprint(risk.ip), userAgentFingerprint: securityFingerprint(risk.userAgent) } });
    return NextResponse.json({ error: TEACHER_GENERIC_MESSAGE }, { status: 401 });
  }
  if (schools.length > 1) {
    await auditTeacherSecurity({ action: "TEACHER_LOGIN_IDENTITY_ACCEPTED", identifierHash, schoolId: schools[0].id, metadata: { schoolCount: schools.length, ipFingerprint: securityFingerprint(risk.ip), userAgentFingerprint: securityFingerprint(risk.userAgent) } });
    return NextResponse.json({ requiresSchoolSelection: true, schools });
  }
  const candidate = candidates[0];
  await createTeacherSession(candidate.id, candidate.schoolId);
  await auditTeacherSecurity({ action: "TEACHER_SESSION_CREATED", identifierHash, schoolId: candidate.schoolId, metadata: { method: "NOOR_USERNAME_ONLY", ipFingerprint: securityFingerprint(risk.ip), userAgentFingerprint: securityFingerprint(risk.userAgent) } });
  return NextResponse.json({ nextPath: "/teacher" });
}
