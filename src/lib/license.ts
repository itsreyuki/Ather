import { timingSafeEqual } from "node:crypto";

export function normalizeLicenseCode(value: string) {
  return value.trim().toUpperCase().replace(/[\u2010-\u2015\s]/g, "-");
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
