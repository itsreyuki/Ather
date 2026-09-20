import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { Permission } from "@/src/lib/permissions";
import { StaffImportWizard } from "@/src/components/staff-import/import-wizard";
import { PageHeader } from "@/src/components/ui/page-header";

export default async function StaffImportPage() {
  const session = await requireDashboardContext({ allowSetup: true, permission: Permission.StaffWrite });
  return <><PageHeader eyebrow="إدارة البيانات" title="استيراد قائمة المنسوبين" description="ارفع ملفًا أحدث من نظام نور لتحديث السجلات دون حذف التاريخ السابق." action={<Link className="button button-secondary" href="/dashboard/staff"><ArrowRight size={15} /> العودة للمنسوبين</Link>} /><div className="import-policy-banner" role="note">تأكد من أن رفع بيانات المنسوبين يتم وفق الصلاحيات والسياسات المعتمدة لدى الجهة التعليمية.</div><section className="panel"><StaffImportWizard schoolName={session.membership!.school.name} /></section></>;
}
