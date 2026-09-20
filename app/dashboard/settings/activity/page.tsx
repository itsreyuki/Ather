import { Activity, Database, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/src/components/ui/page-header";
import { EmptyState } from "@/src/components/ui/empty-state";
import { RetentionSettingsForm } from "@/src/components/audit/retention-settings-form";
import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { hasPermission, Permission } from "@/src/lib/permissions";
import { db } from "@/src/lib/db";

const dateFormatter = new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" });
const actionLabels: Record<string, string> = {
  LOGIN_SUCCESS: "تسجيل دخول ناجح", LOGIN_FAILED: "محاولة دخول فاشلة", LOGIN_VERIFICATION_REQUIRED: "دخول بانتظار التحقق", LOGOUT: "تسجيل خروج", REGISTRATION_CREATED: "إنشاء حساب", VERIFICATION_SUCCEEDED: "اكتمال التحقق", VERIFICATION_FAILED: "فشل التحقق",
  SCHOOL_CREATED: "إنشاء المدرسة", SCHOOL_UPDATED: "تغيير بيانات المدرسة", STAFF_IMPORT_COMMITTED: "استيراد المنسوبين", STAFF_REIMPORT_COMMITTED: "إعادة استيراد المنسوبين", STAFF_MANUALLY_UPDATED: "تحديث بيانات منسوب", STAFF_PHONE_CORRECTED: "تصحيح رقم جوال", STAFF_IDENTITY_CORRECTED: "تغيير رقم هوية", STAFF_MARKED_INACTIVE_AFTER_IMPORT_DIFF: "تعطيل منسوبين بعد الاستيراد",
  WORKSHOP_CREATED: "إنشاء ورشة", WORKSHOP_DUPLICATED: "نسخ ورشة", WORKSHOP_FINALIZED: "اعتماد الورشة", WORKSHOP_CANCELLED: "إلغاء الورشة", WORKSHOP_POST_ASSESSMENT_FINALIZED: "اعتماد التقييم البعدي", TEACHER_EVALUATION_SUBMITTED: "إرسال تقييم مشارك", REPORT_EXPORTED: "تصدير تقرير", TEAM_INVITATION_CREATED: "دعوة مسؤول مدرسة", TEAM_INVITATION_ACCEPTED: "قبول دعوة مسؤول", TEAM_INVITATION_REVOKED: "إلغاء دعوة مسؤول", TEAM_MEMBER_SUSPENDED: "إيقاف مسؤول", TEAM_MEMBER_REACTIVATED: "إعادة تفعيل مسؤول", TEACHER_REMINDER_SENT: "إرسال تذكير",
  TEACHER_LOGIN_IDENTITY_ACCEPTED: "مطابقة هوية منسوب", TEACHER_LOGIN_LOOKUP_MISS: "فشل مطابقة هوية منسوب", TEACHER_LOGIN_RATE_LIMITED: "تقييد محاولات دخول منسوب", PRIVACY_RETENTION_SETTINGS_UPDATED: "تغيير سياسة الاحتفاظ",
};
const actions = Object.keys(actionLabels);
const metadataLabels: Record<string, string> = { format: "الصيغة", participantCount: "عدد المشاركين", criterionCount: "عدد المعايير", imported: "المستورد", created: "الجديد", updated: "المحدّث", sentCount: "عدد المرسَل لهم", responseCount: "عدد المستجيبين", channel: "القناة", fields: "الحقول", source: "المصدر", reimport: "إعادة استيراد", automaticDeletion: "حذف تلقائي", role: "الدور", piiRetentionMode: "سياسة PII", auditRetentionDays: "مدة سجل التدقيق", disabledStaffRetentionDays: "مدة الموظف المعطّل", phoneLast4: "آخر أرقام الجوال" };
const blockedKeys = /otp|password|secret|token|encrypted|nationalIdHash|rawNational|fullPhone|identifierHash/i;

function safeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [] as Array<[string, string]>;
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
    if (blockedKeys.test(key)) return [];
    if (typeof item === "object" && item !== null) return [[metadataLabels[key] ?? key, JSON.stringify(item).slice(0, 140)]] as Array<[string, string]>;
    const text = String(item).replace(/\+?\d{7,15}/g, "[بيانات مخفية]").slice(0, 140);
    return [[metadataLabels[key] ?? key, text]] as Array<[string, string]>;
  });
}

