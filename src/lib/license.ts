import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Prisma, LicenseCodeStatus } from "@prisma/client";

export function normalizeLicenseCode(value: string) {
  return value.trim().toUpperCase().replace(/[\u2010-\u2015\s]/g, "-");
}

export function licenseCodeHash(value: string) {
  return createHash("sha256").update(normalizeLicenseCode(value)).digest("hex");
}

export function generateLicenseCode() {
  const value = randomBytes(10).toString("hex").toUpperCase();
  return `ATHAR-${value.slice(0, 5)}-${value.slice(5, 10)}-${value.slice(10, 15)}-${value.slice(15)}`;
}

function configuredCodes() {
  return (process.env.ATHAR_LICENSE_CODES ?? "")
    .split(",")
    .map(normalizeLicenseCode)
    .filter(Boolean);
}

export function isLicenseCodeConfigured() {
  return configuredCodes().length > 0;
}

export function isValidLicenseCode(value: string) {
  const candidate = Buffer.from(normalizeLicenseCode(value));
  return configuredCodes().some((configured) => {
    const expected = Buffer.from(configured);
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}

export async function redeemLicenseCode(tx: Prisma.TransactionClient, value: string, userId: string) {
  const normalized = normalizeLicenseCode(value);
  const record = await tx.licenseCode.findUnique({ where: { codeHash: licenseCodeHash(normalized) }, select: { id: true, status: true, redeemedAt: true } });
  if (record) {
    if (record.status !== LicenseCodeStatus.ACTIVE || record.redeemedAt) throw new Error("LICENSE_CODE_ALREADY_USED");
    const updated = await tx.licenseCode.updateMany({ where: { id: record.id, status: LicenseCodeStatus.ACTIVE, redeemedAt: null }, data: { status: LicenseCodeStatus.REDEEMED, redeemedAt: new Date(), redeemedUserId: userId } });
    if (updated.count !== 1) throw new Error("LICENSE_CODE_ALREADY_USED");
    return "DATABASE" as const;
  }
  if (isValidLicenseCode(normalized) && (process.env.NODE_ENV !== "production" || process.env.ATHAR_E2E === "true")) return "ENVIRONMENT" as const;
  if (!isLicenseCodeConfigured()) throw new Error("LICENSE_CODES_NOT_CONFIGURED");
  throw new Error("INVALID_LICENSE_CODE");
}
