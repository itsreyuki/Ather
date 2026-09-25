import { BarChart3, BookOpen, CalendarDays, FileCheck2, Users } from "lucide-react";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { CriterionTrends } from "@/src/components/reports/criterion-trends";
import { ReportComparison } from "@/src/components/reports/report-comparison";
import { ReportsOverviewCharts } from "@/src/components/reports/reports-overview-charts";
import { CalendarDateInput } from "@/src/components/ui/calendar-date-input";
import { PageHeader } from "@/src/components/ui/page-header";
import { StatCard } from "@/src/components/ui/stat-card";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import {
  buildCriterionTrends,
  buildReportComparison,
  buildReportsOverview,
  normalizeReportPayload,
  type ReportsOverviewRow,
} from "@/src/lib/reporting";
import { Permission } from "@/src/lib/permissions";

const numberFormatter = new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" });
const analyticsReportLimit = 500;
function percentage(value: number | null) {
  return value === null ? "—" : `${numberFormatter.format(value)}٪`;
}
function parseDate(value: string | undefined, end = false) {
  if (!value) return undefined;
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireDashboardContext({ permission: Permission.ReportsRead });
  const query = await searchParams;
  const value = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : undefined);
  const values = (key: string) => {
    const item = query[key];
    return Array.isArray(item) ? item : item ? [item] : [];
  };
  const dateFrom = parseDate(value("from"));
  const dateTo = parseDate(value("to"), true);
  const category = value("category");
  const presenter = value("presenter");
  const status = value("status") ?? "COMPLETED";
  const selectedCompareIds = [...new Set(values("compare"))].slice(0, 5);
  const baseWhere = {
    schoolId: session.membership!.schoolId,
    deletedAt: null,
    status: "COMPLETED" as const,
    report: { isNot: null },
  };
  const reportWhere: Prisma.ReportSnapshotWhereInput = {
    schoolId: session.membership!.schoolId,
    workshop: {
      deletedAt: null,
      status: "COMPLETED",
      ...(dateFrom || dateTo
        ? { startsAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
        : {}),
      ...(category ? { category } : {}),
      ...(presenter ? { facilitator: presenter } : {}),
    },
  };
  const [reports, options, matchingReportCount] = await Promise.all([
    db.reportSnapshot.findMany({
      where: reportWhere,
      orderBy: { generatedAt: "desc" },
      take: analyticsReportLimit,
      select: {
        id: true,
        generatedAt: true,
        snapshot: true,
        metrics: true,
        workshop: {
          select: {
            id: true,
            title: true,
            category: true,
            facilitator: true,
            status: true,
            startsAt: true,
            endsAt: true,
          },
        },
      },
    }),
    db.workshop.findMany({
      where: baseWhere,
      select: { category: true, facilitator: true },
      orderBy: [{ category: "asc" }, { facilitator: "asc" }],
    }),
    db.reportSnapshot.count({ where: reportWhere }),
  ]);
  const rows: ReportsOverviewRow[] = reports.flatMap((report) => {
    const payload = normalizeReportPayload(report.snapshot ?? report.metrics);
    if (!payload) return [];
    return [
      {
        reportId: report.id,
        workshopId: report.workshop.id,
        title: report.workshop.title,
        category: report.workshop.category ?? "غير مصنف",
        presenter: report.workshop.facilitator ?? "غير محدد",
        status: report.workshop.status,
        generatedAt: report.generatedAt,
        workshopDate: report.workshop.startsAt,
        payload,
      },
    ];
  });
  const overview = buildReportsOverview(rows);
  const comparisonCandidates = buildReportComparison(
    rows,
    rows.map((row) => row.reportId),
  );
  const trends = buildCriterionTrends(rows);
  const categories = [...new Set(options.flatMap((item) => (item.category ? [item.category] : [])))];
  const presenters = [...new Set(options.flatMap((item) => (item.facilitator ? [item.facilitator] : [])))];
  const filterParams = { from: value("from"), to: value("to"), category, presenter, status };

  return (
    <>
      <PageHeader
        eyebrow="التحليل"
        title="التقارير والتحليلات"
        description="رؤية موحدة مبنية على تقارير الأثر الثابتة والمعتمدة."
      />
      <main className="reports-overview-page">
        <form className="report-filters" method="get">
          <CalendarDateInput label="من" name="from" defaultValue={value("from")} dateOnly />
          <CalendarDateInput label="إلى" name="to" defaultValue={value("to")} dateOnly />
          <div>
            <label htmlFor="report-category">المجال</label>
            <select id="report-category" name="category" defaultValue={category ?? ""}>
              <option value="">كل المجالات</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="report-presenter">المقدم</label>
            <select id="report-presenter" name="presenter" defaultValue={presenter ?? ""}>
              <option value="">كل المقدمين</option>
              {presenters.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="report-status">الحالة</label>
            <select id="report-status" name="status" defaultValue={status}>
              <option value="COMPLETED">مكتملة</option>
              <option value="ALL">كل التقارير</option>
            </select>
          </div>
          <button className="button button-primary" type="submit">
            تطبيق الفلاتر
          </button>
        </form>
        <section className="reports-stat-grid">
          <StatCard
            label="عدد الورش"
            value={overview.stats.workshopCount.toLocaleString("ar-SA")}
            detail="تقارير مكتملة"
            icon={<BookOpen size={16} />}
          />
          <StatCard
            label="عدد المشاركات"
            value={overview.stats.participantCount.toLocaleString("ar-SA")}
            detail="حسب snapshots"
            icon={<Users size={16} />}
          />
          <StatCard
            label="متوسط الأثر"
            value={percentage(overview.stats.averageImpact)}
            detail="تحسن على المقياس"
            icon={<BarChart3 size={16} />}
          />
          <StatCard
            label="تقارير قابلة للمقارنة"
            value={overview.stats.comparisonCount.toLocaleString("ar-SA")}
            detail="تتوفر لها قبلي وبعدي"
            icon={<FileCheck2 size={16} />}
          />
        </section>
        <details className="methodology-tooltip reports-methodology">
          <summary>كيف نقرأ هذه التقارير؟</summary>
          <p>
            الأثر هو تغير المتوسطات بين القياس القبلي والبعدي، بينما تقييم المشاركين مؤشر منفصل عن أثر
            المعايير. شرائح الأثر وصف بصري قابل للضبط وليست حكمًا علميًا على نجاح التدريب.
          </p>
        </details>
        {matchingReportCount > reports.length && <div className="form-info" role="status">تعرض التحليلات أحدث {analyticsReportLimit.toLocaleString("ar-SA")} تقرير مطابق لحماية سرعة الصفحة. ضيّق نطاق التاريخ لتحليل التقارير الأقدم.</div>}
        {overview.stats.workshopCount === 0 ? (
          <section className="panel">
            <div className="reports-empty">
              <CalendarDays size={22} />
              <h2>لا توجد تقارير مطابقة</h2>
              <p>أنشئ تقريرًا بعد اكتمال قياسات ورشة أو عدّل الفلاتر الحالية.</p>
            </div>
          </section>
        ) : (
          <>
            <ReportsOverviewCharts trend={overview.trend} categories={overview.categories} />
            <ReportComparison
              rows={comparisonCandidates}
              selectedIds={selectedCompareIds}
              filterParams={filterParams}
            />
            <CriterionTrends trends={trends} />
            <section className="reports-two-column">
              <section className="report-panel">
                <div className="report-section-heading">
                  <div>
                    <h2>كل الورش</h2>
                    <p>مقارنة سريعة بين التقارير المعتمدة.</p>
                  </div>
                </div>
                <div className="report-table-wrap">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>الورشة</th>
                        <th>المجال</th>
                        <th>المقدم</th>
                        <th>المشاركون</th>
                        <th>الأثر</th>
                        <th>الاستجابة</th>
                        <th>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.reportId}>
                          <td>
                            <Link
                              className="table-link"
                              href={`/dashboard/workshops/${row.workshopId}/report`}
                            >
                              {row.title}
                            </Link>
                            <small>{dateFormatter.format(row.generatedAt)}</small>
                          </td>
                          <td>{row.category}</td>
                          <td>{row.presenter}</td>
                          <td>{row.payload.participantCount.toLocaleString("ar-SA")}</td>
                          <td>{percentage(row.payload.aggregates.overallScaleImprovementPercentage)}</td>
                          <td>{percentage(row.payload.teacherAggregates.responseRatePercentage)}</td>
                          <td>
                            <StatusBadge tone="success">مكتملة</StatusBadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="report-panel follow-up-panel">
                <div className="report-section-heading">
                  <div>
                    <h2>ورش تحتاج متابعة</h2>
                    <p>تحتاج قراءة تفصيلية بسبب تراجع معيار أو انخفاض الاستجابة.</p>
                  </div>
                </div>
                {overview.needsFollowUp.length ? (
                  <ul className="follow-up-list">
                    {overview.needsFollowUp.map((row) => (
                      <li key={row.reportId}>
                        <div>
                          <Link href={`/dashboard/workshops/${row.workshopId}/report`}>{row.title}</Link>
                          <small>
                            {row.category} · {row.presenter}
                          </small>
                        </div>
                        <span>{percentage(row.payload.aggregates.overallScaleImprovementPercentage)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="reports-empty compact">
                    <FileCheck2 size={18} />
                    <span>لا توجد ورش تحتاج متابعة وفق البيانات الحالية.</span>
                  </div>
                )}
              </section>
            </section>
          </>
        )}
      </main>
    </>
  );
}
