import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/src/components/ui/page-header";
import { ProfessionalGrowthPlanBuilder } from "@/src/components/professional-growth-plans/plan-builder";
import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";

export default async function NewProfessionalGrowthPlanPage() {
  const session = await requireDashboardContext({ permission: Permission.ProfessionalGrowthPlansWrite });
  const staff = await db.staffMember.findMany({
    where: { schoolId: session.membership!.schoolId, active: true },
    select: { id: true, fullName: true, jobTitle: true },
    orderBy: { fullName: "asc" },
  });
  return (
    <>
      <PageHeader
        eyebrow="خطة النمو المهني"
        title="إنشاء خطة جديدة"
        description="رتّب برامج النمو المهني ثم أكمل قياس كل برنامج من مساحة الورش."
        action={
          <Link className="button button-secondary" href="/dashboard/professional-growth-plans">
            <ArrowRight size={15} /> العودة للخطط
          </Link>
        }
      />
      <ProfessionalGrowthPlanBuilder staff={staff} />
    </>
  );
}
