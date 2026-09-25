import { ArrowRight, FileBarChart2, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanReportAction } from "@/src/components/professional-growth-plans/plan-report-action";
import { PageHeader } from "@/src/components/ui/page-header";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { planWorkshopState, programTypeLabels } from "@/src/lib/professional-growth-plans";
import { Permission } from "@/src/lib/permissions";

const labels = { DRAFT: "تحتاج استكمالًا", ACTIVE: "فعالة", COMPLETED: "مكتملة" } as const;
const tones = { DRAFT: "warning", ACTIVE: "info", COMPLETED: "success" } as const;

export default async function ProfessionalGrowthPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireDashboardContext({ permission: Permission.ProfessionalGrowthPlansRead });
  const { id } = await params;
  const plan = await db.professionalGrowthPlan.findFirst({
    where: { id, schoolId: session.membership!.schoolId },
    include: {
      report: { select: { id: true } },
      programs: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { participants: true } } },
      },
    },
  });
  if (!plan) notFound();
  const prepared = plan.programs.filter((program) => program.finalizedAt || program.cancelledAt).length;
  const completion = plan.programs.length ? Math.round((prepared / plan.programs.length) * 100) : 0;
  return (
    <>
      <PageHeader
        eyebrow={plan.periodLabel}
        title={plan.title}
        description={`جاهزية الخطة ${completion.toLocaleString("ar-SA")}٪ · أكمل إعداد وقياس كل برنامج لتصبح الخطة فعالة.`}
        action={
          <Link className="button button-secondary" href="/dashboard/professional-growth-plans">
            <ArrowRight size={15} /> كل الخطط
          </Link>
        }
      />
      <section className="plan-detail-summary">
        <div>
          <span>حالة الخطة</span>
          <StatusBadge tone={tones[plan.status]}>{labels[plan.status]}</StatusBadge>
        </div>
        <div>
          <span>برامج جاهزة</span>
          <strong>
            {prepared.toLocaleString("ar-SA")} من {plan.programs.length.toLocaleString("ar-SA")}
          </strong>
        </div>
        <div>
          <span>البرامج المنتهية</span>
          <strong>
            {plan.programs
              .filter((program) => program.postAssessmentSubmittedAt || program.cancelledAt)
              .length.toLocaleString("ar-SA")}
          </strong>
        </div>
        {plan.report ? (
          <Link
            className="button button-primary"
            href={`/dashboard/professional-growth-plans/${plan.id}/report`}
          >
            <FileBarChart2 size={15} /> عرض التقرير
          </Link>
        ) : plan.status === "COMPLETED" ? (
          <PlanReportAction planId={plan.id} />
        ) : null}
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">برامج الخطة</h2>
            <p className="panel-caption">كل برنامج هنا ورشة مرتبطة بالخطة ويستخدم مراحل القياس المعتادة.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>البرنامج</th>
                <th>النوع</th>
                <th>المنفذ</th>
                <th>المشاركون</th>
                <th>الإجراء الحالي</th>
              </tr>
            </thead>
            <tbody>
              {plan.programs.map((program) => (
                <tr key={program.id}>
                  <td>
                    <Link className="table-link" href={`/dashboard/workshops/new?id=${program.id}`}>
                      {program.title}
                    </Link>
                  </td>
                  <td>{program.programType ? programTypeLabels[program.programType] : "غير محدد"}</td>
                  <td>{program.facilitator ?? "غير محدد"}</td>
                  <td>{program._count.participants.toLocaleString("ar-SA")}</td>
                  <td>
                    <Link
                      className="button button-secondary"
                      href={`/dashboard/workshops/new?id=${program.id}`}
                    >
                      {planWorkshopState(
                        program.status,
                        program.finalizedAt,
                        program.cancelledAt,
                        program.completedAt,
                      )}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {plan.programs.length === 0 && <p className="muted">لا توجد برامج في هذه الخطة.</p>}
      </section>
      {plan.status === "DRAFT" && (
        <p className="form-info">
          <Plus size={14} /> أكمل التاريخ والمعايير والأوزان والتقييم القبلي لكل برنامج. ستصبح الخطة فعالة
          تلقائيًا بعد اعتماد البرامج.
        </p>
      )}
    </>
  );
}
