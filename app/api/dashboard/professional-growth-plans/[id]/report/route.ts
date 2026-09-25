import { NextResponse } from "next/server";
import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { writeAuditLog } from "@/src/lib/authorization";
import { buildProfessionalGrowthPlanSnapshot } from "@/src/lib/professional-growth-plans";
import { Permission } from "@/src/lib/permissions";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireDashboardContext({ permission: Permission.ReportsRead });
  const { id } = await params;
  try {
    const report = await buildProfessionalGrowthPlanSnapshot(session.membership!.schoolId, id);
    await writeAuditLog({
      schoolId: session.membership!.schoolId,
      userId: session.user.id,
      action: "PROFESSIONAL_GROWTH_PLAN_REPORT_GENERATED",
      entity: "ProfessionalGrowthPlanReportSnapshot",
      entityId: report.id,
      metadata: { planId: id, immutable: true },
    });
    return NextResponse.json({
      reportId: report.id,
      nextPath: `/dashboard/professional-growth-plans/${id}/report`,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json(
      {
        error:
          code === "PLAN_NOT_COMPLETE"
            ? "يصبح تقرير الخطة متاحًا بعد انتهاء جميع البرامج."
            : "تعذر إنشاء تقرير الخطة.",
      },
      { status: code === "PLAN_NOT_COMPLETE" ? 422 : 404 },
    );
  }
}
