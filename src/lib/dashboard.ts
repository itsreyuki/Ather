import { WorkshopStatus } from "@prisma/client";
import { db } from "./db";

export async function getDashboardSummary(schoolId: string) {
  const [workshops, participants, completed, evaluations] = await Promise.all([
    db.workshop.count({ where: { schoolId, deletedAt: null } }),
    db.workshopParticipant.count({ where: { workshop: { schoolId, deletedAt: null } } }),
    db.workshop.count({ where: { schoolId, deletedAt: null, status: WorkshopStatus.COMPLETED } }),
    db.teacherWorkshopEvaluation.count({ where: { workshop: { schoolId, deletedAt: null } } }),
  ]);
  return { workshops, participants, completed, evaluations };
}
