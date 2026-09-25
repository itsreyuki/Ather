import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { createProfessionalPlanTemplate } from "@/src/lib/professional-growth-plans";
import { Permission } from "@/src/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requireDashboardContext({ permission: Permission.ProfessionalGrowthPlansWrite });
  const workbook = await createProfessionalPlanTemplate();
  return new Response(workbook, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=athar-professional-growth-plan-template.xlsx",
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
