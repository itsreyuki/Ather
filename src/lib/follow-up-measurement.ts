export const FOLLOW_UP_OFFSETS = [30, 60, 90] as const;
export type FollowUpOffset = (typeof FOLLOW_UP_OFFSETS)[number];

export function isSupportedFollowUpOffset(value: number): value is FollowUpOffset {
  return FOLLOW_UP_OFFSETS.includes(value as FollowUpOffset);
}

export function getFollowUpDueAt(completedAt: Date, offsetDays: number) {
  if (!isSupportedFollowUpOffset(offsetDays)) throw new Error("Unsupported follow-up offset");
  const dueAt = new Date(completedAt);
  dueAt.setUTCDate(dueAt.getUTCDate() + offsetDays);
  return dueAt;
}
