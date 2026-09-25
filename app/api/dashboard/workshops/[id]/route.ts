import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/src/lib/auth";
import { assertApiPermission } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";
import { parseWorkshopDate } from "@/src/lib/workshop-schedule";
import { ProgramType } from "@prisma/client";

const schema = z
  .object({
    title: z.string().trim().max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    facilitator: z.string().trim().max(200).optional(),
    facilitatorStaffId: z.string().min(1).nullable().optional(),
    providerOrganization: z.string().trim().max(200).optional(),
    workshopType: z.string().trim().max(120).optional(),
    programType: z.nativeEnum(ProgramType).nullable().optional(),
    category: z.string().trim().max(120).optional(),
    deliveryMode: z.enum(["IN_PERSON", "REMOTE", "HYBRID"]).optional(),
    locationOrUrl: z.string().trim().max(500).optional(),
    startsAt: z.string().nullable().optional(),
    endsAt: z.string().nullable().optional(),
    objectives: z.string().trim().max(4000).optional(),
    notes: z.string().trim().max(4000).optional(),
    draftStep: z.number().int().min(0).max(5).optional(),
  })
  .strict();

function parsedDate(value: string | null | undefined) {
  return parseWorkshopDate(value);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session?.membership) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const denied = assertApiPermission(session, Permission.WorkshopsWrite);
  if (denied) return denied;
  const { id } = await params;
  const workshop = await db.workshop.findFirst({
    where: { id, schoolId: session.membership.schoolId, deletedAt: null },
    select: { id: true, finalizedAt: true },
  });
  if (!workshop) return NextResponse.json({ error: "لم يتم العثور على الورشة" }, { status: 404 });
  if (workshop.finalizedAt) return NextResponse.json({ error: "الورشة معتمدة ومقفلة" }, { status: 409 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "بيانات المسودة غير صالحة" }, { status: 400 });
  const data = parsed.data;
  const startsAt = parsedDate(data.startsAt);
  const endsAt = parsedDate(data.endsAt);
  if ((data.startsAt && startsAt === undefined) || (data.endsAt && endsAt === undefined))
    return NextResponse.json({ error: "صيغة التاريخ غير صالحة" }, { status: 400 });
  if (startsAt && endsAt && endsAt <= startsAt)
    return NextResponse.json({ error: "تاريخ النهاية يجب أن يكون بعد البداية" }, { status: 400 });
  const facilitator = data.facilitatorStaffId
    ? await db.staffMember.findFirst({
        where: { id: data.facilitatorStaffId, schoolId: session.membership.schoolId, active: true },
        select: { id: true, fullName: true },
      })
    : null;
  if (data.facilitatorStaffId && !facilitator)
    return NextResponse.json({ error: "اختر منفذًا نشطًا من منسوبي المدرسة." }, { status: 422 });
  await db.workshop.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title || "مسودة ورشة" } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.facilitator !== undefined || data.facilitatorStaffId !== undefined
        ? { facilitator: (facilitator?.fullName ?? data.facilitator) || null }
        : {}),
      ...(data.facilitatorStaffId !== undefined ? { facilitatorStaffId: facilitator?.id ?? null } : {}),
      ...(data.providerOrganization !== undefined
        ? { providerOrganization: data.providerOrganization || null }
        : {}),
      ...(data.workshopType !== undefined ? { workshopType: data.workshopType || null } : {}),
      ...(data.programType !== undefined ? { programType: data.programType } : {}),
      ...(data.category !== undefined ? { category: data.category || null } : {}),
      ...(data.deliveryMode !== undefined ? { deliveryMode: data.deliveryMode } : {}),
      ...(data.locationOrUrl !== undefined ? { locationOrUrl: data.locationOrUrl || null } : {}),
      ...(data.startsAt !== undefined ? { startsAt } : {}),
      ...(data.endsAt !== undefined ? { endsAt } : {}),
      ...(data.objectives !== undefined ? { objectives: data.objectives || null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      ...(data.draftStep !== undefined ? { draftStep: data.draftStep } : {}),
    },
  });
  return NextResponse.json({ saved: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session?.membership) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const denied = assertApiPermission(session, Permission.WorkshopsDelete);
  if (denied) return denied;
  const { id } = await params;
  const schoolId = session.membership.schoolId;

  const result = await db.$transaction(async (transaction) => {
    const workshop = await transaction.workshop.findFirst({
      where: { id, schoolId, deletedAt: null },
      select: { id: true, title: true, status: true, finalizedAt: true, report: { select: { id: true } } },
    });
    if (!workshop) return null;

    const updated = await transaction.workshop.updateMany({
      where: { id, schoolId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (updated.count !== 1) return null;

    await transaction.auditLog.create({
      data: {
        schoolId,
        userId: session.user.id,
        action: "WORKSHOP_DELETED",
        entity: "Workshop",
        entityId: workshop.id,
        metadata: {
          status: workshop.status,
          wasFinalized: Boolean(workshop.finalizedAt),
          retainedReportSnapshot: Boolean(workshop.report),
        },
      },
    });
    return workshop;
  });

  if (!result) return NextResponse.json({ error: "الورشة غير موجودة أو تم حذفها مسبقًا" }, { status: 404 });
  return NextResponse.json({ deleted: true, nextPath: "/dashboard/workshops" });
}
