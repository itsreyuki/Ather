import { AssessmentPhase, AssessmentStatus } from "@prisma/client";
import { db } from "./db";
import { serverNow } from "./clock";

export type ManagerAssessmentItem = {
  participantId: string;
  criterionId: string;
  score: number;
};

/** The single write path for manager assessment autosave and its lock boundary. */
export async function saveManagerAssessments(input: {
  schoolId: string;
  workshopId: string;
  phase: AssessmentPhase;
  items: ManagerAssessmentItem[];
}) {
  if (!input.items.length) throw new Error("ASSESSMENTS_REQUIRED");
  if (input.items.some((item) => !Number.isInteger(item.score) || item.score < 1 || item.score > 5)) throw new Error("ASSESSMENT_SCORE_INVALID");
  const itemKeys = new Set(input.items.map((item) => `${item.participantId}:${item.criterionId}`));
  if (itemKeys.size !== input.items.length) throw new Error("ASSESSMENT_DUPLICATE_CELL");
  const participantIds = [...new Set(input.items.map((item) => item.participantId))];
  const criterionIds = [...new Set(input.items.map((item) => item.criterionId))];
  return db.$transaction(async (tx) => {
    const participants = await tx.workshopParticipant.findMany({ where: { workshopId: input.workshopId, id: { in: participantIds } }, select: { id: true } });
    const criteria = await tx.workshopCriterion.findMany({ where: { workshopId: input.workshopId, id: { in: criterionIds } }, select: { id: true } });
    if (participants.length !== participantIds.length || criteria.length !== criterionIds.length) throw new Error("ASSESSMENT_NOT_IN_WORKSHOP");
    const locked = await tx.workshop.updateMany({
      where: { id: input.workshopId, schoolId: input.schoolId, cancelledAt: null, ...(input.phase === AssessmentPhase.PRE ? { finalizedAt: null } : { finalizedAt: { not: null }, postAssessmentSubmittedAt: null }) },
      data: { updatedAt: serverNow() },
    });
    if (locked.count !== 1) throw new Error("ASSESSMENT_LOCKED");
    for (const item of input.items) {
      await tx.managerAssessment.upsert({
        where: { participantId_criterionId_phase: { participantId: item.participantId, criterionId: item.criterionId, phase: input.phase } },
        create: { workshopId: input.workshopId, participantId: item.participantId, criterionId: item.criterionId, phase: input.phase, score: item.score, status: AssessmentStatus.DRAFT },
        update: { score: item.score, status: AssessmentStatus.DRAFT },
      });
    }
    for (const score of [1, 2, 3, 4, 5]) {
      const cells = input.items.filter((item) => item.score === score);
      if (!cells.length) continue;
      await tx.managerAssessment.updateMany({
        where: { workshopId: input.workshopId, phase: input.phase, OR: cells.map((item) => ({ participantId: item.participantId, criterionId: item.criterionId })) },
        data: { score, status: AssessmentStatus.DRAFT },
      });
    }
    return { saved: input.items.length };
  });
}
