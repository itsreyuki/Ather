import Link from "next/link";
import { LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/src/lib/auth";
import { LogoutButton } from "@/src/components/auth/logout-button";
import { StaffImportWizard } from "@/src/components/staff-import/import-wizard";
import { Stepper } from "@/src/components/ui/stepper";

export default async function ImportOnboardingPage() {
  const session = await getSessionContext();
  if (!session) redirect("/auth/login");
  if (!session.membership) redirect("/onboarding");
  return <main className="onboarding-page"><section className="import-card"><div className="import-card-top"><Link className="logo" href="/"><span className="logo-symbol">أ</span><span className="logo-copy"><strong>أثر</strong><small>ATHAR</small></span></Link><LogoutButton label="تسجيل الخروج" icon={<LogOut size={15} />} /></div><Stepper steps={["الحساب", "معلومات المدرسة", "استيراد المنسوبين"]} current={2} /><StaffImportWizard schoolName={session.membership.school.name} /></section></main>;
}
