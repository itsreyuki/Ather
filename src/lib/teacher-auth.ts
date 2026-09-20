import { nationalIdLookupHash, normalizeNoorUsername } from "./security";
import { db } from "./db";

export const TEACHER_GENERIC_MESSAGE = "تعذر بدء الدخول بهذه البيانات. إذا كنت منسوبًا، تواصل مع إدارة مدرستك.";

export function identityHash(value: string) {
  return nationalIdLookupHash(normalizeNoorUsername(value));
}

export async function findTeacherCandidates(nationalIdHash: string) {
  return db.staffMember.findMany({
    where: { nationalIdHash, active: true, school: { setupStatus: "ACTIVE" } },
    select: { id: true, schoolId: true, school: { select: { id: true, name: true, city: true } } },
  });
}

export async function auditTeacherSecurity(input: { action: string; identifierHash?: string; challengeId?: string; schoolId?: string; metadata?: Record<string, string | number | boolean | undefined> }) {
  const metadata = Object.fromEntries(Object.entries({ identifierHash: input.identifierHash, ...input.metadata }).filter(([, value]) => value !== undefined));
  await db.auditLog.create({ data: { schoolId: input.schoolId, action: input.action, entity: "TeacherAuth", entityId: input.challengeId, metadata } });
}
