import { ArrowRight, CalendarDays, Clock3, GraduationCap, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TeacherEvaluationForm } from "@/src/components/teacher/teacher-evaluation-form";
import { db } from "@/src/lib/db";
import { getTeacherSessionContext } from "@/src/lib/teacher-session";
import { getWorkshopEffectiveState } from "@/src/lib/workshop";

const dateFormatter = new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" });

export default async function TeacherWorkshopEvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getTeacherSessionContext();
  if (!session) return notFound();
  const { id } = await params;
  const workshop = await db.workshop.findFirst({ where: { id, schoolId: session.schoolId, deletedAt: null, participants: { some: { staffId: session.staffId } } }, select: { id: true, title: true, facilitator: true, objectives: true, startsAt: true, endsAt: true, finalizedAt: true, cancelledAt: true, postAssessmentSubmittedAt: true, criteria: { orderBy: { displayOrder: "asc" }, select: { id: true, name: true, description: true, participantPrompt: true, weight: true } } } });
  if (!workshop) return notFound();
  const evaluation = await db.teacherWorkshopEvaluation.findUnique({ where: { workshopId_staffId: { workshopId: id, staffId: session.staffId } }, include: { criterionResponses: { select: { criterionId: true, rating: true } } } });
  const state = getWorkshopEffectiveState(workshop);
  const submitted = evaluation?.status === "SUBMITTED" || Boolean(evaluation?.submittedAt);
  const editable = state === "IN_PROGRESS" && !submitted;
  return <main className="teacher-evaluation-page"><header className="teacher-evaluation-header"><Link className="button button-ghost" href="/teacher"><ArrowRight size={15} /> العودة إلى ورشي</Link><div className="teacher-home-brand"><span>أثر</span><small>ATHAR</small></div></header><section className="teacher-evaluation-hero"><div><span className="eyebrow">تقييم مشارك</span><h1>{workshop.title}</h1><p>{workshop.facilitator ? `المقدم: ${workshop.facilitator}` : "ورشة تدريبية"}</p></div><div className="teacher-evaluation-facts"><span><CalendarDays size={15} />{workshop.startsAt ? dateFormatter.format(workshop.startsAt) : "موعد غير محدد"}</span><span><Clock3 size={15} />{workshop.endsAt ? `حتى ${dateFormatter.format(workshop.endsAt)}` : "—"}</span></div></section>{workshop.objectives && <section className="teacher-evaluation-objective"><GraduationCap size={18} /><div><strong>هدف الورشة</strong><p>{workshop.objectives}</p></div></section>}{submitted ? <section className="teacher-evaluation-success"><div className="teacher-success-mark">✓</div><h2>تم إرسال تقييمك</h2><p>شكرًا لمشاركتك. تم حفظ تقييمك ضمن مؤشرات الورشة وتحليلاتها.</p><Link className="button button-secondary" href="/teacher">العودة إلى ورشي</Link></section> : editable ? <TeacherEvaluationForm workshopId={workshop.id} criteria={workshop.criteria} initialResponses={Object.fromEntries(evaluation?.criterionResponses.map((response) => [response.criterionId, response.rating]) ?? [])} initialGeneral={{ contentQuality: evaluation?.contentQuality ?? null, needFit: evaluation?.needFit ?? null, deliveryQuality: evaluation?.deliveryQuality ?? null, applicability: evaluation?.applicability ?? null, overallSatisfaction: evaluation?.rating ?? null, comment: evaluation?.comment ?? "" }} /> : <section className="teacher-evaluation-closed"><LockKeyhole size={22} /><h2>{state === "SCHEDULED" ? "التقييم غير متاح بعد" : "انتهت فترة التقييم"}</h2><p>{state === "SCHEDULED" ? "سيصبح التقييم متاحًا خلال فترة تنفيذ الورشة." : "لا يمكن إرسال تقييم بعد نهاية فترة تنفيذ الورشة."}</p><Link className="button button-secondary" href="/teacher">العودة إلى ورشي</Link></section>}</main>;
}
