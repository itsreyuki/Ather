import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/src/lib/auth";
import { assertApiPermission } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";

const criterionSchema = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().max(120).optional(),
  guidance: z.string().trim().max(2000).optional(),
  weight: z.number().min(0).max(100),
  targetValue: z.number().min(1).max(5).nullable().optional(),
});
const schema = z.object({
  name: z.string().trim().min(2).max(160),
  workshopType: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  objectives: z.string().trim().max(4000).optional(),
  category: z.string().trim().max(120).optional(),
  deliveryMode: z.enum(["IN_PERSON", "REMOTE", "HYBRID"]).optional(),
  criteria: z.array(criterionSchema).min(1).max(50),
});

export async function GET() {
  const session = await getSessionContext();
  const denied = assertApiPermission(session, Permission.WorkshopsRead);
  if (denied) return denied;
  if (!session?.membership) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const templates = await db.workshopTemplate.findMany({
    where: { schoolId: session.membership.schoolId },
    orderBy: [{ updatedAt: "desc" }],
    include: { criteria: { orderBy: { displayOrder: "asc" } } },
  });
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  const denied = assertApiPermission(session, Permission.WorkshopsWrite);
  if (denied) return denied;
  if (!session?.membership) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "بيانات القالب غير صالحة" }, { status: 400 });
  const data = parsed.data;
  const template = await db.$transaction(async (tx) => {
    const created = await tx.workshopTemplate.create({
      data: {
        schoolId: session.membership!.schoolId,
        name: data.name,
        workshopType: data.workshopType || null,
        description: data.description || null,
        objectives: data.objectives || null,
        category: data.category || null,
        deliveryMode: data.deliveryMode ?? "IN_PERSON",
        criteria: {
          create: data.criteria.map((item, index) => ({
            name: item.name,
            description: item.description || null,
            category: item.category || null,
            guidance: item.guidance || null,
            weight: item.weight,
            targetValue: item.targetValue ?? null,
            displayOrder: index,
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
        metadata: { criteriaCount: data.criteria.length },
      },
    });
    return created;
  });
  return NextResponse.json({ template }, { status: 201 });
}
