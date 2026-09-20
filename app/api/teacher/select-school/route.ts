import { NextResponse } from "next/server";
import { z } from "zod";
import { createTeacherSession } from "@/src/lib/teacher-session";
import { auditTeacherSecurity, findTeacherCandidates, identityHash, TEACHER_GENERIC_MESSAGE } from "@/src/lib/teacher-auth";
import { checkTeacherRisk, securityFingerprint } from "@/src/lib/teacher-security";

const schema = z.object({
  username: z.string().trim().min(3).max(64).optional(),
  nationalId: z.string().trim().min(3).max(64).optional(),
  schoolId: z.string().min(1),
}).refine((value) => Boolean(value.username || value.nationalId), { message: "اسم المستخدم مطلوب" }).transform((value) => ({ username: value.username ?? value.nationalId!, schoolId: value.schoolId }));

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: TEACHER_GENERIC_MESSAGE }, { status: 400 });
  const identifierHash = identityHash(parsed.data.username);
  const risk = await checkTeacherRisk(request, identifierHash);
  if (!risk.allowed) return NextResponse.json({ error: "محاولات كثيرة. أعد المحاولة لاحقًا." }, { status: 429, headers: { "Retry-After": String(risk.retryAfterSeconds) } });
  const candidate = (await findTeacherCandidates(identifierHash)).find((item) => item.schoolId === parsed.data.schoolId);
  if (!candidate) {
    await auditTeacherSecurity({ action: "TEACHER_LOGIN_LOOKUP_MISS", identifierHash, metadata: { ipFingerprint: securityFingerprint(risk.ip), userAgentFingerprint: securityFingerprint(risk.userAgent), requestedSchoolId: parsed.data.schoolId } });
    return NextResponse.json({ error: TEACHER_GENERIC_MESSAGE }, { status: 401 });
  }
  await createTeacherSession(candidate.id, candidate.schoolId);
  await auditTeacherSecurity({ action: "TEACHER_SESSION_CREATED", identifierHash, schoolId: candidate.schoolId, metadata: { method: "NOOR_USERNAME_ONLY", selectedSchool: true, ipFingerprint: securityFingerprint(risk.ip), userAgentFingerprint: securityFingerprint(risk.userAgent) } });
  return NextResponse.json({ nextPath: "/teacher" });
}
