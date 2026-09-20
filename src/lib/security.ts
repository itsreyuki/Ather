import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

function secret(name: string, legacyName?: string): Buffer {
  const value = process.env[name] || (legacyName ? process.env[legacyName] : undefined);
  if (!value) throw new Error(`${name} must be configured`);
  return Buffer.from(value, "base64");
}

export function normalizeNationalId(value: string): string {
    return value.trim().replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  }

  /** The Noor username is the roster identifier; normalize only formatting, not its meaning. */
  export function normalizeNoorUsername(value: string): string {
    return normalizeNationalId(value).replace(/\s+/g, "");
  }

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string): string {
  const western = value.trim().replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  return western.replace(/[\s()-]/g, "");
}

export function contactLookupHash(value: string): string {
  return createHmac("sha256", secret("LOOKUP_HMAC_SECRET", "ID_LOOKUP_SECRET")).update(value).digest("hex");
}

export function phoneLookupHash(value: string): string {
  return contactLookupHash(normalizePhone(value));
}

export function nationalIdLookupHash(value: string): string {
  return createHmac("sha256", secret("LOOKUP_HMAC_SECRET", "ID_LOOKUP_SECRET")).update(normalizeNationalId(value)).digest("hex");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [, saltText, hashText] = stored.split("$");
  if (!saltText || !hashText) return false;
  const actual = scryptSync(password, Buffer.from(saltText, "base64url"), 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(hashText, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function encryptField(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret("APP_ENCRYPTION_KEY", "FIELD_ENCRYPTION_KEY"), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptField(payload: string): string {
  const [ivText, tagText, encryptedText] = payload.split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("Invalid encrypted field");
  const decipher = createDecipheriv("aes-256-gcm", secret("APP_ENCRYPTION_KEY", "FIELD_ENCRYPTION_KEY"), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
}
