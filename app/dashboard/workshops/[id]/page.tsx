import { ArrowRight, CalendarClock, CheckCircle2, FileBarChart, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelWorkshopAction } from "@/src/components/workshops/cancel-workshop-action";
import { PostAssessmentWorkspace } from "@/src/components/workshops/post-assessment-workspace";
import { WorkshopCountdown } from "@/src/components/workshops/workshop-countdown";
import { DuplicateWorkshopAction } from "@/src/components/workshops/duplicate-workshop-action";
import { DeleteWorkshopAction } from "@/src/components/workshops/delete-workshop-action";
import { SaveWorkshopTemplateAction } from "@/src/components/workshops/save-workshop-template-action";
import { PageHeader } from "@/src/components/ui/page-header";
import { StatusBadge, type StatusTone } from "@/src/components/ui/status-badge";
import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";
import { getWorkshopCountdown, getWorkshopEffectiveState } from "@/src/lib/workshop";

const dateFormatter = new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" });
const labels: Record<string, string> = {
  DRAFT: "مسودة",
  SCHEDULED: "مجدولة",
  IN_PROGRESS: "قيد التنفيذ",
  POST_ASSESSMENT_AVAILABLE: "بانتظار التقييم البعدي",
  COMPLETED: "مكتملة",
  CANCELLED: "ملغاة",
};
const tones: Record<string, StatusTone> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  IN_PROGRESS: "success",
  POST_ASSESSMENT_AVAILABLE: "warning",
  COMPLETED: "success",
  CANCELLED: "error",
};
function dateLabel(value: Date | null) {
  return value ? dateFormatter.format(value) : "غير محدد";
}
function progress(completed: number, expected: number) {
  return expected ? Math.round((completed / expected) * 100) : 0;
}

