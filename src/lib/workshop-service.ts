import { AssessmentPhase, AssessmentStatus, WorkshopStatus } from "@prisma/client";
import { db } from "./db";
import { IMPACT_ENGINE_VERSION, ImpactMeasurementService } from "./impact-measurement-service";
import { effectiveWorkshopStatus, getWorkshopEffectiveState } from "./workshop";
import { validateWorkshopSchedule } from "./workshop-schedule";
import { serverNow } from "./clock";
import { validateCriteriaWeights } from "./criteria";
import { refreshProfessionalGrowthPlanStatus } from "./professional-growth-plans";

export async function approveWorkshop(schoolId: string, workshopId: string) {
  // Keep the legacy service entry point behind the same transactional
  // validation as the current finalize endpoint.
  await finalizeWorkshopMeasurement(schoolId, workshopId);
  return db.workshop.findUniqueOrThrow({ where: { id: workshopId } });
}

export async function finalizeWorkshopMeasurement(schoolId: string, workshopId: string, userId?: string) {
  return db.$transaction(async (tx) => {
    await tx.school.update({ where: { id: schoolId }, data: { updatedAt: serverNow() } });
    const workshop = await tx.workshop.findFirst({
      where: { id: workshopId, schoolId, deletedAt: null },
      select: {
        id: true,
        title: true,
        facilitator: true,
        startsAt: true,
        endsAt: true,
        finalizedAt: true,
        cancelledAt: true,
        professionalGrowthPlanId: true,
        facilitatorStaffId: true,
        programType: true,
      },
    });
    if (!workshop || workshop.finalizedAt || workshop.cancelledAt)
      throw new Error("WORKSHOP_ALREADY_FINALIZED");
    if (!workshop.facilitator?.trim()) throw new Error("WORKSHOP_FACILITATOR_REQUIRED");
    if (workshop.professionalGrowthPlanId && (!workshop.facilitator?.trim() || !workshop.programType))
      throw new Error("WORKSHOP_PROGRAM_METADATA_REQUIRED");
    if (workshop.title.trim().length < 2 || workshop.title === "مسودة ورشة")
      throw new Error("WORKSHOP_INVALID_DETAILS");
    const schedule = validateWorkshopSchedule(
      { startsAt: workshop.startsAt, endsAt: workshop.endsAt },
      {
        minimumLeadMinutes: Number.parseInt(process.env.WORKSHOP_MIN_START_LEAD_MINUTES ?? "0", 10) || 0,
        requireFuture: true,
      },
    );
    if (!schedule.ok) throw new Error(schedule.code);
    const participants = await tx.workshopParticipant.findMany({
      where: { workshopId },
      select: { id: true },
    });
    const criteria = await tx.workshopCriterion.findMany({
      where: { workshopId },
      select: { id: true, weight: true },
    });
    const assessments = await tx.managerAssessment.findMany({
      where: { workshopId, phase: AssessmentPhase.PRE },
      select: { participantId: true, criterionId: true, score: true },
    });
    if (!participants.length) throw new Error("WORKSHOP_INCOMPLETE");
    const weightValidation = validateCriteriaWeights(criteria);
    if (!weightValidation.ok && weightValidation.code === "CRITERIA_REQUIRED")
      throw new Error("WORKSHOP_INCOMPLETE");
    if (!weightValidation.ok) throw new Error("WORKSHOP_WEIGHTS_INVALID");
    const expected = participants.length * criteria.length;
    const participantIds = new Set(participants.map((participant) => participant.id));
    const criterionIds = new Set(criteria.map((criterion) => criterion.id));
    const assessmentKeys = new Set<string>();
    for (const assessment of assessments) {
      if (
        !participantIds.has(assessment.participantId) ||
        !criterionIds.has(assessment.criterionId) ||
        !Number.isInteger(assessment.score) ||
        assessment.score < 1 ||
        assessment.score > 5
      )
        continue;
      assessmentKeys.add(`${assessment.participantId}:${assessment.criterionId}`);
    }
    if (assessmentKeys.size !== expected) throw new Error("PRE_ASSESSMENT_INCOMPLETE");
    const now = serverNow();
    const status = workshop.startsAt! > now ? WorkshopStatus.SCHEDULED : WorkshopStatus.IN_PROGRESS;
    const locked = await tx.workshop.updateMany({
      where: { id: workshopId, schoolId, deletedAt: null, finalizedAt: null, cancelledAt: null },
      data: { finalizedAt: now, approvedAt: now, status, draftStep: 5 },
    });
    if (locked.count !== 1) throw new Error("WORKSHOP_ALREADY_FINALIZED");
    await tx.managerAssessment.updateMany({
      where: { workshopId, phase: AssessmentPhase.PRE },
      data: { status: AssessmentStatus.SUBMITTED, submittedAt: now },
    });
    await tx.auditLog.create({
      data: {
        schoolId,
        userId,
        action: "PRE_ASSESSMENT_SUBMITTED",
        entity: "ManagerAssessment",
        entityId: workshopId,
        metadata: {
          participantCount: participants.length,
          criterionCount: criteria.length,
        },
      },
    });
    await tx.auditLog.create({
      data: {
        schoolId,
        userId,
        action: "WORKSHOP_FINALIZED",
        entity: "Workshop",
        entityId: workshopId,
        metadata: {
          participantCount: participants.length,
          criterionCount: criteria.length,
          status,
        },
      },
    });
    if (workshop.professionalGrowthPlanId)
      await refreshProfessionalGrowthPlanStatus(tx, {
        schoolId,
        planId: workshop.professionalGrowthPlanId,
        userId,
      });
    return tx.workshop.findUniqueOrThrow({ where: { id: workshopId } });
  });
}

