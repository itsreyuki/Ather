import { ArrowRight, BarChart3, CheckCircle2, FileText, Lightbulb, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportCharts } from "@/src/components/reports/report-charts";
import { ReportDecisionSummary } from "@/src/components/reports/report-decision-summary";
import { ReportExportActions } from "@/src/components/reports/report-export-actions";
import { PrintReportDocument } from "@/src/components/reports/print-report-document";
import { EmptyState } from "@/src/components/ui/empty-state";
import { PageHeader } from "@/src/components/ui/page-header";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { db } from "@/src/lib/db";
import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { buildReportInsights, normalizeReportPayload } from "@/src/lib/reporting";
import { Permission } from "@/src/lib/permissions";

const dateFormatter = new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" });
const numberFormatter = new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 });

function percentage(value: number | null) { return value === null ? "—" : `${numberFormatter.format(value)}٪`; }
function score(value: number | null) { return value === null ? "—" : numberFormatter.format(value); }
function dateLabel(value: Date | string | null | undefined) { return value ? dateFormatter.format(new Date(value)) : "غير محدد"; }
function criterionStatus(delta: number | null) { return delta === null ? { label: "غير مكتمل", tone: "neutral" as const } : delta > 0 ? { label: "تحسن", tone: "success" as const } : delta < 0 ? { label: "يحتاج متابعة", tone: "error" as const } : { label: "ثابت", tone: "warning" as const }; }

