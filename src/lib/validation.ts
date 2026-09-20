import { z } from "zod";

export const scoreSchema = z.number().int().min(1).max(5);
export const workshopSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
}).refine((value) => value.endsAt > value.startsAt, { message: "ينبغي أن يكون وقت النهاية بعد وقت البداية", path: ["endsAt"] });

export const assessmentSchema = z.object({
  workshopId: z.string().cuid(),
  participantId: z.string().cuid(),
  criterionId: z.string().cuid(),
  phase: z.enum(["PRE", "POST"]),
  score: scoreSchema,
  notes: z.string().trim().max(2000).optional(),
});
