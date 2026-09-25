import { ArrowRight, Download, FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/src/components/ui/page-header";
import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";

function number(value: unknown, suffix = "") {
  return typeof value === "number" && Number.isFinite(value)
    ? `${new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(value)}${suffix}`
    : "—";
}

export default async function ProfessionalGrowthPlanReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireDashboardContext({ permission: Permission.ReportsRead });
  const { id } = await params;
  const report = await db.professionalGrowthPlanReportSnapshot.findFirst({
    where: { planId: id, schoolId: session.membership!.schoolId, immutable: true },
    select: { id: true, generatedAt: true, snapshot: true },
  });
  if (!report) notFound();
  const snapshot = report.snapshot as Record<string, unknown>;
  const plan = (snapshot.plan ?? {}) as Record<string, unknown>;
  const summary = (snapshot.summary ?? {}) as Record<string, unknown>;
  const programs = (snapshot.programs ?? []) as Array<Record<string, unknown>>;
  const exportBase = `/api/dashboard/professional-growth-plans/${id}/report/export`;
  return (
    <main className="reports-overview-page">
      <PageHeader
        eyebrow={String(plan.periodLabel ?? "")}
        title={`تقرير ${String(plan.title ?? "خطة النمو المهني")}`}
        description={`تقرير ثابت صدر في ${new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(report.generatedAt)}.`}
        action={
          <Link className="button button-secondary" href={`/dashboard/professional-growth-plans/${id}`}>
            <ArrowRight size={15} /> العودة للخطة
          </Link>
        }
      />
      <div className="report-export-actions">
        <a className="button button-secondary" href={`${exportBase}?format=pdf`}>
          <FileText size={15} /> تحميل PDF
        </a>
        <a className="button button-secondary" href={`${exportBase}?format=xlsx`}>
          <Download size={15} /> تحميل Excel
        </a>
      </div>
      <section className="report-hero-metrics">
        <article className="report-metric-card">
          <span>عدد البرامج</span>
          <strong>{number(summary.programCount)}</strong>
        </article>
        <article className="report-metric-card">
          <span>البرامج المكتملة</span>
          <strong>{number(summary.completedProgramCount)}</strong>
        </article>
        <article className="report-metric-card">
          <span>متوسط مؤشر الأثر</span>
          <strong>{number(summary.averageImpact, "٪")}</strong>
        </article>
        <article className="report-metric-card">
          <span>متوسط التحسن</span>
          <strong>{number(summary.averageScaleImprovement, "٪")}</strong>
        </article>
        <article className="report-metric-card">
          <span>استجابة المشاركين</span>
          <strong>{number(summary.averageTeacherResponseRate, "٪")}</strong>
        </article>
      </section>
      <section className="report-panel">
        <div className="report-section-heading">
          <div>
            <h2>ملخص البرامج</h2>
            <p>يعرض كل برنامج بمؤشراته المعتمدة بصورة مستقلة؛ البرامج الملغاة لا تدخل في المتوسطات.</p>
          </div>
        </div>
        <div className="report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>البرنامج</th>
                <th>النوع</th>
                <th>المنفذ</th>
                <th>الحالة</th>
                <th>الأثر</th>
                <th>التحسن</th>
                <th>الاستجابة</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((program) => (
                <tr key={String(program.id)}>
                  <td>
                    {program.reportId ? (
                      <Link className="table-link" href={`/dashboard/workshops/${String(program.id)}/report`}>
                        {String(program.title ?? "—")}
                      </Link>
                    ) : (
                      String(program.title ?? "—")
                    )}
                  </td>
                  <td>{String(program.programTypeLabel ?? "—")}</td>
                  <td>{String(program.facilitator ?? "—")}</td>
                  <td>{String(program.status ?? "—")}</td>
                  <td>{number(program.impact, "٪")}</td>
                  <td>{number(program.scaleImprovement, "٪")}</td>
                  <td>{number(program.teacherResponseRate, "٪")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="form-info">{String(snapshot.methodology ?? "")}</p>
    </main>
  );
}