export default async function WorkshopReportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireDashboardContext({ permission: Permission.ReportsRead });
  const { id } = await params;
  const report = await db.reportSnapshot.findFirst({ where: { workshopId: id, schoolId: session.membership!.schoolId, workshop: { deletedAt: null } }, include: { school: true, workshop: true } });

  if (!report) return <><PageHeader eyebrow="التقارير" title="لا يوجد تقرير لهذه الورشة" description="يظهر التقرير بعد اعتماد القياس البعدي وإصدار snapshot ثابت." action={<Link className="button button-secondary" href={`/dashboard/workshops/${id}`}><ArrowRight size={15} /> العودة إلى الورشة</Link>} /><section className="panel"><EmptyState icon={<FileText size={20} />} title="التقرير غير متاح بعد" description="أكمل التقييمات البعدية واعتمدها لإنشاء التقرير." /></section></>;

  const payload = normalizeReportPayload(report.snapshot ?? report.metrics);
  if (!payload) notFound();
  const insights = buildReportInsights(payload);
  const workshop = payload.workshop ?? report.workshop;
  const school = payload.school ?? report.school;

  return <>
    <PageHeader eyebrow="تقرير الأثر" title={workshop.title ?? report.workshop.title} description={`${school.name ?? report.school.name} · تقرير ثابت قابل للمراجعة`} action={<div className="page-header-actions"><Link className="button button-secondary" href={`/dashboard/workshops/${id}`}><ArrowRight size={15} /> العودة إلى الورشة</Link><Link className="button button-primary" href="/dashboard/reports"><BarChart3 size={15} /> كل التقارير</Link><ReportExportActions workshopId={id} /></div>} />
    <PrintReportDocument payload={payload} reportId={report.id} />
    <main className="report-page">
      <ReportDecisionSummary report={payload} />
      <section className="report-meta-card"><div><span>المدرسة</span><strong>{school.name ?? report.school.name}</strong></div><div><span>الفترة</span><strong>{dateLabel(workshop.startsAt ?? report.workshop.startsAt)} — {dateLabel(workshop.endsAt ?? report.workshop.endsAt)}</strong></div><div><span>مقدم الورشة</span><strong>{workshop.facilitator ?? report.workshop.facilitator ?? "غير محدد"}</strong></div><div><span>المشاركون</span><strong><Users size={15} />{payload.participantCount.toLocaleString("ar-SA")}</strong></div><div><span>تاريخ الإصدار</span><strong>{dateLabel(report.generatedAt)}</strong></div></section>
      <section className="report-hero-metrics"><Metric label="المتوسط القبلي" value={score(payload.aggregates.weightedPreScore)} detail="من 5" /><Metric label="المتوسط البعدي" value={score(payload.aggregates.weightedPostScore)} detail="من 5" /><Metric label="مقدار التحسن" value={score(payload.aggregates.weightedDelta)} detail="نقاط مقياس" /><Metric label="مؤشر الأثر" value={percentage(payload.aggregates.overallScaleImprovementPercentage)} detail="تحسن على المقياس" /><Metric label="استجابة المتدربين" value={percentage(payload.teacherAggregates.responseRatePercentage)} detail={`${payload.teacherAggregates.responseCount.toLocaleString("ar-SA")} رد`} /></section>
      <ReportCharts criteria={payload.criteria} />
      <section className="report-panel"><div className="report-section-heading"><div><h2>معايير القياس</h2><p>مقارنة مستقلة لكل معيار مع مساهمته حسب الوزن.</p></div></div><div className="report-table-wrap"><table className="report-table"><thead><tr><th>المعيار</th><th>الوزن</th><th>القبلي</th><th>البعدي</th><th>الفرق</th><th>التحسن</th><th>الحالة</th></tr></thead><tbody>{payload.criteria.map((criterion) => { const status = criterionStatus(criterion.delta); return <tr key={criterion.criterionId}><td><strong>{criterion.name}</strong>{criterion.targetValue !== null && <small>الهدف: {score(criterion.targetValue)}</small>}</td><td>{numberFormatter.format(criterion.weight)}٪</td><td>{score(criterion.preAverage)}</td><td>{score(criterion.postAverage)}</td><td className={criterion.delta !== null && criterion.delta < 0 ? "negative" : "positive"}>{score(criterion.delta)}</td><td>{percentage(criterion.scaleImprovementPercentage)}</td><td><StatusBadge tone={status.tone}>{status.label}</StatusBadge></td></tr>; })}</tbody></table></div></section>
      <section className="report-panel teacher-feedback-panel"><div className="report-section-heading"><div><h2>رأي المشاركين</h2><p>هذه المؤشرات منفصلة عن القياس القبلي/البعدي ولا تستبدله.</p></div><CheckCircle2 size={19} color="var(--emerald)" /></div><div className="feedback-metrics"><Metric label="معدل الاستجابة" value={percentage(payload.teacherAggregates.responseRatePercentage)} detail={`${payload.teacherAggregates.responseCount.toLocaleString("ar-SA")} رد`} /><Metric label="متوسط التقييم" value={score(payload.teacherAggregates.evaluationAverage)} detail="من 5" /><Metric label="مؤشر الرضا" value={percentage(payload.teacherAggregates.satisfactionIndex)} detail="من 100" /><Metric label="قابلية التطبيق" value={score(payload.teacherAggregates.applicabilityAverage)} detail="من 5" /><Metric label="جودة المحتوى" value={score(payload.teacherAggregates.contentQualityAverage)} detail="من 5" /></div></section>
      <section className="report-panel insights-panel"><div className="report-section-heading"><div><h2>ملاحظات التقرير</h2><p>استنتاجات وصفية حتمية مبنية على الأرقام المحفوظة فقط، ولا تثبت علاقة سببية.</p></div><Lightbulb size={19} color="var(--warning)" /></div><div className="insights-grid"><Insight label="أعلى معيار تحسنًا" value={insights.highest ?? "لا توجد بيانات كافية"} /><Insight label="أقل معيار تحسنًا" value={insights.lowest ?? "لا توجد بيانات كافية"} /><Insight label="معايير تجاوزت الهدف" value={insights.exceededTargets.length ? insights.exceededTargets.join("، ") : "لا يوجد هدف محفوظ أو لا توجد بيانات كافية"} /><Insight label="معايير تحتاج متابعة" value={insights.followUp.length ? insights.followUp.join("، ") : "لا توجد معايير تحتاج متابعة"} /><Insight label="المشاركون الذين تحسن أداؤهم" value={insights.improvedParticipantPercentage === null ? "لا توجد بيانات كافية" : percentage(insights.improvedParticipantPercentage)} /></div></section>
    </main>
  </>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="report-metric-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function Insight({ label, value }: { label: string; value: string }) { return <div className="insight-item"><span>{label}</span><strong>{value}</strong></div>; }
