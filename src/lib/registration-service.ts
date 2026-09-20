import { createSession } from "./auth";
import { db } from "./db";
import { encryptField, hashPassword, normalizeEmail, normalizePhone, phoneLookupHash } from "./security";

export async function registerManagerAccount(input: { email?: string; phone?: string; password: string; createManagerSession?: boolean }) {
  const email = input.email ? normalizeEmail(input.email) : undefined;
  const phone = input.phone ? normalizePhone(input.phone) : undefined;
  const identityFilters = [email ? { email } : undefined, phone ? { phoneLookupHash: phoneLookupHash(phone) } : undefined].filter((filter): filter is { email: string } | { phoneLookupHash: string } => Boolean(filter));
  const existing = await db.user.findFirst({ where: { OR: identityFilters }, select: { id: true } });
  if (existing) throw new Error("CONTACT_ALREADY_USED");
  const user = await db.user.create({ data: { email, passwordHash: hashPassword(input.password), ...(phone ? { phoneEncrypted: encryptField(phone), phoneLookupHash: phoneLookupHash(phone), phoneLast4: phone.slice(-4) } : {}) } }).catch((error) => {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new Error("CONTACT_ALREADY_USED");
    throw error;
  });
  if (input.createManagerSession !== false) await createSession(user.id);
  return { user };
}
