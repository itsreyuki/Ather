import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/src/lib/auth";
import { assertApiPermission } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";
import { serverNow } from "@/src/lib/clock";
import { refreshProfessionalGrowthPlanStatus } from "@/src/lib/professional-growth-plans";

const schema = z.object({
  reason: z.string().trim().min(5).max(1000),
  confirmation: z.literal("إلغاء الورشة"),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session?.membership) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const denied = assertApiPermission(session, Permission.WorkshopsWrite);
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "سبب الإلغاء والتأكيد مطلوبان" }, { status: 400 });
  const { id } = await params;
  try {
    await db.$transaction(async (tx) => {
      await tx.school.update({
        where: { id: session.membership!.schoolId },
        data: { updatedAt: serverNow() },
      });
      const workshop = await tx.workshop.findFirst({
        where: { id, schoolId: session.membership!.schoolId, deletedAt: null },
        select: { finalizedAt: true, completedAt: true, cancelledAt: true, professionalGrowthPlanId: true },
      });
      if (!workshop) throw new Error("NOT_FOUND");
      if (!workshop.finalizedAt || workshop.completedAt || workshop.cancelledAt)
        throw new Error("NOT_CANCELLABLE");
      const cancelledAt = serverNow();
      const updated = await tx.workshop.updateMany({
        where: {
          id,
          schoolId: session.membership!.schoolId,
          deletedAt: null,
          completedAt: null,
          cancelledAt: null,
        },
        data: { status: "CANCELLED", cancelledAt, cancellationReason: parsed.data.reason },
      });
      if (updated.count !== 1) throw new Error("NOT_CANCELLABLE");
      await tx.auditLog.create({
        data: {
          schoolId: session.membership!.schoolId,
          userId: session.user.id,
          action: "WORKSHOP_CANCELLED",
          entity: "Workshop",
          entityId: id,
          metadata: { reason: parsed.data.reason },
        },
      });
      if (workshop.professionalGrowthPlanId)
        await refreshProfessionalGrowthPlanStatus(tx, {
          schoolId: session.membership!.schoolId,
          planId: workshop.professionalGrowthPlanId,
          userId: session.user.id,
        });
    });
    return NextResponse.json({ cancelled: true, nextPath: `/dashboard/workshops/${id}` });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json(
      {
        error:
          code === "NOT_FOUND" ? "لم يتم العثور على الورشة" : "لا يمكن إلغاء هذه الورشة في حالتها الحالية",
      },
      { status: code === "NOT_FOUND" ? 404 : 409 },
    );
  }
}
