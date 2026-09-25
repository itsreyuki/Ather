import { AlertCircle, ArrowRight, BookOpen, Mail, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/src/components/ui/page-header";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { StaffEditor } from "@/src/components/staff/staff-editor";
import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";
import { staffOverrideFields } from "@/src/lib/staff-overrides";

const dateFormatter = new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" });
const sourceLabel: Record<string, string> = { NOOR_IMPORT: "استيراد من نظام نور", MANUAL: "إضافة يدوية" };
const importFormatLabels: Record<string, string> = {
  NOOR_TEACHER_ROSTER: "قائمة المعلمين",
  NOOR_STAFF_ROSTER: "قائمة المنسوبين",
  NOOR_ADMINISTRATIVE_ROSTER: "قائمة المنسوبين",
};
function reviewFlags(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is { message?: string } => Boolean(item && typeof item === "object"))
    : [];
}

export default async function StaffDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireDashboardContext({ permission: Permission.StaffRead });
  const { id } = await params;
  const staff = await db.staffMember.findFirst({
    where: { id, schoolId: session.membership!.schoolId },
    include: {
      participants: {
        orderBy: { joinedAt: "desc" },
        include: {
          workshop: { select: { id: true, title: true, startsAt: true, status: true } },
          assessments: { select: { phase: true, score: true } },
        },
      },
    },
  });
  if (!staff) notFound();
  const workshopRows = staff.participants.map((participant) => {
    const pre = participant.assessments.filter((item) => item.phase === "PRE").map((item) => item.score);
    const post = participant.assessments.filter((item) => item.phase === "POST").map((item) => item.score);
    const preAverage = pre.length ? pre.reduce((sum, value) => sum + value, 0) / pre.length : null;
    const postAverage = post.length ? post.reduce((sum, value) => sum + value, 0) / post.length : null;
    return {
      ...participant,
      preAverage,
      postAverage,
      impact: preAverage !== null && postAverage !== null ? ((postAverage - preAverage) / 4) * 100 : null,
      teacherRating: null,
    };
  });
  const measured = workshopRows.filter((row) => row.impact !== null);
  const avgPre = measured.length
    ? measured.reduce((sum, row) => sum + row.preAverage!, 0) / measured.length
    : null;
  const avgPost = measured.length
    ? measured.reduce((sum, row) => sum + row.postAverage!, 0) / measured.length
    : null;
  const avgImpact = measured.length
    ? measured.reduce((sum, row) => sum + row.impact!, 0) / measured.length
    : null;

  const flags = reviewFlags(staff.importReviewFlags);
  return (
    <>
      <PageHeader
        eyebrow="دليل المنسوبين"
        title={staff.fullName}
        description={`آخر تحديث: ${dateFormatter.format(staff.updatedAt)}`}
        action={
          <Link className="button button-secondary" href="/dashboard/staff">
            <ArrowRight size={15} /> العودة للدليل
          </Link>
        }
      />
      <div className="staff-detail-grid">
        <section className="panel">
          <div className="profile-heading">
            <span className="profile-avatar">
              <UserRound size={20} />
            </span>
            <div>
              <h2>{staff.fullName}</h2>
              <p>{staff.jobTitle ?? "لم يحدد المسمى الوظيفي"}</p>
            </div>
            <StatusBadge tone={staff.active ? "success" : "neutral"}>
              {staff.active ? "نشط" : "غير نشط"}
            </StatusBadge>
          </div>
          <div className="profile-facts">
            <div>
              <span>التخصص</span>
              <strong>{staff.specialization ?? "—"}</strong>
            </div>
            <div>
              <span>اسم المستخدم في نور</span>
              <strong>•••• {staff.nationalIdLast4 ?? "—"}</strong>
            </div>
            <div>
              <span>الهاتف</span>
              <strong>{staff.phoneLast4 ? `•••• ${staff.phoneLast4}` : "غير متوفر"}</strong>
            </div>
            <div>
              <span>البريد</span>
              <strong>{staff.email ?? "—"}</strong>
            </div>
            <div>
              <span>المصدر</span>
              <strong>
                {staff.importSourceName ??
                  staff.importSourceFileName ??
                  sourceLabel[staff.source] ??
                  staff.source}
              </strong>
              <small className="table-subtext">
                {importFormatLabels[staff.importFormat ?? ""] ?? "استيراد من نظام نور"}
              </small>
            </div>
            {staff.educationAdministration && (
              <div>
                <span>إدارة التعليم</span>
                <strong>{staff.educationAdministration}</strong>
              </div>
            )}
            {staff.sourceSchoolName && (
              <div>
                <span>المدرسة في المصدر</span>
                <strong>{staff.sourceSchoolName}</strong>
              </div>
            )}
            <div>
              <span>تاريخ الإضافة</span>
              <strong>{dateFormatter.format(staff.createdAt)}</strong>
            </div>
          </div>
          {flags.length > 0 && (
            <div className="staff-review-alert">
              <AlertCircle size={17} />
              <div>
                <strong>تحتاج مطابقة يدوية</strong>
                <ul>
                  {flags.map((flag, index) => (
                    <li key={index}>{flag.message ?? "يوجد تشابه مع سجل آخر في ملف الاستيراد."}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">تصحيح البيانات</h2>
              <p className="panel-caption">التعديلات تسجل تلقائيًا في AuditLog.</p>
            </div>
            <ShieldCheck size={18} color="var(--emerald)" />
          </div>
          <StaffEditor
            staffId={staff.id}
            initial={{
              email: staff.email,
              jobTitle: staff.jobTitle,
              specialization: staff.specialization,
              manualOverrideFields: staffOverrideFields(staff.manualOverrideFields),
              phoneLast4: staff.phoneLast4,
            }}
          />
        </section>
      </div>
      <section className="panel staff-development">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">ملخص التطور عبر الورش</h2>
            <p className="panel-caption">يظهر عند توفر قياس قبلي وبعدي للمنسوب.</p>
          </div>
          <BookOpen size={18} color="var(--blue)" />
        </div>
        {measured.length === 0 ? (
          <div className="detail-empty">
            <Mail size={18} />
            <span>لا توجد بيانات كافية لاحتساب التطور بعد.</span>
          </div>
        ) : (
          <div className="development-summary">
            <div>
              <strong>{avgPre!.toFixed(2)}</strong>
              <span>المتوسط القبلي</span>
            </div>
            <div>
              <strong>{avgPost!.toFixed(2)}</strong>
              <span>المتوسط البعدي</span>
            </div>
            <div>
              <strong>{Math.round(avgImpact!).toLocaleString("ar-SA")}٪</strong>
              <span>مؤشر التحسن</span>
            </div>
          </div>
        )}
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">الورش التي شارك بها</h2>
            <p className="panel-caption">
              {staff.participants.length.toLocaleString("ar-SA")} مشاركة محفوظة دون حذف التاريخ.
            </p>
          </div>
        </div>
        {workshopRows.length === 0 ? (
          <div className="detail-empty">
            <BookOpen size={18} />
            <span>لم يشارك في ورش بعد.</span>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الورشة</th>
                  <th>تاريخ المشاركة</th>
                  <th>القياس القبلي</th>
                  <th>القياس البعدي</th>
                  <th>التطور</th>
                  <th>تقييم المعلم</th>
                </tr>
              </thead>
              <tbody>
                {workshopRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link className="table-link" href={`/dashboard/workshops/${row.workshop.id}`}>
                        {row.workshop.title}
                      </Link>
                    </td>
                    <td>{dateFormatter.format(row.joinedAt)}</td>
                    <td>{row.preAverage?.toFixed(2) ?? "—"}</td>
                    <td>{row.postAverage?.toFixed(2) ?? "—"}</td>
                    <td>
                      {row.impact === null ? (
                        "—"
                      ) : (
                        <StatusBadge tone={row.impact >= 0 ? "success" : "error"}>
                          {Math.round(row.impact).toLocaleString("ar-SA")}٪
                        </StatusBadge>
                      )}
                    </td>
                    <td>{row.teacherRating ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