export async function finalizePostAssessment(schoolId: string, workshopId: string, userId?: string) {
  return db.$transaction(async (tx) => {
    await tx.school.update({ where: { id: schoolId }, data: { updatedAt: serverNow() } });
    const workshop = await tx.workshop.findFirst({
      where: { id: workshopId, schoolId, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        facilitator: true,
        providerOrganization: true,
        category: true,
        deliveryMode: true,
        startsAt: true,
        endsAt: true,
        objectives: true,
        finalizedAt: true,
        cancelledAt: true,
        postAssessmentSubmittedAt: true,
        professionalGrowthPlanId: true,
      },
    });
    if (!workshop) throw new Error("WORKSHOP_NOT_FOUND");
    const school = await tx.school.findUniqueOrThrow({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        ministryCode: true,
        educationAdministration: true,
        region: true,
        city: true,
        educationStage: true,
        schoolType: true,
        genderType: true,
      },
    });
    const participantRows = await tx.workshopParticipant.findMany({
      where: { workshopId },
      select: { id: true, staffId: true },
    });
    const staffRows = await tx.staffMember.findMany({
      where: { id: { in: participantRows.map((item) => item.staffId) } },
      select: { id: true, fullName: true, jobTitle: true },
    });
    const staffById = new Map(staffRows.map((staff) => [staff.id, staff]));
    const participants = participantRows.map((participant) => ({
      ...participant,
      staff: staffById.get(participant.staffId) ?? {
        id: participant.staffId,
        fullName: "مشارك",
        jobTitle: null,
      },
    }));
    const criteria = await tx.workshopCriterion.findMany({
      where: { workshopId },
      orderBy: { displayOrder: "asc" },
    });
    const evaluationRows = await tx.teacherWorkshopEvaluation.findMany({
      where: { workshopId, status: AssessmentStatus.SUBMITTED },
      select: {
        id: true,
        rating: true,
        contentQuality: true,
        needFit: true,
        deliveryQuality: true,
        applicability: true,
      },
    });
    const responseRows = await tx.teacherCriterionEvaluation.findMany({
      where: { evaluationId: { in: evaluationRows.map((item) => item.id) } },
      select: { evaluationId: true, criterionId: true, rating: true },
    });
    const evaluations = evaluationRows.map((evaluation) => ({
      ...evaluation,
      criterionResponses: responseRows.filter((response) => response.evaluationId === evaluation.id),
    }));
    const assessments = await tx.managerAssessment.findMany({
      where: { workshopId, phase: { in: [AssessmentPhase.PRE, AssessmentPhase.POST] } },
    });
    const state = getWorkshopEffectiveState(workshop);
    if (state !== WorkshopStatus.POST_ASSESSMENT_AVAILABLE) throw new Error("WORKSHOP_NOT_READY");
    const expected = participants.length * criteria.length;
    const post = assessments.filter(
      (item) => item.phase === AssessmentPhase.POST && item.score >= 1 && item.score <= 5,
    );
    if (post.length !== expected) throw new Error("POST_ASSESSMENT_INCOMPLETE");
    const pre = assessments.filter(
      (item) => item.phase === AssessmentPhase.PRE && item.status === AssessmentStatus.SUBMITTED,
    );
    if (pre.length !== expected) throw new Error("PRE_ASSESSMENT_INCOMPLETE");
    const now = serverNow();
    const locked = await tx.workshop.updateMany({
      where: {
        id: workshopId,
        schoolId,
        deletedAt: null,
        postAssessmentSubmittedAt: null,
        cancelledAt: null,
      },
      data: { postAssessmentSubmittedAt: now, completedAt: now, status: WorkshopStatus.COMPLETED },
    });
    if (locked.count !== 1) throw new Error("WORKSHOP_ALREADY_FINALIZED");
    await tx.managerAssessment.updateMany({
      where: { workshopId, phase: AssessmentPhase.POST },
      data: { status: AssessmentStatus.SUBMITTED, submittedAt: now },
    });
    await tx.auditLog.create({
      data: {
        schoolId,
        userId,
        action: "POST_ASSESSMENT_SUBMITTED",
        entity: "ManagerAssessment",
        entityId: workshopId,
        metadata: {
          participantCount: participants.length,
          criterionCount: criteria.length,
        },
      },
    });
    const analytics = ImpactMeasurementService.measure({
      criteria: criteria.map((criterion) => ({
        id: criterion.id,
        name: criterion.name,
        weight: criterion.weight,
        targetValue: criterion.targetValue,
        preScores: pre.filter((item) => item.criterionId === criterion.id).map((item) => item.score),
        postScores: post.filter((item) => item.criterionId === criterion.id).map((item) => item.score),
      })),
      participants: participants.map((participant) => ({
        participantId: participant.id,
        preScores: Object.fromEntries(
          criteria.map((criterion) => [
            criterion.id,
            pre.find((item) => item.participantId === participant.id && item.criterionId === criterion.id)
              ?.score,
          ]),
        ),
        postScores: Object.fromEntries(
          criteria.map((criterion) => [
            criterion.id,
            post.find((item) => item.participantId === participant.id && item.criterionId === criterion.id)
              ?.score,
          ]),
        ),
      })),
      teacherResponses: evaluations.map((evaluation) => ({
        overallSatisfaction: evaluation.rating,
        contentQuality: evaluation.contentQuality,
        needFit: evaluation.needFit,
        deliveryQuality: evaluation.deliveryQuality,
        applicability: evaluation.applicability,
        criteria: Object.fromEntries(
          evaluation.criterionResponses.map((response) => [response.criterionId, response.rating]),
        ),
      })),
    });
    const generatedAt = now.toISOString();
    const participantChanges = analytics.participantChanges.map((change) => {
      const participant = participants.find((item) => item.id === change.participantId);
      return {
        ...change,
        fullName: participant?.staff.fullName ?? "مشارك",
        jobTitle: participant?.staff.jobTitle ?? null,
      };
    });
    const snapshot = {
      generatedAt,
      engineVersion: IMPACT_ENGINE_VERSION,
      workshop: {
        id: workshop.id,
        title: workshop.title,
        description: workshop.description,
        facilitator: workshop.facilitator,
        providerOrganization: workshop.providerOrganization,
        category: workshop.category,
        deliveryMode: workshop.deliveryMode,
        startsAt: workshop.startsAt?.toISOString() ?? null,
        endsAt: workshop.endsAt?.toISOString() ?? null,
        objectives: workshop.objectives,
      },
      school,
      participantCount: analytics.participantCount,
      criteria: analytics.criteria,
      distributions: analytics.criteria.map((criterion) => ({
        criterionId: criterion.criterionId,
        name: criterion.name,
        pre: criterion.distribution.pre,
        post: criterion.distribution.post,
      })),
      aggregates: analytics.aggregates,
      participantChanges,
      teacherAggregates: analytics.teacherAggregates,
      compositeImpact: analytics.compositeImpact,
    };
    const report = await tx.reportSnapshot.create({
      data: {
        schoolId,
        workshopId,
        engineVersion: IMPACT_ENGINE_VERSION,
        immutable: true,
        participantCount: analytics.participantCount,
        overallScaleImprovement: analytics.aggregates.overallScaleImprovementPercentage,
        impactScore: analytics.aggregates.impactScore,
        teacherResponseRate: analytics.teacherAggregates.responseRatePercentage,
        snapshot,
        metrics: snapshot,
      },
    });
    await tx.auditLog.create({
      data: {
        schoolId,
        userId,
        action: "WORKSHOP_POST_ASSESSMENT_FINALIZED",
        entity: "ReportSnapshot",
        entityId: report.id,
        metadata: {
          participantCount: participants.length,
          criterionCount: criteria.length,
          participantFeedbackCount: evaluations.length,
          engineVersion: IMPACT_ENGINE_VERSION,
        },
      },
    });
    await tx.auditLog.create({
      data: {
        schoolId,
        userId,
        action: "REPORT_GENERATED",
        entity: "ReportSnapshot",
        entityId: report.id,
        metadata: { engineVersion: IMPACT_ENGINE_VERSION, immutable: true },
      },
    });
    if (workshop.professionalGrowthPlanId)
      await refreshProfessionalGrowthPlanStatus(tx, {
        schoolId,
        planId: workshop.professionalGrowthPlanId,
        userId,
      });
    return report;
  });
}

export function stateForWorkshop(workshop: {
  finalizedAt: Date | null;
  cancelledAt: Date | null;
  startsAt: Date | null;
  endsAt: Date | null;
  postAssessmentSubmittedAt: Date | null;
}) {
  return getWorkshopEffectiveState(workshop);
}
export { effectiveWorkshopStatus };
