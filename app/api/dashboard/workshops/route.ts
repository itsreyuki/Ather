import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/src/lib/auth";
import { assertApiPermission } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";
import { parseWorkshopDate } from "@/src/lib/workshop-schedule";
import { ProgramType } from "@prisma/client";

const deliveryModes = ["IN_PERSON", "REMOTE", "HYBRID"] as const;
const draftSchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    facilitator: z.string().trim().max(200).optional(),
    facilitatorStaffId: z.string().trim().optional(),
    providerOrganization: z.string().trim().max(200).optional(),
    workshopType: z.string().trim().max(120).optional(),
    programType: z.nativeEnum(ProgramType).optional(),
    category: z.string().trim().max(120).optional(),
    deliveryMode: z.enum(deliveryModes).optional(),
    locationOrUrl: z.string().trim().max(500).optional(),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    objectives: z.string().trim().max(4000).optional(),
    notes: z.string().trim().max(4000).optional(),
    draftStep: z.number().int().min(0).max(5).optional(),
  })
  .strict();

function parseDate(value?: string) {
  return parseWorkshopDate(value);
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session?.membership)
    return NextResponse.json({ error: "يجب تسجيل الدخول وإكمال إعداد المدرسة" }, { status: 401 });
  const denied = assertApiPermission(session, Permission.WorkshopsCreate);
  if (denied) return denied;
  const parsed = draftSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "بيانات المسودة غير صالحة" }, { status: 400 });
  const data = parsed.data;
  const startsAt = parseDate(data.startsAt);
  const endsAt = parseDate(data.endsAt);
  if ((data.startsAt && !startsAt) || (data.endsAt && !endsAt))
    return NextResponse.json({ error: "صيغة التاريخ غير صالحة" }, { status: 400 });
  if (startsAt && endsAt && endsAt <= startsAt)
    return NextResponse.json({ error: "تاريخ النهاية يجب أن يكون بعد البداية" }, { status: 400 });
  const facilitator = data.facilitatorStaffId
    ? await db.staffMember.findFirst({
        where: { id: data.facilitatorStaffId, schoolId: session.membership!.schoolId, active: true },
        select: { id: true, fullName: true },
      })
    : null;
  if (data.facilitatorStaffId && !facilitator)
    return NextResponse.json({ error: "اختر منفذًا نشطًا من منسوبي المدرسة." }, { status: 422 });
  const workshop = await db.$transaction(async (tx) => {
    const created = await tx.workshop.create({
      data: {
        schoolId: session.membership!.schoolId,
        title: data.title || "مسودة ورشة",
        description: data.description || null,
        facilitator: (facilitator?.fullName ?? data.facilitator) || null,
        facilitatorStaffId: facilitator?.id ?? null,
        providerOrganization: data.providerOrganization || null,
        workshopType: data.workshopType || null,
        programType: data.programType,
        category: data.category || null,
        deliveryMode: data.deliveryMode ?? "IN_PERSON",
        locationOrUrl: data.locationOrUrl || null,
        startsAt,
        endsAt,
        objectives: data.objectives || null,
        notes: data.notes || null,
        draftStep: data.draftStep ?? 1,
      },
    });
    await tx.auditLog.create({
      data: {
        schoolId: session.membership!.schoolId,
        userId: session.user.id,
        action: "WORKSHOP_CREATED",
        entity: "Workshop",
        entityId: created.id,
        metadata: { status: "DRAFT" },
      },
    });
    return created;
  });
  return NextResponse.json({ id: workshop.id }, { status: 201 });
}
