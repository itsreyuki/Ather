import { NextResponse } from "next/server";
import { AssessmentStatus, WorkshopStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/src/lib/db";
import { auditTeacherSecurity } from "@/src/lib/teacher-auth";
import { getTeacherSessionContext } from "@/src/lib/teacher-session";
import { serverNow } from "@/src/lib/clock";
import { getWorkshopEffectiveState } from "@/src/lib/workshop";

const rating = z.number().int().min(1).max(5).nullable().optional();
const schema = z.object({ action: z.enum(["autosave", "submit"]), criteria: z.array(z.object({ criterionId: z.string().min(1), rating })).max(100), contentQuality: rating, needFit: rating, deliveryQuality: rating, applicability: rating, overallSatisfaction: rating, comment: z.string().max(2000).nullable().optional() });

function isComplete(criteria: Array<{ criterionId: string; rating?: number | null }>, expectedIds: string[]) {
  const values = new Map(criteria.map((item) => [item.criterionId, item.rating]));
  return expectedIds.every((id) => { const value = values.get(id); return typeof value === "number" && value >= 1 && value <= 5; });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getTeacherSessionContext();
  if (!session) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "بيانات التقييم غير صالحة" }, { status: 400 });
  const { id } = await params;
  try {
    const result = await db.$transaction(async (tx) => {
      const workshop = await tx.workshop.findFirst({ where: { id, schoolId: session.schoolId, participants: { some: { staffId: session.staffId } } }, select: { id: true, title: true, finalizedAt: true, cancelledAt: true, startsAt: true, endsAt: true, postAssessmentSubmittedAt: true, criteria: { orderBy: { displayOrder: "asc" }, select: { id: true } } } });
      if (!workshop) throw new Error("NOT_PARTICIPANT");
      const state = getWorkshopEffectiveState(workshop);
      if (state !== WorkshopStatus.IN_PROGRESS) throw new Error(state === WorkshopStatus.SCHEDULED ? "NOT_STARTED" : "EVALUATION_CLOSED");
      const expectedIds = workshop.criteria.map((criterion) => criterion.id);
      if (parsed.data.criteria.some((item) => !expectedIds.includes(item.criterionId))) throw new Error("INVALID_CRITERION");
      const existing = await tx.teacherWorkshopEvaluation.findUnique({ where: { workshopId_staffId: { workshopId: id, staffId: session.staffId } } });
      if (existing?.status === AssessmentStatus.SUBMITTED || existing?.submittedAt) throw new Error("ALREADY_SUBMITTED");
      if (parsed.data.action === "submit" && !isComplete(parsed.data.criteria, expectedIds)) throw new Error("INCOMPLETE");
      const now = serverNow();
      const evaluation = await tx.teacherWorkshopEvaluation.upsert({ where: { workshopId_staffId: { workshopId: id, staffId: session.staffId } }, update: { rating: parsed.data.overallSatisfaction ?? null, contentQuality: parsed.data.contentQuality ?? null, needFit: parsed.data.needFit ?? null, deliveryQuality: parsed.data.deliveryQuality ?? null, applicability: parsed.data.applicability ?? null, comment: parsed.data.comment?.trim() || null }, create: { workshopId: id, staffId: session.staffId, rating: parsed.data.overallSatisfaction ?? null, contentQuality: parsed.data.contentQuality ?? null, needFit: parsed.data.needFit ?? null, deliveryQuality: parsed.data.deliveryQuality ?? null, applicability: parsed.data.applicability ?? null, comment: parsed.data.comment?.trim() || null, status: AssessmentStatus.DRAFT } });
      if (parsed.data.criteria.length) {
        for (const item of parsed.data.criteria) {
          await tx.teacherCriterionEvaluation.upsert({
            where: { evaluationId_criterionId: { evaluationId: evaluation.id, criterionId: item.criterionId } },
            create: { evaluationId: evaluation.id, criterionId: item.criterionId, rating: item.rating ?? null },
            update: { rating: item.rating ?? null },
          });
        }
        const ratings = new Map<string, { value: number | null; criterionIds: string[] }>();
        for (const item of parsed.data.criteria) {
          const value = item.rating ?? null;
          const key = value === null ? "null" : String(value);
          const group = ratings.get(key) ?? { value, criterionIds: [] };
          group.criterionIds.push(item.criterionId);
          ratings.set(key, group);
        }
        for (const group of ratings.values()) {
          await tx.teacherCriterionEvaluation.updateMany({ where: { evaluationId: evaluation.id, criterionId: { in: group.criterionIds } }, data: { rating: group.value } });
        }
      }
      if (parsed.data.action === "submit") {
        const locked = await tx.teacherWorkshopEvaluation.updateMany({ where: { id: evaluation.id, status: AssessmentStatus.DRAFT, submittedAt: null }, data: { status: AssessmentStatus.SUBMITTED, submittedAt: now } });
        if (locked.count !== 1) throw new Error("ALREADY_SUBMITTED");
      }
      if (parsed.data.action === "submit") await tx.auditLog.create({ data: { schoolId: session.schoolId, action: "TEACHER_EVALUATION_SUBMITTED", entity: "TeacherWorkshopEvaluation", entityId: evaluation.id, metadata: { workshopId: id, criterionCount: expectedIds.length } } });
      return { submitted: parsed.data.action === "submit", savedAt: now };
    });
    if (result.submitted) await auditTeacherSecurity({ action: "TEACHER_EVALUATION_SUBMITTED", schoolId: session.schoolId, metadata: { workshopId: id } });
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const messages: Record<string, string> = { NOT_PARTICIPANT: "لا تملك صلاحية تقييم هذه الورشة.", NOT_STARTED: "سيصبح التقييم متاحًا عند بدء الورشة.", EVALUATION_CLOSED: "انتهت فترة تقييم هذه الورشة.", INVALID_CRITERION: "يتضمن التقييم معيارًا غير مرتبط بالورشة.", ALREADY_SUBMITTED: "تم إرسال تقييمك لهذه الورشة ولا يمكن تعديله.", INCOMPLETE: "أكمل تقييم جميع معايير الورشة قبل الإرسال." };
    return NextResponse.json({ error: messages[code] ?? "تعذر حفظ التقييم" }, { status: code === "NOT_PARTICIPANT" ? 403 : code === "INCOMPLETE" ? 422 : 409 });
  }
}
