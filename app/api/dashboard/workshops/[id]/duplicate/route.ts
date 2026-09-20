import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/src/lib/auth";
import { assertApiPermission } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";

const schema = z.object({ copyParticipants: z.boolean().optional().default(false) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session?.membership) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const denied = assertApiPermission(session, Permission.WorkshopsCreate);
  if (denied) return denied;
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "خيارات النسخ غير صالحة" }, { status: 400 });
  const original = await db.workshop.findFirst({
    where: { id, schoolId: session.membership.schoolId, deletedAt: null },
    include: { criteria: { orderBy: { displayOrder: "asc" } }, participants: { select: { staffId: true } } },
  });
  if (!original) return NextResponse.json({ error: "لم يتم العثور على الورشة" }, { status: 404 });
  const copy = await db.$transaction(async (tx) => {
    const created = await tx.workshop.create({
      data: {
        schoolId: original.schoolId,
        title: `${original.title} — نسخة جديدة`,
        description: original.description,
        facilitator: original.facilitator,
        location: original.location,
        providerOrganization: original.providerOrganization,
        workshopType: original.workshopType,
        category: original.category,
        deliveryMode: original.deliveryMode,
        locationOrUrl: original.locationOrUrl,
        objectives: original.objectives,
        notes: original.notes,
        status: "DRAFT",
        draftStep: 1,
        criteria: {
          create: original.criteria.map((item) => ({
            name: item.name,
            description: item.description,
            category: item.category,
            guidance: item.guidance,
            managerPrompt: item.managerPrompt,
            participantPrompt: item.participantPrompt,
            weight: item.weight,
            targetValue: item.targetValue,
            displayOrder: item.displayOrder,
          })),
        },
        ...(parsed.data.copyParticipants
          ? { participants: { create: original.participants.map((item) => ({ staffId: item.staffId })) } }
          : {}),
      },
      include: { _count: { select: { criteria: true, participants: true } } },
    });
    await tx.auditLog.create({
      data: {
        schoolId: original.schoolId,
        userId: session.user.id,
        action: "WORKSHOP_DUPLICATED",
        entity: "Workshop",
        entityId: created.id,
        metadata: { sourceWorkshopId: original.id, copyParticipants: parsed.data.copyParticipants },
      },
    });
    return created;
  });
  return NextResponse.json(
    { id: copy.id, nextPath: `/dashboard/workshops/new?id=${copy.id}` },
    { status: 201 },
  );
}
