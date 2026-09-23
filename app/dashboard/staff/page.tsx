import { FileSpreadsheet, Search, Users } from "lucide-react";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { PageHeader } from "@/src/components/ui/page-header";
import { EmptyState } from "@/src/components/ui/empty-state";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";

const pageSize = 20;
const dateFormatter = new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" });
type Query = Record<string, string | string[] | undefined>;
function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
function pageHref(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/dashboard/staff?${next.toString()}`;
}
function reviewFlagCount(value: Prisma.JsonValue) {
  return Array.isArray(value) ? value.length : 0;
}

export default async function StaffPage({ searchParams }: { searchParams?: Promise<Query> }) {
  const session = await requireDashboardContext({ permission: Permission.StaffRead });
  const query = searchParams ? await searchParams : {};
  const search = (first(query.q) ?? "").trim().slice(0, 100);
  const state =
    first(query.state) === "inactive" ? "inactive" : first(query.state) === "active" ? "active" : "all";
  const phone = first(query.phone) === "missing" ? "missing" : "all";
  const review = first(query.review) === "needed" ? "needed" : "all";
  const sort = first(query.sort) ?? "updated";
  const currentPage = Math.max(1, Number.parseInt(first(query.page) ?? "1", 10) || 1);
  const where: Prisma.StaffMemberWhereInput = {
    schoolId: session.membership!.schoolId,
    ...(state === "active" ? { active: true } : state === "inactive" ? { active: false } : {}),
    ...(phone === "missing" ? { phoneEncrypted: null } : {}),
    ...(review === "needed" ? { importReviewRequired: true } : {}),
    ...(search
      ? {
          OR: [
            { fullName: { contains: search } },
            { jobTitle: { contains: search } },
            { specialization: { contains: search } },
            { nationalIdLast4: { contains: search } },
            { phoneLast4: { contains: search } },
          ],
        }
      : {}),
  };
  const orderBy: Prisma.StaffMemberOrderByWithRelationInput =
    sort === "name"
      ? { fullName: "asc" }
      : sort === "workshops"
        ? { participants: { _count: "desc" } }
        : { updatedAt: "desc" };
  const include = {
    _count: { select: { participants: true } },
    participants: { orderBy: { joinedAt: "desc" as const }, take: 1, select: { joinedAt: true } },
  };
  const total = await db.staffMember.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const skip = (safePage - 1) * pageSize;
  const staff =
    sort === "lastParticipation"
      ? await (async () => {
          const pattern = `%${search}%`;
          const ids = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT staff."id"
          FROM "StaffMember" AS staff
          LEFT JOIN "WorkshopParticipant" AS participant ON participant."staffId" = staff."id"
          WHERE staff."schoolId" = ${session.membership!.schoolId}
          ${state === "active" ? Prisma.sql`AND staff."active" = TRUE` : state === "inactive" ? Prisma.sql`AND staff."active" = FALSE` : Prisma.sql``}
          ${phone === "missing" ? Prisma.sql`AND staff."phoneEncrypted" IS NULL` : Prisma.sql``}
          ${review === "needed" ? Prisma.sql`AND staff."importReviewRequired" = TRUE` : Prisma.sql``}
          ${search ? Prisma.sql`AND (staff."fullName" LIKE ${pattern} OR staff."jobTitle" LIKE ${pattern} OR staff."specialization" LIKE ${pattern} OR staff."nationalIdLast4" LIKE ${pattern} OR staff."phoneLast4" LIKE ${pattern})` : Prisma.sql``}
          GROUP BY staff."id"
          ORDER BY MAX(participant."joinedAt") DESC NULLS LAST, staff."updatedAt" DESC
          OFFSET ${skip} LIMIT ${pageSize}
        `);
          if (!ids.length) return db.staffMember.findMany({ where: { id: { in: [] } }, include });
          const records = await db.staffMember.findMany({
            where: { schoolId: session.membership!.schoolId, id: { in: ids.map((item) => item.id) } },
            include,
          });
          const byId = new Map(records.map((item) => [item.id, item]));
          return ids.flatMap((item) => {
            const record = byId.get(item.id);
            return record ? [record] : [];
          });
        })()
      : await db.staffMember.findMany({
          where,
          orderBy,
          skip,
          take: pageSize,
          include,
        });
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (state !== "all") params.set("state", state);
  if (phone !== "all") params.set("phone", phone);
  if (review !== "all") params.set("review", review);
  if (sort !== "updated") params.set("sort", sort);

  return (
    <>
      <PageHeader
        eyebrow="إدارة البيانات"
        title="دليل المنسوبين"
        description="سجل موحد للمنسوبين مع حالة الوصول وسجل المشاركة."
        action={
          <div className="page-header-actions">
            <Link className="button button-secondary" href="/dashboard/staff/import">
              <FileSpreadsheet size={16} /> تحديث البيانات من نور
            </Link>
          </div>
        }
      />
      <form className="directory-toolbar" method="get">
        <label className="search-field directory-search">
          <Search size={16} />
          <span className="sr-only">البحث</span>
          <input name="q" defaultValue={search} placeholder="ابحث بالاسم أو آخر 4 أرقام" />
        </label>
        <select name="state" defaultValue={state} aria-label="حالة الموظف">
          <option value="all">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
        </select>
        <select name="phone" defaultValue={phone} aria-label="حالة الجوال">
          <option value="all">كل الجوالات</option>
          <option value="missing">بدون جوال</option>
        </select>
        <select name="review" defaultValue={review} aria-label="حالة المطابقة">
          <option value="all">كل المطابقة</option>
          <option value="needed">تحتاج مطابقة</option>
        </select>
        <select name="sort" defaultValue={sort} aria-label="ترتيب النتائج">
          <option value="updated">آخر تحديث</option>
          <option value="name">الاسم</option>
          <option value="workshops">عدد الورش</option>
          <option value="lastParticipation">آخر مشاركة</option>
        </select>
        <button className="button button-secondary" type="submit">
          تطبيق
        </button>
      </form>
      <div className="directory-meta">
        <span>{total.toLocaleString("ar-SA")} سجلًا</span>
        <span>
          الصفحة {safePage.toLocaleString("ar-SA")} من {totalPages.toLocaleString("ar-SA")}
        </span>
      </div>
      {staff.length === 0 ? (
        <EmptyState
          icon={<Users size={20} />}
          title="لا توجد نتائج"
          description="جرّب تغيير البحث أو الفلاتر، أو استورد قائمة نور جديدة."
          action={
            <Link className="button button-secondary" href="/dashboard/staff/import">
              <FileSpreadsheet size={15} /> تحديث البيانات من نور
            </Link>
          }
        />
      ) : (
        <div className="table-scroll directory-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>المسمى</th>
                <th>التخصص</th>
                <th>مصدر الاستيراد</th>
                <th>حالة الجوال</th>
                <th>الحالة</th>
                <th>عدد الورش</th>
                <th>آخر مشاركة</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id}>
                  <td data-label="الاسم">
                    <Link className="table-link" href={`/dashboard/staff/${member.id}`}>
                      {member.fullName}
                    </Link>
                    <small className="table-subtext">
                      اسم مستخدم ينتهي بـ {member.nationalIdLast4 ?? "—"}
                    </small>
                  </td>
                  <td data-label="المسمى">{member.jobTitle ?? "—"}</td>
                  <td className="specialization-cell" data-label="التخصص">
                    {member.specialization ?? "—"}
                  </td>
                  <td data-label="مصدر الاستيراد">
                    <span className="table-source-label">
                      {member.importSourceName ?? member.importSourceFileName ?? "استيراد نور"}
                    </span>
                    {reviewFlagCount(member.importReviewFlags) > 0 && (
                      <StatusBadge tone="warning">
                        {reviewFlagCount(member.importReviewFlags).toLocaleString("ar-SA")} للمراجعة
                      </StatusBadge>
                    )}
                  </td>
                  <td data-label="حالة الجوال">
                    {member.phoneEncrypted ? (
                      <StatusBadge tone="success">•••• {member.phoneLast4}</StatusBadge>
                    ) : (
                      <StatusBadge tone="warning">غير متوفر</StatusBadge>
                    )}
                  </td>
                  <td data-label="الحالة">
                    <StatusBadge tone={member.active ? "success" : "neutral"}>
                      {member.active ? "نشط" : "غير نشط"}
                    </StatusBadge>
                  </td>
                  <td data-label="عدد الورش">{member._count.participants.toLocaleString("ar-SA")}</td>
                  <td data-label="آخر مشاركة">
                    {member.participants[0] ? dateFormatter.format(member.participants[0].joinedAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {staff.length > 0 && (
        <nav className="pagination" aria-label="صفحات دليل المنسوبين">
          <span>
            {safePage > 1 ? (
              <Link className="button button-secondary" href={pageHref(params, safePage - 1)}>
                السابق
              </Link>
            ) : (
              <span className="button button-secondary disabled">السابق</span>
            )}
          </span>
          <span className="pagination-label">
            {safePage.toLocaleString("ar-SA")} / {totalPages.toLocaleString("ar-SA")}
          </span>
          <span>
            {safePage < totalPages ? (
              <Link className="button button-secondary" href={pageHref(params, safePage + 1)}>
                التالي
              </Link>
            ) : (
              <span className="button button-secondary disabled">التالي</span>
            )}
          </span>
        </nav>
      )}
    </>
  );
}
