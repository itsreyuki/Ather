import { ShieldCheck, UsersRound } from "lucide-react";
import { PageHeader } from "@/src/components/ui/page-header";
import { EmptyState } from "@/src/components/ui/empty-state";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { TeamMemberStatusAction } from "@/src/components/team/team-actions";
import { TeamRoleBadge } from "@/src/components/team/team-role-badge";
import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { Permission } from "@/src/lib/permissions";
import { db } from "@/src/lib/db";

const dateFormatter = new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" });

export default async function TeamSettingsPage() {
  const session = await requireDashboardContext({ allowSetup: true, permission: Permission.TeamManage });
  const members = await db.schoolMembership.findMany({ where: { schoolId: session.membership!.schoolId }, orderBy: [{ role: "asc" }, { createdAt: "asc" }], include: { user: { select: { email: true, phoneLast4: true } } } });
  return <><PageHeader eyebrow="إدارة المنصة" title="فريق المدرسة" description="إدارة حسابات المسؤولين المرتبطة بالمدرسة دون إرسال دعوات أو رسائل خارجية." /><section className="panel team-permission-note"><ShieldCheck size={19} color="var(--emerald)" /><div><strong>صلاحيات مركزية</strong><p>مالك المدرسة يملك كل الصلاحيات. مسؤول المدرسة يدير الموظفين والورش والقياسات والتقارير، ولا يملك إدارة الفريق أو نقل الملكية أو الإعدادات الأمنية الحساسة.</p></div></section><section className="panel"><div className="panel-header"><div><h2 className="panel-title">أعضاء الفريق</h2><p className="panel-caption">{members.length.toLocaleString("ar-SA")} أعضاء مرتبطون بهذه المدرسة.</p></div><UsersRound size={18} color="var(--emerald)" /></div>{members.length === 0 ? <EmptyState title="لا يوجد أعضاء" description="ستظهر الحسابات المرتبطة بالمدرسة هنا." /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>الحساب</th><th>الدور</th><th>الحالة</th><th>تاريخ الانضمام</th><th>إجراء</th></tr></thead><tbody>{members.map((member) => <tr key={member.id}><td><strong>{member.user.email ?? (member.user.phoneLast4 ? `جوال ينتهي بـ ${member.user.phoneLast4}` : "حساب بدون وسيلة عرض")}</strong>{member.user.email && member.user.phoneLast4 && <small className="table-subtext">جوال ينتهي بـ {member.user.phoneLast4}</small>}</td><td><TeamRoleBadge role={member.role} /></td><td><StatusBadge tone={member.status === "ACTIVE" ? "success" : "neutral"}>{member.status === "ACTIVE" ? "نشط" : "موقوف"}</StatusBadge></td><td>{dateFormatter.format(member.createdAt)}</td><td>{member.role === "SCHOOL_ADMIN" && member.userId !== session.user.id ? <TeamMemberStatusAction membershipId={member.id} status={member.status} /> : <span className="muted-note">محمي</span>}</td></tr>)}</tbody></table></div>}</section></>;
}
