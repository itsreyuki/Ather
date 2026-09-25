import { BookOpen, Plus, Route } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/src/components/ui/empty-state";
import { PageHeader } from "@/src/components/ui/page-header";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";

const dateFormatter = new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" });
const labels: Record<string, string> = {
  DRAFT: "مسودة",
  SCHEDULED: "مجدولة",
  IN_PROGRESS: "قيد التنفيذ",
  POST_ASSESSMENT_AVAILABLE: "التقييم البعدي جاهز",
  COMPLETED: "مكتملة",
  CANCELLED: "ملغاة",
};
function dateLabel(value: Date | null) {
  return value ? dateFormatter.format(value) : "غير محدد";
}

export default async function WorkshopsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; page?: string }>;
}) {
  const session = await requireDashboardContext({ permission: Permission.WorkshopsRead });
  const query = await searchParams;
  const status = query?.status;
  const page = Math.max(1, Number.parseInt(query?.page ?? "1", 10) || 1);
  const pageSize = 20;
  const allowedStatuses = [
    "DRAFT",
    "SCHEDULED",
    "IN_PROGRESS",
    "POST_ASSESSMENT_AVAILABLE",
    "COMPLETED",
    "CANCELLED",
  ] as const;
  const selectedStatus = allowedStatuses.includes(status as (typeof allowedStatuses)[number])
    ? (status as (typeof allowedStatuses)[number])
    : undefined;
  const where = {
    schoolId: session.membership!.schoolId,
    deletedAt: null,
    ...(selectedStatus ? { status: selectedStatus } : {}),
  };
  const [total, workshops] = await Promise.all([
    db.workshop.count({ where }),
    db.workshop.findMany({
      where,
      orderBy: { startsAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { participants: true } } },
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <>
      <PageHeader
        eyebrow="مساحة العمل"
        title="الورش والبرامج"
        description="أنشئ الورش، أدر مراحل القياس، وتابع جاهزية التقارير."
        action={
          <div className="page-header-actions">
            <Link className="button button-secondary" href="/dashboard/professional-growth-plans/new">
              <Route size={16} /> خطة نمو مهني
            </Link>
            <Link className="button button-primary" href="/dashboard/workshops/new">
              <Plus size={16} /> ورشة جديدة
            </Link>
          </div>
        }
      />
      <form className="archive-filters" method="get">
        <label htmlFor="workshop-status">الأرشيف</label>
        <select id="workshop-status" name="status" defaultValue={selectedStatus ?? "ALL"}>
          <option value="ALL">كل الورش</option>
          <option value="SCHEDULED">القادمة</option>
          <option value="IN_PROGRESS">الجارية</option>
          <option value="POST_ASSESSMENT_AVAILABLE">بانتظار القياس البعدي</option>
          <option value="COMPLETED">المكتملة</option>
          <option value="CANCELLED">الملغاة</option>
          <option value="DRAFT">المسودات</option>
        </select>
        <button className="button button-secondary" type="submit">
          تطبيق
        </button>
        {selectedStatus && (
          <Link className="text-link" href="/dashboard/workshops">
            إزالة الفلتر
          </Link>
        )}
      </form>
      {selectedStatus && (
        <div className="active-filter-note">
          يتم عرض: <strong>{labels[selectedStatus]}</strong>
        </div>
      )}
      {workshops.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={20} />}
          title="لا توجد ورش مطابقة"
          description="أنشئ أو اعتمد ورشة لتظهر هنا."
          action={
            <Link className="button button-secondary" href="/dashboard/workshops/new">
              <Plus size={15} /> ورشة جديدة
            </Link>
          }
        />
      ) : (
        <>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الورشة</th>
                  <th>الحالة</th>
                  <th>الفترة</th>
                  <th>المشاركون</th>
                  <th>آخر تحديث</th>
                </tr>
              </thead>
              <tbody>
                {workshops.map((workshop) => (
                  <tr key={workshop.id}>
                    <td>
                      <Link className="table-link" href={`/dashboard/workshops/${workshop.id}`}>
                        {workshop.title}
                      </Link>
                      {workshop.description && (
                        <small className="table-subtext">{workshop.description}</small>
                      )}
                    </td>
                    <td>
                      <StatusBadge
                        tone={
                          workshop.status === "COMPLETED"
                            ? "success"
                            : workshop.status === "POST_ASSESSMENT_AVAILABLE"
                              ? "warning"
                              : workshop.status === "CANCELLED"
                                ? "error"
                                : "info"
                        }
                      >
                        {labels[workshop.status] ?? workshop.status}
                      </StatusBadge>
                    </td>
                    <td>
                      {dateLabel(workshop.startsAt)} — {dateLabel(workshop.endsAt)}
                    </td>
                    <td>{workshop._count.participants.toLocaleString("ar-SA")}</td>
                    <td>{dateFormatter.format(workshop.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="pagination" aria-label="صفحات الورش">
            {page > 1 && (
              <Link
                className="button button-secondary"
                href={`/dashboard/workshops?${new URLSearchParams({ ...(selectedStatus ? { status: selectedStatus } : {}), page: String(page - 1) })}`}
              >
                الأحدث
              </Link>
            )}
            <span className="pagination-label">
              صفحة {page.toLocaleString("ar-SA")} من {pageCount.toLocaleString("ar-SA")}
            </span>
            {page < pageCount && (
              <Link
                className="button button-secondary"
                href={`/dashboard/workshops?${new URLSearchParams({ ...(selectedStatus ? { status: selectedStatus } : {}), page: String(page + 1) })}`}
              >
                الأقدم
              </Link>
            )}
          </nav>
        </>
      )}
    </>
  );
}
