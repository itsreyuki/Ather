import { Plus, Route } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/src/components/ui/empty-state";
import { PageHeader } from "@/src/components/ui/page-header";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";

const labels = { DRAFT: "تحتاج استكمالًا", ACTIVE: "فعالة", COMPLETED: "مكتملة" } as const;
const tone = { DRAFT: "warning", ACTIVE: "info", COMPLETED: "success" } as const;

export default async function ProfessionalGrowthPlansPage() {
  const session = await requireDashboardContext({ permission: Permission.ProfessionalGrowthPlansRead });
  const plans = await db.professionalGrowthPlan.findMany({
    where: { schoolId: session.membership!.schoolId },
    orderBy: { updatedAt: "desc" },
    include: {
      programs: {
        where: { deletedAt: null },
        select: { id: true, finalizedAt: true, cancelledAt: true, postAssessmentSubmittedAt: true },
      },
      report: { select: { id: true } },
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="التخطيط والتطوير"
        title="خطط النمو المهني"
        description="تابع البرامج، جاهزية القياس، والتقارير الشاملة لخطة المدرسة."
        action={
          <Link className="button button-primary" href="/dashboard/professional-growth-plans/new">
            <Plus size={16} /> خطة نمو مهني جديدة
          </Link>
        }
      />
      {plans.length === 0 ? (
        <EmptyState
          icon={<Route size={21} />}
          title="لا توجد خطط نمو مهني"
          description="أنشئ خطة تضم البرامج ومنفذيها ومشاركيها، ثم أكمل قياس كل برنامج."
          action={
            <Link className="button button-secondary" href="/dashboard/professional-growth-plans/new">
              <Plus size={15} /> إنشاء خطة
            </Link>
          }
        />
      ) : (
        <div className="plan-card-grid">
          {plans.map((plan) => {
            const prepared = plan.programs.filter(
              (program) => program.finalizedAt || program.cancelledAt,
            ).length;
            const completed = plan.programs.filter(
              (program) => program.postAssessmentSubmittedAt || program.cancelledAt,
            ).length;
            return (
              <Link
                className="plan-card"
                href={`/dashboard/professional-growth-plans/${plan.id}`}
                key={plan.id}
              >
                <div>
                  <span className="section-kicker">{plan.periodLabel}</span>
                  <h2>{plan.title}</h2>
                  <p>
                    {plan.programs.length.toLocaleString("ar-SA")} برامج · {prepared.toLocaleString("ar-SA")}{" "}
                    جاهزة للقياس · {completed.toLocaleString("ar-SA")} منتهية
                  </p>
                </div>
                <StatusBadge tone={tone[plan.status]}>{labels[plan.status]}</StatusBadge>
                <small>
                  {plan.report
                    ? "التقرير الشامل متاح"
                    : plan.status === "COMPLETED"
                      ? "التقرير جاهز للاستخراج"
                      : "استكمل البرامج لتفعيل الخطة"}
                </small>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
