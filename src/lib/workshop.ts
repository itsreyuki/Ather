import { WorkshopStatus } from "@prisma/client";
import { serverNow } from "./clock";

export type WorkshopEffectiveInput = { finalizedAt: Date | null; cancelledAt: Date | null; startsAt: Date | null; endsAt: Date | null; postAssessmentSubmittedAt: Date | null };

/** Derives the user-facing state from persisted milestones and server time. */
export function getWorkshopEffectiveState(workshop: WorkshopEffectiveInput, now = serverNow()): WorkshopStatus {
  if (workshop.cancelledAt) return WorkshopStatus.CANCELLED;
  if (!workshop.finalizedAt) return WorkshopStatus.DRAFT;
  if (workshop.postAssessmentSubmittedAt) return WorkshopStatus.COMPLETED;
  if (!workshop.startsAt || !workshop.endsAt) return WorkshopStatus.DRAFT;
  if (now < workshop.startsAt) return WorkshopStatus.SCHEDULED;
  if (now < workshop.endsAt) return WorkshopStatus.IN_PROGRESS;
  return WorkshopStatus.POST_ASSESSMENT_AVAILABLE;
}

export function effectiveWorkshopStatus(workshop: { status: WorkshopStatus; startsAt: Date | null; endsAt: Date | null; finalizedAt?: Date | null; cancelledAt?: Date | null; postAssessmentSubmittedAt?: Date | null }, now = serverNow()): WorkshopStatus {
  if (workshop.finalizedAt !== undefined || workshop.cancelledAt !== undefined || workshop.postAssessmentSubmittedAt !== undefined) return getWorkshopEffectiveState({ finalizedAt: workshop.finalizedAt ?? null, cancelledAt: workshop.cancelledAt ?? null, startsAt: workshop.startsAt, endsAt: workshop.endsAt, postAssessmentSubmittedAt: workshop.postAssessmentSubmittedAt ?? null }, now);
  if (workshop.status === WorkshopStatus.DRAFT || workshop.status === WorkshopStatus.COMPLETED || workshop.status === WorkshopStatus.CANCELLED) return workshop.status;
  if (!workshop.startsAt || !workshop.endsAt) return workshop.status;
  if (now < workshop.startsAt) return WorkshopStatus.SCHEDULED;
  if (now < workshop.endsAt) return WorkshopStatus.IN_PROGRESS;
  return WorkshopStatus.POST_ASSESSMENT_AVAILABLE;
}

export function canSubmitTeacherAssessment(workshop: WorkshopEffectiveInput, now = serverNow()): boolean { return getWorkshopEffectiveState(workshop, now) === WorkshopStatus.IN_PROGRESS; }
export function canFinalizePostAssessment(state: WorkshopStatus): boolean { return state === WorkshopStatus.POST_ASSESSMENT_AVAILABLE; }

export function getWorkshopCountdown(workshop: WorkshopEffectiveInput, now = serverNow()) {
  const state = getWorkshopEffectiveState(workshop, now);
  const target = state === WorkshopStatus.SCHEDULED ? workshop.startsAt : state === WorkshopStatus.IN_PROGRESS ? workshop.endsAt : null;
  return { state, targetAt: target?.toISOString() ?? null, serverNow: now.toISOString() };
}
