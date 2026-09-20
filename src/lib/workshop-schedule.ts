import { serverNow } from "./clock";

export type WorkshopSchedule = { startsAt: Date | null; endsAt: Date | null };

/**
 * datetime-local values do not carry a timezone. Treat them as UTC at the
 * API boundary so a browser/server timezone difference cannot move a workshop
 * across its start or end boundary. Values that already carry an offset are
 * respected as-is.
 */
export function parseWorkshopDate(value: string | null | undefined): Date | null | undefined {
  if (value === null || value === undefined || value.trim() === "") return null;
  const text = value.trim();
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
  const utcText = hasTimezone ? text : /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00Z` : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text) ? `${text}:00Z` : `${text}Z`;
  const date = new Date(utcText);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

export function validateWorkshopSchedule(schedule: WorkshopSchedule, options?: { now?: Date; minimumLeadMinutes?: number; requireFuture?: boolean }) {
  const { startsAt, endsAt } = schedule;
  if (!startsAt || !endsAt) return { ok: false as const, code: "WORKSHOP_DATES_REQUIRED" };
  if (endsAt <= startsAt) return { ok: false as const, code: "WORKSHOP_END_BEFORE_START" };
  const now = options?.now ?? serverNow();
  const minimumLeadMinutes = options?.minimumLeadMinutes ?? 0;
  if (options?.requireFuture && startsAt.getTime() < now.getTime() + minimumLeadMinutes * 60_000) return { ok: false as const, code: "WORKSHOP_START_TOO_SOON" };
  return { ok: true as const };
}
