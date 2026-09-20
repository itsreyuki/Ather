import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/src/lib/auth";
import { assertApiPermission } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";

const schema = z.object({ name: z.string().trim().min(2).max(160) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session?.membership) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const denied = assertApiPermission(session, Permission.WorkshopsWrite);
  if (denied) return denied;
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "اسم القالب غير صالح" }, { status: 400 });
  const workshop = await db.workshop.findFirst({
    where: { id, schoolId: session.membership.schoolId, deletedAt: null },
    include: { criteria: { orderBy: { displayOrder: "asc" } } },
  });
  if (!workshop) return NextResponse.json({ error: "لم يتم العثور على الورشة" }, { status: 404 });
  if (!workshop.criteria.length)
    return NextResponse.json({ error: "أضف معيارًا واحدًا على الأقل قبل حفظ القالب" }, { status: 400 });
  const template = await db.$transaction(async (tx) => {
    const created = await tx.workshopTemplate.create({
      data: {
        schoolId: session.membership!.schoolId,
        name: parsed.data.name,
        workshopType: workshop.workshopType,
        description: workshop.description,
        objectives: workshop.objectives,
        category: workshop.category,
        deliveryMode: workshop.deliveryMode,
        criteria: {
          create: workshop.criteria.map((item) => ({
            name: item.name,
            description: item.description,
            category: item.category,
            guidance: item.guidance,
            weight: item.weight,
            targetValue: item.targetValue,
            displayOrder: item.displayOrder,
          })),
        },
      },
      include: { criteria: { orderBy: { displayOrder: "asc" } } },
    });
    await tx.auditLog.create({
      data: {
        schoolId: session.membership!.schoolId,
        userId: session.user.id,
        action: "WORKSHOP_TEMPLATE_CREATED",
        entity: "WorkshopTemplate",
        entityId: created.id,
        metadata: { sourceWorkshopId: workshop.id },
      },
    });
    return created;
  });
  return NextResponse.json({ template }, { status: 201 });
}