export default async function ActivityPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireDashboardContext({ allowSetup: true, permission: Permission.AuditRead });
  const query = searchParams ? await searchParams : {};
  const action = Array.isArray(query.action) ? query.action[0] : query.action;
  const entity = Array.isArray(query.entity) ? query.entity[0] : query.entity;
  const rawPage = Number(Array.isArray(query.page) ? query.page[0] : query.page);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const from = Array.isArray(query.from) ? query.from[0] : query.from;
  const to = Array.isArray(query.to) ? query.to[0] : query.to;
  const createdAt: { gte?: Date; lt?: Date } = {};
  if (from && !Number.isNaN(new Date(`${from}T00:00:00.000Z`).valueOf())) createdAt.gte = new Date(`${from}T00:00:00.000Z`);
  if (to && !Number.isNaN(new Date(`${to}T00:00:00.000Z`).valueOf())) { const end = new Date(`${to}T00:00:00.000Z`); end.setUTCDate(end.getUTCDate() + 1); createdAt.lt = end; }
  const where = { schoolId: session.membership!.schoolId, ...(action && actions.includes(action) ? { action } : {}), ...(entity?.trim() ? { entity: { contains: entity.trim(), mode: "insensitive" as const } } : {}), ...(Object.keys(createdAt).length ? { createdAt } : {}) };
  const take = 40;
  const [events, total, ownerSettings] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take, include: { user: { select: { email: true, phoneLast4: true } } } }),
    db.auditLog.count({ where }),
    hasPermission(session.membership!.role, Permission.SchoolSettingsManage) ? db.schoolPrivacySettings.upsert({ where: { schoolId: session.membership!.schoolId }, create: { schoolId: session.membership!.schoolId }, update: {}, select: { auditRetentionDays: true, disabledStaffRetentionDays: true, piiRetentionMode: true } }) : Promise.resolve(null),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / take));
  return <><PageHeader eyebrow="إدارة المنصة" title="النشاط والتدقيق" description="سجل زمني قابل للمراجعة لأحداث المدرسة، مع إخفاء البيانات الحساسة من العرض." /><section className="panel audit-integrity-note"><ShieldCheck size={18} color="var(--emerald)" /><div><strong>سجل آمن</strong><p>لا يعرض هذا السجل كلمات المرور أو رموز OTP أو أرقام الهوية والجوال كاملة. تُحفظ البيانات الوصفية الضرورية فقط.</p></div></section><section className="panel"><form className="audit-filters" method="get"><label>الإجراء<select name="action" defaultValue={action ?? ""}><option value="">كل الإجراءات</option>{actions.map((item) => <option value={item} key={item}>{actionLabels[item]}</option>)}</select></label><label>الكيان<input name="entity" defaultValue={entity ?? ""} placeholder="مثل Workshop" /></label><label>من<input type="date" name="from" defaultValue={from ?? ""} /></label><label>إلى<input type="date" name="to" defaultValue={to ?? ""} /></label><button className="button button-secondary" type="submit">تصفية</button></form>{events.length === 0 ? <EmptyState icon={<Activity size={20} />} title="لا توجد أحداث مطابقة" description="ستظهر العمليات الحساسة هنا بعد تنفيذها." /> : <div className="table-scroll"><table className="data-table audit-table"><thead><tr><th>الفاعل</th><th>الإجراء</th><th>الكيان</th><th>التوقيت</th><th>بيانات آمنة</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{event.user?.email ?? (event.user?.phoneLast4 ? `حساب جوال ••••${event.user.phoneLast4}` : event.action.startsWith("TEACHER_") ? "منسوب / النظام" : "النظام")}</td><td><strong>{actionLabels[event.action] ?? event.action}</strong></td><td><span className="audit-entity">{event.entity}</span>{event.entityId && <small className="table-subtext">معرّف داخلي: {event.entityId.slice(0, 10)}…</small>}</td><td>{dateFormatter.format(event.createdAt)}</td><td><div className="audit-metadata">{safeMetadata(event.metadata).map(([key, value]) => <span key={`${key}-${value}`}><b>{key}</b>: {value}</span>)}</div></td></tr>)}</tbody></table></div>}<div className="audit-pagination"><span>عرض {Math.min(total, (page - 1) * take + 1).toLocaleString("ar-SA")}–{Math.min(total, page * take).toLocaleString("ar-SA")} من {total.toLocaleString("ar-SA")}</span><div>{page > 1 && <a className="button button-secondary" href={`/dashboard/settings/activity?page=${page - 1}`}>الأحدث</a>}{page < pageCount && <a className="button button-secondary" href={`/dashboard/settings/activity?page=${page + 1}`}>الأقدم</a>}</div></div></section>{ownerSettings && <section className="panel"><div className="panel-header"><div><h2 className="panel-title">سياسة الاحتفاظ والخصوصية</h2><p className="panel-caption">إعدادات مستقبلية واضحة دون حذف تلقائي أو إجراء غير قابل للعكس.</p></div><Database size={18} color="var(--blue)" /></div><RetentionSettingsForm initial={ownerSettings} /></section>}</>;
}
