import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/src/lib/auth";
import { assertApiPermission } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";
import { serverNow } from "@/src/lib/clock";
import { validateCriteriaWeights } from "@/src/lib/criteria";

const schema = z.object({ confirmation: z.literal("اعتماد وبدء عملية القياس") });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session?.membership) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const denied = assertApiPermission(session, Permission.WorkshopsFinalize);
  if (denied) return denied;
  const { id } = await params;
  const confirmation = schema.safeParse(await request.json().catch(() => null));
  if (!confirmation.success) return NextResponse.json({ error: "يجب تأكيد اعتماد الورشة" }, { status: 400 });
  const workshop = await db.workshop.findFirst({
    where: { id, schoolId: session.membership.schoolId, deletedAt: null },
    include: {
      participants: { select: { id: true } },
      criteria: { select: { id: true, weight: true } },
      assessments: {
        where: { phase: "PRE" },
        select: { participantId: true, criterionId: true, score: true },
      },
    },
  });
  if (!workshop) return NextResponse.json({ error: "لم يتم العثور على الورشة" }, { status: 404 });
  if (workshop.title.trim().length < 2 || workshop.title === "مسودة ورشة")
    return NextResponse.json({ error: "أدخل اسم الورشة قبل الاعتماد" }, { status: 422 });
  if (!workshop.startsAt || !workshop.endsAt)
    return NextResponse.json({ error: "تاريخ البداية والنهاية مطلوبان" }, { status: 422 });
  if (workshop.endsAt <= workshop.startsAt)
    return NextResponse.json({ error: "تاريخ النهاية يجب أن يكون بعد البداية" }, { status: 422 });
  const minimumLeadMinutes = Number.parseInt(process.env.WORKSHOP_MIN_START_LEAD_MINUTES ?? "0", 10) || 0;
  if (workshop.startsAt.getTime() < serverNow().getTime() + minimumLeadMinutes * 60_000)
    return NextResponse.json(
      { error: `يجب أن يكون موعد البداية بعد ${minimumLeadMinutes.toLocaleString("ar-SA")} دقيقة على الأقل` },
      { status: 422 },
    );
  if (!workshop.participants.length)
    return NextResponse.json({ error: "اختر مشاركًا واحدًا على الأقل" }, { status: 422 });
  if (!workshop.criteria.length)
    return NextResponse.json({ error: "أضف معيارًا واحدًا على الأقل" }, { status: 422 });
  const weightValidation = validateCriteriaWeights(workshop.criteria);
  if (!weightValidation.ok)
    return NextResponse.json(
      {
        error: `مجموع أوزان المعايير يجب أن يساوي 100٪ (الحالي ${weightValidation.total.toLocaleString("ar-SA")}٪)`,
      },
      { status: 422 },
    );
  const expected = workshop.participants.length * workshop.criteria.length;
  const keys = new Set(
    workshop.assessments
      .filter((item) => item.score >= 1 && item.score <= 5)
      .map((item) => `${item.participantId}:${item.criterionId}`),
  );
  if (keys.size !== expected)
    return NextResponse.json(
      { error: `أكمل التقييم القبلي لكل المشاركين والمعايير (${keys.size} من ${expected})` },
      { status: 422 },
    );
  try {
    const report = await (
      await import("@/src/lib/workshop-service")
    ).finalizeWorkshopMeasurement(session.membership.schoolId, id, session.user.id);
    return NextResponse.json({
      finalized: true,
      reportId: report.id,
      nextPath: `/dashboard/workshops/${id}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر اعتماد الورشة";
    const validation = new Set([
      "WORKSHOP_INVALID_DETAILS",
      "WORKSHOP_DATES_REQUIRED",
      "WORKSHOP_END_BEFORE_START",
      "WORKSHOP_START_TOO_SOON",
      "WORKSHOP_INCOMPLETE",
      "WORKSHOP_WEIGHTS_INVALID",
      "PRE_ASSESSMENT_INCOMPLETE",
      "WORKSHOP_PROGRAM_METADATA_REQUIRED",
    ]);
    const status =
      validation.has(message) || message.includes("NOT_READY") || message.includes("INCOMPLETE") ? 422 : 409;
    const errors: Record<string, string> = {
      WORKSHOP_INVALID_DETAILS: "أدخل تفاصيل الورشة قبل اعتمادها",
      WORKSHOP_DATES_REQUIRED: "تاريخا البداية والنهاية مطلوبان",
      WORKSHOP_END_BEFORE_START: "يجب أن تكون النهاية بعد البداية",
      WORKSHOP_START_TOO_SOON: "يجب أن تكون البداية في المستقبل",
      WORKSHOP_INCOMPLETE: "أضف مشاركًا ومعيارًا وأكمل البيانات المطلوبة",
      WORKSHOP_WEIGHTS_INVALID: "يجب أن يساوي مجموع أوزان المعايير 100٪",
      PRE_ASSESSMENT_INCOMPLETE: "أكمل التقييم القبلي لكل مشارك ومعيار",
      WORKSHOP_PROGRAM_METADATA_REQUIRED: "اختر نوع البرنامج ومنفذًا من منسوبي المدرسة قبل الاعتماد",
    };
    return NextResponse.json(
      {
        error:
          errors[message] ??
          (message === "POST_ASSESSMENT_INCOMPLETE"
            ? "أكمل التقييمات البعدية قبل الاعتماد"
            : message === "WORKSHOP_NOT_READY"
              ? "التقييم البعدي غير متاح حاليًا"
              : "تعذر اعتماد الورشة"),
      },
      { status },
    );
  }
}
