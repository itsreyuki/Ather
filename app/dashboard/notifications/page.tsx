import { Bell } from "lucide-react";
import { PageHeader } from "@/src/components/ui/page-header";
import { NotificationCenterActions } from "@/src/components/notifications/notification-center-actions";
import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { getNotificationCenter } from "@/src/lib/notification-service";

const dateFormatter = new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" });

export default async function NotificationsPage() {
  const session = await requireDashboardContext();
  const data = await getNotificationCenter(session.membership!.schoolId, 100);
  return <><PageHeader eyebrow="مركز العمل" title="الإشعارات" description="تنبيهات تشغيلية مبنية على مراحل الورش وبيانات المدرسة." action={<NotificationCenterActions hasUnread={data.unreadCount > 0} />} /><main className="notifications-page"><section className="panel"><div className="panel-header"><div><h2 className="panel-title">آخر التنبيهات</h2><p className="panel-caption">تظهر الإشعارات هنا لجميع مديري المدرسة المصرح لهم.</p></div><Bell size={18} color="var(--emerald)" /></div>{data.items.length === 0 ? <div className="notification-page-empty">لا توجد إشعارات بعد.</div> : <div className="notification-page-list">{data.items.map((item) => <div className={`notification-page-item ${item.readAt ? "read" : "unread"}`} key={item.id}><span className="notification-dot" /><div><div className="notification-page-title"><strong>{item.title}</strong>{!item.readAt && <span>جديد</span>}</div><p>{item.body}</p><small>{dateFormatter.format(item.createdAt)}</small>{item.href && <a className="text-link" href={item.href}>فتح التفاصيل ←</a>}</div></div>)}</div>}</section></main></>;
}
