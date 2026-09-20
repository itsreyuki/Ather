import { Info, Target } from "lucide-react";
import type { ReactNode } from "react";
import { buildExecutiveSummary, resolveImpactBand, type ReportPayload } from "@/src/lib/reporting";

const formatter = new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 1 });
function percent(value: number | null) { return value === null ? "غير متاح" : `${formatter.format(value)}٪`; }
function score(value: number | null) { return value === null ? "غير متاح" : formatter.format(value); }

const goalLabels = { achieved: "تحققت الأهداف المحددة", partial: "تحقق جزء من الأهداف", "not-met": "لم تتحقق الأهداف المحددة", "not-defined": "لا توجد أهداف محددة" } as const;

export function ReportDecisionSummary({ report }: { report: ReportPayload }) {
  const summary = buildExecutiveSummary(report);
  const band = resolveImpactBand(summary.overallChange);
  return <section className="report-executive-summary" aria-labelledby="executive-summary-title">
    <div className="report-section-heading"><div><span className="section-kicker">قراءة لصانع القرار</span><h2 id="executive-summary-title">الخلاصة التنفيذية</h2><p>ملخص وصفي يساعد على تحديد ما يستحق المتابعة، دون اعتبار النتائج إثباتًا لعلاقة سببية.</p></div><Info size={19} aria-hidden="true" /></div>
    <div className="executive-summary-grid">
      <div className="executive-summary-lead"><span>التغير العام على المقياس</span><strong>{percent(summary.overallChange)}</strong>{band ? <span className={`impact-band impact-band-${band.tone}`}><span className="status-badge-dot" />{band.label}</span> : <small>لا توجد بيانات قبلي/بعدي مكتملة</small>}</div>
      <SummaryItem label="عدد المشاركين" value={summary.participantCount.toLocaleString("ar-SA")} />
      <SummaryItem label="أفضل معيار" value={summary.bestCriterion ? `${summary.bestCriterion.name} (${percent(summary.bestCriterion.change)})` : "لا توجد بيانات كافية"} />
      <SummaryItem label="المعيار الأقل" value={summary.lowestCriterion ? `${summary.lowestCriterion.name} (${percent(summary.lowestCriterion.change)})` : "لا توجد بيانات كافية"} />
      <SummaryItem label="تقييم المشاركين" value={summary.participantEvaluation.average === null ? "لا توجد استجابات" : `${score(summary.participantEvaluation.average)} من 5`} detail={summary.participantEvaluation.responseRate === null ? undefined : `استجابة ${percent(summary.participantEvaluation.responseRate)}`} />
      <SummaryItem label="تحقيق الأهداف المحددة" value={goalLabels[summary.goals.status]} detail={summary.goals.totalCount ? `${summary.goals.achievedCount.toLocaleString("ar-SA")} من ${summary.goals.totalCount.toLocaleString("ar-SA")}` : undefined} icon={<Target size={15} />} />
    </div>
    <details className="methodology-tooltip"><summary><Info size={14} /> كيف حُسبت المؤشرات؟</summary><p>مقدار التغير = المتوسط البعدي ناقص المتوسط القبلي. نسبة التحسن على المقياس = مقدار التغير ÷ 4 × 100، لأن المقياس من 1 إلى 5. المتوسطات موزونة حسب أوزان المعايير، وتقييم المشاركين يعرض منفصلًا عن قياس الأثر.</p></details>
  </section>;
}

function SummaryItem({ label, value, detail, icon }: { label: string; value: string; detail?: string; icon?: ReactNode }) { return <div className="executive-summary-item"><span>{icon}{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>; }
