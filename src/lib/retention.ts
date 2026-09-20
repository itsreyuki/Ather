export const DEFAULT_RETENTION_DAYS = 2555;
export const MIN_RETENTION_DAYS = 30;
export const MAX_RETENTION_DAYS = 3650;

export type PiiRetentionMode = "REVIEW_REQUIRED" | "REDACT_ON_APPROVAL";
export type RetentionPolicy = { auditRetentionDays: number; disabledStaffRetentionDays: number; piiRetentionMode: PiiRetentionMode; automaticDeletion: false };

export function normalizeRetentionDays(value: number | undefined, fallback = DEFAULT_RETENTION_DAYS) {
  if (value === undefined || !Number.isInteger(value)) return fallback;
  return Math.min(MAX_RETENTION_DAYS, Math.max(MIN_RETENTION_DAYS, value));
}

export function retentionPolicy(input?: Partial<RetentionPolicy>): RetentionPolicy {
  return {
    auditRetentionDays: normalizeRetentionDays(input?.auditRetentionDays),
    disabledStaffRetentionDays: normalizeRetentionDays(input?.disabledStaffRetentionDays),
    piiRetentionMode: input?.piiRetentionMode === "REDACT_ON_APPROVAL" ? "REDACT_ON_APPROVAL" : "REVIEW_REQUIRED",
    automaticDeletion: false,
  };
}
