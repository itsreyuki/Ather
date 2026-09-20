import { Activity, AlertTriangle, BarChart3, BookOpen, CalendarClock, ClipboardCheck, Plus, Users } from "lucide-react";
import Link from "next/link";
import { AttentionList } from "@/src/components/dashboard/attention-list";
import { EmptyState } from "@/src/components/ui/empty-state";
import { PageHeader } from "@/src/components/ui/page-header";
import { StatCard } from "@/src/components/ui/stat-card";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { getDashboardData } from "@/src/lib/dashboard-data";

function number(value: number) { return value.toLocaleString("ar-SA"); }
const dateTimeFormatter = { format(value: Date | null) { return value ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(value) : "—"; } };
const workshopStatusLabels: Record<string, string> = { SCHEDULED: "مجدولة", IN_PROGRESS: "قيد التنفيذ", POST_ASSESSMENT_AVAILABLE: "التقييم البعدي جاهز" };
const workshopStatusTones: Record<string, "info" | "success" | "warning"> = { SCHEDULED: "info", IN_PROGRESS: "success", POST_ASSESSMENT_AVAILABLE: "warning" };

export default async function DashboardPage() {
  const session = await requireDashboardContext();
  const data = await getDashboardData(session.membership!.schoolId);
  const impact = data.stats.averageImpact === null ? "—" : `${Math.round(data.stats.averageImpact).toLocaleString("ar-SA")}٪`;

  return <main className="dashboard-home">
    <PageHeader eyebrow="لوحة المؤشرات" title="نظرة عامة" description="ملخص تشغيلي قابل للتنفيذ لرحلة التدريب في مدرستك." action={<Link className="button button-primary" href="/dashboard/workshops/new"><Plus size={16} /> قياس ورشة جديدة</Link>} />
    <section className="stats-grid stats-grid-five" aria-label="ملخص المؤشرات">
      <StatCard label="المنسوبون النشطون" value={number(data.stats.activeStaff)} detail="في قائمة المدرسة الحالية" icon={<Users size={16} />} />
      <StatCard label="الورش النشطة" value={number(data.stats.activeWorkshops)} detail="مجدولة أو قيد التنفيذ" icon={<BookOpen size={16} />} />
      <StatCard label="تنتظر قياسًا بعديًا" value={number(data.stats.pendingPostAssessments)} detail="تحتاج إجراءً من المدير" icon={<ClipboardCheck size={16} />} />
      <StatCard label="الورش المكتملة" value={number(data.stats.completedWorkshops)} detail="مغلقة وقابلة للتحليل" icon={<Activity size={16} />} />
      <StatCard label="متوسط مؤشر الأثر" value={impact} detail="من الورش المكتملة ذات القياسات" icon={<BarChart3 size={16} />} />
    </section>
    <div className="dashboard-content-grid">
      <section className="panel">
        <div className="panel-header"><div><h2 className="panel-title">يحتاج انتباهك</h2><p className="panel-caption">إجراءات قصيرة تساعدك على إبقاء بيانات المدرسة جاهزة.</p></div><AlertTriangle size={18} color="var(--warning)" /></div>
        <AttentionList initialItems={data.attention} />
      </section>
      <section className="panel">
        <div className="panel-header"><div><h2 className="panel-title">النشاط الأخير</h2><p className="panel-caption">ملخص تدقيقي لأهم تغييرات المدرسة.</p></div><Link className="text-link" href="/dashboard/settings/activity">سجل النشاط</Link></div>
        {data.latestActivities.length === 0 ? <EmptyState title="لا يوجد نشاط بعد" description="ستظهر هنا عمليات إنشاء الورش والاستيراد والقياس." /> : <div className="activity-list">{data.latestActivities.map((activity) => <div className="activity-item" key={activity.id}><span className="activity-dot" /><span><strong>{activity.label}</strong><small>{activity.date}</small></span></div>)}</div>}
      </section>
    </div>
    <section className="panel dashboard-workshops-panel">
      <div className="panel-header"><div><h2 className="panel-title">الورش القادمة والجارية</h2><p className="panel-caption">أقرب المواعيد وما يحتاج متابعة في مساحة عمل واحدة.</p></div><Link className="text-link" href="/dashboard/workshops">عرض كل الورش</Link></div>
      {data.workshops.length === 0 ? <EmptyState icon={<BookOpen size={20} />} title="لا توجد ورش قريبة" description="ستظهر هنا الورش المعتمدة القادمة أو الجارية أو الجاهزة للتقييم البعدي." action={<Link className="button button-secondary" href="/dashboard/workshops/new"><Plus size={15} /> قياس ورشة جديدة</Link>} /> : <div className="dashboard-workshop-list">{data.workshops.map((workshop) => <Link className="dashboard-workshop-row" href={`/dashboard/workshops/${workshop.id}`} key={workshop.id}><span className="dashboard-workshop-icon"><CalendarClock size={17} /></span><span className="dashboard-workshop-main"><strong>{workshop.title}</strong><small>{dateTimeFormatter.format(workshop.startsAt)} · {number(workshop._count.participants)} مشارك</small></span><StatusBadge tone={workshopStatusTones[workshop.status] ?? "info"}>{workshopStatusLabels[workshop.status] ?? workshop.status}</StatusBadge></Link>)}</div>}
    </section>
    <section className="panel drafts-panel">
      <div className="panel-header"><div><h2 className="panel-title">المسودات</h2><p className="panel-caption">تابع آخر خطوة وصلت إليها كل ورشة قبل اعتمادها.</p></div><Link className="text-link" href="/dashboard/workshops?status=DRAFT">عرض كل المسودات</Link></div>
      {data.drafts.length === 0 ? <EmptyState title="لا توجد مسودات" description="ستظهر هنا الورش التي بدأت إعدادها ولم تعتمد بعد." action={<Link className="button button-secondary" href="/dashboard/workshops/new">إنشاء مسودة</Link>} /> : <div className="draft-list">{data.drafts.map((draft) => <Link className="draft-row" href={`/dashboard/workshops/new?id=${draft.id}`} key={draft.id}><span className="draft-row-main"><strong>{draft.title}</strong><small>آخر تعديل: {new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(draft.updatedAt)} · {draft.stageLabel}</small></span><span className="draft-progress"><span className="progress-track"><span className="progress-value" style={{ width: `${draft.completionPercentage}%` }} /></span><strong>{draft.completionPercentage.toLocaleString("ar-SA")}٪</strong></span></Link>)}</div>}
    </section>
  </main>;
}
