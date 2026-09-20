import type { ReactNode } from "react";
import { DashboardShell } from "@/src/components/layout/dashboard-shell";
import { requireDashboardContext } from "@/src/lib/dashboard-access";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireDashboardContext({ allowSetup: true });
  return <DashboardShell schoolName={session.membership?.school.name} userLabel={session.user.email ?? "مدير المدرسة"} userRole={session.membership?.role}>{children}</DashboardShell>;
}