export default async function WorkshopDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireDashboardContext({ permission: Permission.WorkshopsRead });
  const { id } = await params;
  const workshop = await db.workshop.findFirst({
    where: { id, schoolId: session.membership!.schoolId, deletedAt: null },
    include: {
      participants: {
        include: {
          staff: {
            select: {
              id: true,
              fullName: true,
              jobTitle: true,
              importSourceName: true,
              importSourceFileName: true,
            },
          },
          assessments: {
            where: { phase: { in: ["PRE", "POST"] } },
            select: { phase: true, criterionId: true, score: true, status: true },
          },
        },
      },
      criteria: { orderBy: { displayOrder: "asc" } },
      evaluations: { select: { staffId: true, rating: true, status: true } },
      report: true,
    },
  });
  if (!workshop) notFound();
  const state = getWorkshopEffectiveState(workshop);
  const countdown = getWorkshopCountdown(workshop);
  const isCompleted = Boolean(workshop.postAssessmentSubmittedAt);
  const expected = workshop.participants.length * workshop.criteria.length;
  const preScores: Record<string, number> = {};
  const postScores: Record<string, number> = {};
  for (const participant of workshop.participants)
    for (const assessment of participant.assessments) {
      const key = `${participant.id}:${assessment.criterionId}`;
      if (assessment.phase === "PRE") preScores[key] = assessment.score;
      else postScores[key] = assessment.score;
    }
  const preCompleted = Object.keys(preScores).length;
  const isPostAvailable = state === "POST_ASSESSMENT_AVAILABLE" || isCompleted;
  const timeline = [
    { label: "تم إنشاء المسودة", date: workshop.createdAt, done: true },
    { label: "تم اعتماد القياس القبلي", date: workshop.finalizedAt, done: Boolean(workshop.finalizedAt) },
    {
      label: "بداية الورشة",
      date: workshop.startsAt,
      done: Boolean(workshop.startsAt && new Date() >= workshop.startsAt && state !== "CANCELLED"),
    },
    {
      label: "نهاية الورشة",
      date: workshop.endsAt,
      done: Boolean(workshop.endsAt && new Date() >= workshop.endsAt && state !== "CANCELLED"),
    },
    {
      label: "التقييم البعدي",
      date: workshop.postAssessmentSubmittedAt ?? workshop.endsAt,
      done: Boolean(workshop.postAssessmentSubmittedAt),
      active: state === "POST_ASSESSMENT_AVAILABLE",
    },
    {
      label: "إصدار تقرير الأثر",
      date: workshop.report?.generatedAt ?? null,
      done: Boolean(workshop.report),
    },
  ];
  const reportMetrics =
    workshop.report?.metrics &&
    typeof workshop.report.metrics === "object" &&
    !Array.isArray(workshop.report.metrics)
      ? (workshop.report.metrics as {
          criteria?: Array<{
            scaleImprovementPercentage?: number | null;
            improvementOnScale?: number | null;
          }>;
          aggregates?: {
            overallScaleImprovementPercentage?: number | null;
            potentialImprovementPercentage?: number | null;
          };
          compositeImpact?: { index?: number | null };
          teacherAggregates?: { responseRatePercentage?: number | null };
        })
      : null;
  const reportImpact = reportMetrics?.criteria
    ?.map((item) => item.scaleImprovementPercentage ?? item.improvementOnScale)
    .filter((value): value is number => value !== null && value !== undefined);
  const averageImpact = reportImpact?.length
    ? reportImpact.reduce((sum, value) => sum + value, 0) / reportImpact.length
    : null;
  const overallImprovement = reportMetrics?.aggregates?.overallScaleImprovementPercentage ?? averageImpact;
  const potentialImprovement = reportMetrics?.aggregates?.potentialImprovementPercentage ?? null;
  const compositeImpact = reportMetrics?.compositeImpact?.index ?? null;
  const teacherResponseRate = reportMetrics?.teacherAggregates?.responseRatePercentage ?? null;

  return (
    <>
      <PageHeader
        eyebrow="الورش والبرامج"
        title={workshop.title}
        description={`${dateLabel(workshop.startsAt)} — ${dateLabel(workshop.endsAt)}`}
        action={
          <div className="page-header-actions">
            <Link className="button button-secondary" href="/dashboard/workshops">
              <ArrowRight size={15} /> العودة للورش
            </Link>
            {workshop.report && (
              <Link className="button button-primary" href={`/dashboard/workshops/${workshop.id}/report`}>
                عرض التقرير
              </Link>
            )}
            {state === "DRAFT" && (
              <Link className="button button-primary" href={`/dashboard/workshops/new?id=${workshop.id}`}>
                استكمال المسودة
              </Link>
            )}
            {state !== "DRAFT" && <DuplicateWorkshopAction workshopId={workshop.id} />}
            {workshop.criteria.length > 0 && <SaveWorkshopTemplateAction workshopId={workshop.id} />}
          </div>
        }
      />
      <section className="workshop-header-panel">
        <div className="workshop-header-main">
          <div>
            <StatusBadge tone={tones[state]}>{labels[state]}</StatusBadge>
            <h2>{workshop.title}</h2>
            <p>{workshop.description ?? "لا يوجد وصف مختصر."}</p>
          </div>
          <div className="workshop-header-stats">
            <div>
              <Users size={17} />
              <strong>{workshop.participants.length.toLocaleString("ar-SA")}</strong>
              <span>مشارك</span>
            </div>
            <div>
              <CalendarClock size={17} />
              <strong>
                {workshop.startsAt && workshop.endsAt
                  ? `${Math.round((workshop.endsAt.getTime() - workshop.startsAt.getTime()) / 60000).toLocaleString("ar-SA")} د`
                  : "—"}
              </strong>
              <span>المدة</span>
            </div>
            <div>
              <strong>
                {isCompleted
                  ? `${Math.round(averageImpact ?? 0).toLocaleString("ar-SA")}٪`
                  : `${progress(preCompleted, expected).toLocaleString("ar-SA")}٪`}
              </strong>
              <span>{isCompleted ? "متوسط الأثر" : "اكتمال القبلي"}</span>
            </div>
          </div>
        </div>
        <WorkshopCountdown
          mode={countdown.state}
          targetAt={countdown.targetAt}
          serverNow={countdown.serverNow}
        />
        <div className="workshop-progress">
          <div>
            <span>تقدم القياس القبلي</span>
            <strong>
              {preCompleted.toLocaleString("ar-SA")} / {expected.toLocaleString("ar-SA")}
            </strong>
          </div>
          <div className="progress-track">
            <span className="progress-value" style={{ width: `${progress(preCompleted, expected)}%` }} />
          </div>
        </div>
      </section>
      <div className="workshop-layout">
        <main>
          <section className="workshop-delete-panel">
            <DeleteWorkshopAction workshopId={workshop.id} compact />
          </section>
          {state === "POST_ASSESSMENT_AVAILABLE" && (
            <section className="post-cta">
              <div>
                <strong>التقييم البعدي أصبح متاحًا</strong>
                <p>انتهت مدة الورشة. أدخل التقييمات البعدية ثم اعتمدها لإصدار تقرير الأثر.</p>
              </div>
              <a className="button button-primary" href="#post-assessment">
                بدء التقييم البعدي
              </a>
            </section>
          )}
          {state === "CANCELLED" && (
            <section className="cancelled-note">
              <strong>تم إلغاء هذه الورشة</strong>
              <p>{workshop.cancellationReason ?? "لم يذكر سبب."}</p>
            </section>
          )}
          {isPostAvailable && (
            <div id="post-assessment">
              <PostAssessmentWorkspace
                workshopId={workshop.id}
                participants={workshop.participants.map((item) => ({
                  participantId: item.id,
                  staffId: item.staff.id,
                  fullName: item.staff.fullName,
                  jobTitle: item.staff.jobTitle,
                  importSourceName: item.staff.importSourceName,
                  importSourceFileName: item.staff.importSourceFileName,
                }))}
                criteria={workshop.criteria.map((item) => ({
                  id: item.id,
                  name: item.name,
                  weight: item.weight,
                }))}
                initialScores={postScores}
                preScores={preScores}
                canEdit={state === "POST_ASSESSMENT_AVAILABLE"}
              />
            </div>
          )}
          <section className="panel workshop-timeline">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">المراحل الزمنية</h2>
                <p className="panel-caption">حالة محسوبة من وقت الخادم والمراحل المحفوظة.</p>
              </div>
              <FileBarChart size={18} color="var(--blue)" />
            </div>
            <ol className="timeline">
              {timeline.map((item) => (
                <li className={`${item.done ? "done" : ""} ${item.active ? "active" : ""}`} key={item.label}>
                  <span className="timeline-marker">{item.done ? <CheckCircle2 size={14} /> : <span />}</span>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{dateLabel(item.date)}</small>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          {workshop.report && (
            <section className="panel report-summary">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">تقرير الأثر</h2>
                  <p className="panel-caption">تقرير ثابت تم إنشاؤه عند اعتماد التقييمات البعدية.</p>
                </div>
                <StatusBadge tone="success">غير قابل للتعديل</StatusBadge>
              </div>
              <div className="report-metrics-grid">
                <div className="report-metric">
                  <strong>
                    {overallImprovement === null
                      ? "—"
                      : `${Math.round(overallImprovement).toLocaleString("ar-SA")}٪`}
                  </strong>
                  <span>التحسن على المقياس</span>
                </div>
                <div className="report-metric">
                  <strong>
                    {potentialImprovement === null
                      ? "—"
                      : `${Math.round(potentialImprovement).toLocaleString("ar-SA")}٪`}
                  </strong>
                  <span>مساحة التحسن الممكنة</span>
                </div>
                <div className="report-metric">
                  <strong>
                    {compositeImpact === null
                      ? "—"
                      : `${Math.round(compositeImpact).toLocaleString("ar-SA")}٪`}
                  </strong>
                  <span>مؤشر الأثر المركب</span>
                </div>
                <div className="report-metric">
                  <strong>
                    {teacherResponseRate === null
                      ? "—"
                      : `${Math.round(teacherResponseRate).toLocaleString("ar-SA")}٪`}
                  </strong>
                  <span>معدل استجابة المشاركين</span>
                </div>
              </div>
            </section>
          )}
        </main>
        <aside className="workshop-sidebar">
          <section className="panel">
            <h2 className="panel-title">تفاصيل الورشة</h2>
            <dl className="detail-list">
              <div>
                <dt>المقدم</dt>
                <dd>{workshop.facilitator ?? "—"}</dd>
              </div>
              <div>
                <dt>الجهة</dt>
                <dd>{workshop.providerOrganization ?? "—"}</dd>
              </div>
              <div>
                <dt>المجال</dt>
                <dd>{workshop.category ?? "—"}</dd>
              </div>
              <div>
                <dt>النمط</dt>
                <dd>
                  {workshop.deliveryMode === "IN_PERSON"
                    ? "حضوري"
                    : workshop.deliveryMode === "REMOTE"
                      ? "عن بعد"
                      : "هجين"}
                </dd>
              </div>
              <div>
                <dt>الموقع</dt>
                <dd>{workshop.locationOrUrl ?? "—"}</dd>
              </div>
            </dl>
          </section>
          {workshop.finalizedAt && !workshop.completedAt && !workshop.cancelledAt && (
            <section className="panel">
              <h2 className="panel-title">إجراءات الورشة</h2>
              <p className="panel-caption">
                لا يمكن تعديل البيانات بعد الاعتماد، ويمكن إلغاء الورشة فقط قبل إكمال القياس.
              </p>
              <CancelWorkshopAction workshopId={workshop.id} />
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
