import { buildExecutiveSummary, buildReportInsights, resolveImpactBand, type ReportPayload } from "@/src/lib/reporting";

const numberFormatter = new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 });
const oneDecimalFormatter = new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" });

function number(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : numberFormatter.format(value);
}

function percentage(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : `${oneDecimalFormatter.format(value)}٪`;
}

function date(value: string | null | undefined) {
  if (!value) return "غير محدد";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "غير محدد" : dateFormatter.format(parsed);
}

function scoreWidth(value: number | null) {
  return `${Math.max(0, Math.min(100, ((value ?? 0) / 5) * 100))}%`;
}

function status(delta: number | null) {
  if (delta === null) return "غير مكتمل";
  if (delta > 0) return "تحسن";
  if (delta < 0) return "يحتاج متابعة";
  return "ثابت";
}

export function PrintReportDocument({ payload, reportId }: { payload: ReportPayload; reportId: string }) {
  const summary = buildExecutiveSummary(payload);
  const insights = buildReportInsights(payload);
  const band = resolveImpactBand(summary.overallChange);
  const workshop = payload.workshop;
  const school = payload.school;

  return <article className="print-report-document" aria-label="نسخة التقرير المخصصة للطباعة">
    <header className="print-document-header">
      <div className="print-document-logo"><strong>أثر</strong><span>ATHAR</span></div>
      <div className="print-document-title"><h1>تقرير أثر الورشة</h1><p>تقرير رسمي ثابت مبني على بيانات القياس المحفوظة عند الاعتماد</p></div>
      <div className="print-document-id"><span>رقم التقرير</span><strong>{reportId}</strong><small>{date(payload.generatedAt)}</small></div>
    </header>

    <section className="print-document-section print-document-meta">
      <div><span>المدرسة</span><strong>{school?.name ?? "غير محدد"}</strong></div>
      <div><span>الورشة</span><strong>{workshop?.title ?? "غير محدد"}</strong></div>
      <div><span>الفترة</span><strong>{date(workshop?.startsAt)} — {date(workshop?.endsAt)}</strong></div>
      <div><span>مقدم الورشة</span><strong>{workshop?.facilitator ?? "غير محدد"}</strong></div>
      <div><span>المجال</span><strong>{workshop?.category ?? "غير مصنف"}</strong></div>
      <div><span>عدد المشاركين</span><strong>{number(payload.participantCount)}</strong></div>
    </section>

    <section className="print-document-section print-document-summary">
      <div className="print-document-section-heading"><span>الخلاصة التنفيذية</span><small>قراءة وصفية لصانع القرار</small></div>
      <div className="print-document-summary-grid">
        <div className="print-document-summary-lead"><span>التغير العام على المقياس</span><strong>{percentage(summary.overallChange)}</strong>{band && <em>{band.label}</em>}</div>
        <PrintSummaryItem label="أفضل معيار" value={summary.bestCriterion ? `${summary.bestCriterion.name} (${percentage(summary.bestCriterion.change)})` : "لا توجد بيانات كافية"} />
        <PrintSummaryItem label="المعيار الأقل" value={summary.lowestCriterion ? `${summary.lowestCriterion.name} (${percentage(summary.lowestCriterion.change)})` : "لا توجد بيانات كافية"} />
        <PrintSummaryItem label="تقييم المشاركين" value={summary.participantEvaluation.average === null ? "لا توجد استجابات" : `${number(summary.participantEvaluation.average)} من 5`} />
        <PrintSummaryItem label="تحقيق الأهداف" value={summary.goals.status === "achieved" ? "تحققت الأهداف المحددة" : summary.goals.status === "partial" ? "تحقق جزء من الأهداف" : summary.goals.status === "not-met" ? "لم تتحقق الأهداف المحددة" : "لا توجد أهداف محددة"} />
      </div>
    </section>

    <section className="print-document-section">
      <div className="print-document-section-heading"><span>المؤشرات الرئيسية</span><small>المتوسطات موزونة حسب أوزان المعايير</small></div>
      <div className="print-document-metrics">
        <PrintMetric label="المتوسط القبلي" value={number(payload.aggregates.weightedPreScore)} detail="من 5" />
        <PrintMetric label="المتوسط البعدي" value={number(payload.aggregates.weightedPostScore)} detail="من 5" />
        <PrintMetric label="مقدار التحسن" value={number(payload.aggregates.weightedDelta)} detail="نقاط" />
        <PrintMetric label="مؤشر الأثر" value={percentage(payload.aggregates.overallScaleImprovementPercentage)} detail="تحسن على المقياس" />
        <PrintMetric label="استجابة المتدربين" value={percentage(payload.teacherAggregates.responseRatePercentage)} detail={`${number(payload.teacherAggregates.responseCount)} رد`} />
      </div>
    </section>

    <section className="print-document-section print-document-chart-section">
      <div className="print-document-section-heading"><span>مقارنة القبلي والبعدي حسب المعيار</span><small><i className="print-dot print-dot-pre" /> القبلي <i className="print-dot print-dot-post" /> البعدي</small></div>
      <div className="print-document-chart">
        {payload.criteria.map((criterion) => <div className="print-document-chart-row" key={criterion.criterionId}>
          <strong>{criterion.name}</strong>
          <div className="print-document-bars"><div className="print-document-bar-line"><span className="print-document-bar-track"><i className="print-document-bar-pre" style={{ width: scoreWidth(criterion.preAverage) }} /></span><b>{number(criterion.preAverage)}</b></div><div className="print-document-bar-line"><span className="print-document-bar-track"><i className="print-document-bar-post" style={{ width: scoreWidth(criterion.postAverage) }} /></span><b>{number(criterion.postAverage)}</b></div></div>
        </div>)}
      </div>
    </section>

    <section className="print-document-section print-document-table-section">
      <div className="print-document-section-heading"><span>نتائج المعايير</span><small>الفرق = البعدي ناقص القبلي</small></div>
      <table className="print-document-table"><thead><tr><th>المعيار</th><th>الوزن</th><th>القبلي</th><th>البعدي</th><th>الفرق</th><th>التحسن</th><th>الحالة</th></tr></thead><tbody>{payload.criteria.map((criterion) => <tr key={criterion.criterionId}><td><strong>{criterion.name}</strong>{criterion.targetValue !== null && <small>الهدف: {number(criterion.targetValue)}</small>}</td><td>{percentage(criterion.weight)}</td><td>{number(criterion.preAverage)}</td><td>{number(criterion.postAverage)}</td><td>{number(criterion.delta)}</td><td>{percentage(criterion.scaleImprovementPercentage)}</td><td>{status(criterion.delta)}</td></tr>)}</tbody></table>
    </section>

    <section className="print-document-section print-document-feedback">
      <div className="print-document-section-heading"><span>رأي المشاركين</span><small>مؤشرات مستقلة عن القياس القبلي والبعدي</small></div>
      <div className="print-document-metrics print-document-feedback-grid">
        <PrintMetric label="معدل الاستجابة" value={percentage(payload.teacherAggregates.responseRatePercentage)} detail={`${number(payload.teacherAggregates.responseCount)} رد`} />
        <PrintMetric label="متوسط التقييم" value={number(payload.teacherAggregates.evaluationAverage)} detail="من 5" />
        <PrintMetric label="مؤشر الرضا" value={percentage(payload.teacherAggregates.satisfactionIndex)} detail="من 100" />
        <PrintMetric label="قابلية التطبيق" value={number(payload.teacherAggregates.applicabilityAverage)} detail="من 5" />
        <PrintMetric label="جودة المحتوى" value={number(payload.teacherAggregates.contentQualityAverage)} detail="من 5" />
        <PrintMetric label="جودة التقديم" value={number(payload.teacherAggregates.deliveryQualityAverage)} detail="من 5" />
      </div>
    </section>

    <section className="print-document-section print-document-insights"><div className="print-document-section-heading"><span>ملاحظات التقرير</span><small>استنتاجات وصفية مبنية على الأرقام المحفوظة</small></div><div className="print-document-insight-grid"><PrintSummaryItem label="أعلى معيار تحسنًا" value={insights.highest ?? "لا توجد بيانات كافية"} /><PrintSummaryItem label="أقل معيار تحسنًا" value={insights.lowest ?? "لا توجد بيانات كافية"} /><PrintSummaryItem label="المشاركون الذين تحسن أداؤهم" value={insights.improvedParticipantPercentage === null ? "لا توجد بيانات كافية" : percentage(insights.improvedParticipantPercentage)} /></div></section>

    <footer className="print-document-footer">ملاحظة منهجية: المؤشرات ناتجة عن مقارنة القياس القبلي والبعدي وتقييمات المشاركين المحفوظة عند اعتماد الورشة، ولا تمثل إثباتًا لعلاقة سببية. · {reportId}</footer>
  </article>;
}

function PrintMetric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="print-document-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function PrintSummaryItem({ label, value }: { label: string; value: string }) { return <div className="print-document-summary-item"><span>{label}</span><strong>{value}</strong></div>; }
