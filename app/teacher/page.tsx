import { CalendarDays, CheckCircle2, Clock3, GraduationCap, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { TeacherLogin, TeacherLogoutButton } from "@/src/components/teacher/teacher-portal";
import { db } from "@/src/lib/db";
import { getWorkshopEffectiveState } from "@/src/lib/workshop";
import { getTeacherSessionContext } from "@/src/lib/teacher-session";

const dateFormatter = new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" });
const labels: Record<string, string> = { SCHEDULED: "مجدولة", IN_PROGRESS: "جارية الآن", POST_ASSESSMENT_AVAILABLE: "بانتظار تقييمك", COMPLETED: "مكتملة", CANCELLED: "ملغاة" };

function WorkshopCard({ item, state }: { item: { id: string; title: string; startsAt: Date | null; endsAt: Date | null; facilitator: string | null }; state: string }) {
  return <article className="teacher-workshop-card"><div className="teacher-card-icon"><GraduationCap size={18} /></div><div className="teacher-workshop-card-body"><div className="teacher-card-top"><span className={`teacher-status teacher-status-${state.toLowerCase()}`}>{labels[state] ?? state}</span><small>{item.startsAt ? dateFormatter.format(item.startsAt) : "موعد غير محدد"}</small></div><h3>{item.title}</h3>{item.facilitator && <p>المقدم: {item.facilitator}</p>}{item.endsAt && <small className="teacher-card-end">حتى {dateFormatter.format(item.endsAt)}</small>}</div></article>;
}

function Section({ icon, title, items, empty }: { icon: React.ReactNode; title: string; items: Array<{ item: { id: string; title: string; startsAt: Date | null; endsAt: Date | null; facilitator: string | null }; state: string }>; empty: string }) {
  return <section className="teacher-home-section"><div className="teacher-section-heading"><h2>{icon}{title}</h2><span>{items.length.toLocaleString("ar-SA")}</span></div>{items.length ? <div className="teacher-workshop-grid">{items.map(({ item, state }) => <div key={item.id}><WorkshopCard item={item} state={state} />{state === "IN_PROGRESS" && <Link className="teacher-evaluate-link" href={`/teacher/workshops/${item.id}/evaluate`}>فتح التقييم</Link>}</div>)}</div> : <div className="teacher-empty"><ShieldCheck size={17} /><span>{empty}</span></div>}</section>;
}

async function TeacherHome({ session }: { session: NonNullable<Awaited<ReturnType<typeof getTeacherSessionContext>>> }) {
  const participation = await db.workshopParticipant.findMany({ where: { staffId: session.staffId, workshop: { schoolId: session.schoolId, deletedAt: null } }, select: { workshop: { select: { id: true, title: true, startsAt: true, endsAt: true, facilitator: true, finalizedAt: true, cancelledAt: true, postAssessmentSubmittedAt: true } } }, orderBy: { workshop: { startsAt: "asc" } } });
  const workshopIds = participation.map((item) => item.workshop.id);
  const submitted = await db.teacherWorkshopEvaluation.findMany({ where: { staffId: session.staffId, workshopId: { in: workshopIds }, status: "SUBMITTED" }, select: { workshopId: true } });
  const submittedIds = new Set(submitted.map((item) => item.workshopId));
  const grouped = participation.map(({ workshop }) => ({ item: workshop, state: getWorkshopEffectiveState(workshop) })).filter(({ state }) => state !== "CANCELLED");
  const upcoming = grouped.filter(({ state }) => state === "SCHEDULED");
  const ongoing = grouped.filter(({ state }) => state === "IN_PROGRESS");
  const pending = grouped.filter(({ state, item }) => state === "IN_PROGRESS" && !submittedIds.has(item.id));
  const completed = grouped.filter(({ state }) => state === "COMPLETED");
  return <main className="teacher-home"><header className="teacher-home-header"><div className="teacher-home-brand"><span>أثر</span><small>ATHAR</small></div><div className="teacher-home-user"><div><strong>{session.staff.fullName}</strong><small>{session.school.name}</small></div><TeacherLogoutButton /></div></header><section className="teacher-welcome"><div><span className="eyebrow">بوابة المنسوبين</span><h1>مرحبًا، {session.staff.fullName}</h1><p>تابع الورش المرتبطة بسجلك وشارك في قياس أثر التدريب.</p></div><div className="teacher-welcome-mark"><CalendarDays size={26} /></div></section><div className="teacher-home-grid"><Section icon={<Clock3 size={17} />} title="الورش القادمة" items={upcoming} empty="لا توجد ورش قادمة مرتبطة بسجلك." /><Section icon={<Clock3 size={17} />} title="الورش الجارية" items={ongoing} empty="لا توجد ورش جارية حاليًا." /><Section icon={<CheckCircle2 size={17} />} title="ورش بانتظار تقييمك" items={pending} empty="لا توجد تقييمات مطلوبة منك حاليًا." /><Section icon={<CheckCircle2 size={17} />} title="الورش المكتملة" items={completed} empty="ستظهر هنا الورش التي شاركت بها بعد اكتمالها." /></div></main>;
}

export default async function TeacherPage() {
  const session = await getTeacherSessionContext();
  return session ? <TeacherHome session={session} /> : <TeacherLogin />;
}
