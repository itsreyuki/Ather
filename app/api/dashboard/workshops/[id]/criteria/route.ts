import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/src/lib/auth";
import { assertApiPermission } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";

const criterionSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional(),
  managerPrompt: z.string().trim().max(1000).optional(),
  participantPrompt: z.string().trim().max(1000).optional(),
  category: z.string().trim().max(120).optional(),
  guidance: z.string().trim().max(2000).optional(),
  weight: z.number().min(0).max(100),
  targetValue: z.number().min(1).max(5).nullable().optional(),
});
const schema = z.object({ criteria: z.array(criterionSchema).max(50) });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session?.membership) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const denied = assertApiPermission(session, Permission.WorkshopsWrite);
  if (denied) return denied;
  const { id } = await params;
  const workshop = await db.workshop.findFirst({
    where: { id, schoolId: session.membership.schoolId, deletedAt: null },
    include: { criteria: { select: { id: true } } },
  });
  if (!workshop) return NextResponse.json({ error: "لم يتم العثور على الورشة" }, { status: 404 });
  if (workshop.finalizedAt) return NextResponse.json({ error: "الورشة معتمدة ومقفلة" }, { status: 409 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "بيانات المعايير غير صالحة" }, { status: 400 });
  const criteria = parsed.data.criteria;
  const existingIds = new Set(workshop.criteria.map((item) => item.id));
  if (criteria.some((item) => item.id && !existingIds.has(item.id)))
    return NextResponse.json({ error: "يوجد معيار لا ينتمي إلى هذه الورشة" }, { status: 422 });
  const idsToKeep = criteria.flatMap((item) => (item.id ? [item.id] : []));
  const saved = await db.$transaction(async (tx) => {
    await tx.managerAssessment.deleteMany({ where: { workshopId: id, criterionId: { notIn: idsToKeep } } });
    await tx.workshopCriterion.deleteMany({ where: { workshopId: id, id: { notIn: idsToKeep } } });
    for (const [index, item] of criteria.entries()) {
      if (item.id)
        await tx.workshopCriterion.update({
          where: { id: item.id },
          data: {
            name: item.name,
            description: item.description || null,
            managerPrompt: item.managerPrompt || null,
            participantPrompt: item.participantPrompt || null,
            category: item.category || null,
            guidance: item.guidance || null,
            weight: item.weight,
            targetValue: item.targetValue ?? null,
            displayOrder: index,
          },
        });
      else
        await tx.workshopCriterion.create({
          data: {
            workshopId: id,
            name: item.name,
            description: item.description || null,
            managerPrompt: item.managerPrompt || null,
            participantPrompt: item.participantPrompt || null,
            category: item.category || null,
            guidance: item.guidance || null,
            weight: item.weight,
            targetValue: item.targetValue ?? null,
            displayOrder: index,
          },
        });
    }
    return tx.workshopCriterion.findMany({ where: { workshopId: id }, orderBy: { displayOrder: "asc" } });
  });
  return NextResponse.json({ criteria: saved });
}
