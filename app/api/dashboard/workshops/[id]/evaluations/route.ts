import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/src/lib/auth";
import { assertApiPermission } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";
import { serverNow } from "@/src/lib/clock";
import { saveManagerAssessments } from "@/src/lib/manager-assessment-service";

const itemSchema = z.object({
  participantId: z.string().min(1),
  criterionId: z.string().min(1),
  score: z.number().int().min(1).max(5),
});
const schema = z.object({
  phase: z.enum(["PRE", "POST"]).default("PRE"),
  items: z.array(itemSchema).min(1).max(1000),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session?.membership) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const denied = assertApiPermission(session, Permission.WorkshopsWrite);
  if (denied) return denied;
  const { id } = await params;
  const workshop = await db.workshop.findFirst({
    where: { id, schoolId: session.membership.schoolId, deletedAt: null },
    select: {
      id: true,
      finalizedAt: true,
      cancelledAt: true,
      postAssessmentSubmittedAt: true,
      startsAt: true,
      endsAt: true,
    },
  });
  if (!workshop) return NextResponse.json({ error: "لم يتم العثور على الورشة" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "قيم التقييم يجب أن تكون بين 1 و5" }, { status: 400 });
  if (parsed.data.phase === "PRE" && workshop.finalizedAt)
    return NextResponse.json({ error: "التقييم القبلي مقفل بعد اعتماد الورشة" }, { status: 409 });
  const participantIds = [...new Set(parsed.data.items.map((item) => item.participantId))];
  const criterionIds = [...new Set(parsed.data.items.map((item) => item.criterionId))];
  const [participants, criteria] = await Promise.all([
    db.workshopParticipant.findMany({
      where: { workshopId: id, id: { in: participantIds } },
      select: { id: true },
    }),
    db.workshopCriterion.findMany({
      where: { workshopId: id, id: { in: criterionIds } },
      select: { id: true },
    }),
  ]);
  if (participants.length !== participantIds.length || criteria.length !== criterionIds.length)
    return NextResponse.json({ error: "يوجد تقييم لا ينتمي إلى هذه الورشة" }, { status: 422 });
  if (workshop.cancelledAt || (parsed.data.phase === "POST" && workshop.postAssessmentSubmittedAt))
    return NextResponse.json({ error: "لا يمكن تعديل تقييمات هذه الورشة" }, { status: 409 });
  if (parsed.data.phase === "POST") {
    const now = serverNow();
    if (!workshop.finalizedAt || !workshop.startsAt || !workshop.endsAt || now < workshop.endsAt)
      return NextResponse.json(
        { error: "التقييم البعدي غير متاح قبل نهاية الورشة واعتمادها" },
        { status: 422 },
      );
  }
  try {
    await saveManagerAssessments({
      schoolId: session.membership!.schoolId,
      workshopId: id,
      phase: parsed.data.phase,
      items: parsed.data.items,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ASSESSMENT_LOCKED")
      return NextResponse.json(
        { error: "تم قفل تقييمات هذه الورشة أو لم تعد قابلة للتعديل" },
        { status: 409 },
      );
    throw error;
  }
  return NextResponse.json({ saved: parsed.data.items.length });
}
