import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { programTypeLabels } from "@/src/lib/professional-growth-plans";
import { Permission } from "@/src/lib/permissions";
import { ProgramType } from "@prisma/client";

const programSchema = z.object({
  title: z.string().trim().min(2).max(200),
  programType: z.nativeEnum(ProgramType),
  facilitatorStaffId: z.string().trim().optional(),
  facilitatorName: z.string().trim().min(2).max(200).optional(),
  participantIds: z.array(z.string().min(1)).min(1).max(500),
  matchState: z.enum(["MATCHED", "MISSING", "AMBIGUOUS"]).optional(),
  resolvedFromImport: z.boolean().optional(),
}).refine((program) => Boolean(program.facilitatorStaffId || program.facilitatorName?.trim()), {
  message: "يجب تحديد منسوب أو إدخال اسم منفذ مخصص.",
  path: ["facilitatorName"],
});
const schema = z.object({
  title: z.string().trim().min(2).max(200),
  periodLabel: z.string().trim().min(2).max(100),
  programs: z.array(programSchema).min(1).max(100),
});

export async function POST(request: Request) {
  const session = await requireDashboardContext({ permission: Permission.ProfessionalGrowthPlansWrite });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "أكمل اسم الخطة وفترتها وبرنامجًا واحدًا على الأقل." },
      { status: 400 },
    );
  const { title, periodLabel, programs } = parsed.data;
  const schoolId = session.membership!.schoolId;
  const requestedStaffIds = [
    ...new Set(programs.flatMap((program) => [program.facilitatorStaffId, ...program.participantIds].filter((id): id is string => Boolean(id)))),
  ];
  const staff = await db.staffMember.findMany({
    where: { schoolId, active: true, id: { in: requestedStaffIds } },
    select: { id: true, fullName: true },
  });
  if (staff.length !== requestedStaffIds.length)
    return NextResponse.json({ error: "اختر مشاركين نشطين من منسوبي المدرسة، وتأكد من صحة المنفذ." }, { status: 422 });
  const staffById = new Map(staff.map((item) => [item.id, item]));
  const plan = await db.$transaction(async (tx) => {
    const created = await tx.professionalGrowthPlan.create({ data: { schoolId, title, periodLabel } });
    for (const program of programs) {
      const facilitator = program.facilitatorStaffId ? staffById.get(program.facilitatorStaffId) : null;
      const facilitatorName = facilitator?.fullName ?? program.facilitatorName?.trim();
      if (!facilitatorName) throw new Error("FACILITATOR_REQUIRED");
      const participantIds = [...new Set(program.participantIds)];
      const workshop = await tx.workshop.create({
        data: {
          schoolId,
          professionalGrowthPlanId: created.id,
          title: program.title,
          facilitator: facilitatorName,
          facilitatorStaffId: facilitator?.id ?? null,
          programType: program.programType,
          workshopType: programTypeLabels[program.programType],
          draftStep: 1,
          participants: { createMany: { data: participantIds.map((staffId) => ({ staffId })) } },
        },
      });
      await tx.auditLog.create({
        data: {
          schoolId,
          userId: session.user.id,
          action: "PROFESSIONAL_GROWTH_PROGRAM_CREATED",
          entity: "Workshop",
          entityId: workshop.id,
          metadata: {
            planId: created.id,
            programType: program.programType,
            participantCount: participantIds.length,
          },
        },
      });
      if (program.resolvedFromImport)
        await tx.auditLog.create({
          data: {
            schoolId,
            userId: session.user.id,
            action: "PROFESSIONAL_GROWTH_EXECUTOR_RESOLVED",
            entity: "Workshop",
            entityId: workshop.id,
            metadata: { planId: created.id, resolution: "MANUAL" },
          },
        });
    }
    await tx.auditLog.create({
      data: {
        schoolId,
        userId: session.user.id,
        action: "PROFESSIONAL_GROWTH_PLAN_CREATED",
        entity: "ProfessionalGrowthPlan",
        entityId: created.id,
        metadata: { programCount: programs.length, periodLabel },
      },
    });
    return created;
  });
  return NextResponse.json(
    { id: plan.id, nextPath: `/dashboard/professional-growth-plans/${plan.id}` },
    { status: 201 },
  );
}
