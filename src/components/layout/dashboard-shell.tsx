"use client";

import type { UserRole } from "@prisma/client";
import {
  Activity,
  BarChart3,
  BookOpen,
  ChevronLeft,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  Route,
  Settings2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LogoutButton } from "@/src/components/auth/logout-button";
import { GlobalSearch } from "@/src/components/dashboard/global-search";
import { QuickActions } from "@/src/components/dashboard/quick-actions";
import { NotificationBell } from "@/src/components/notifications/notification-bell";
import { Logo } from "@/src/components/brand/logo";
import { ToastProvider } from "@/src/components/ui/toast-provider";
import { hasPermission, Permission, type Permission as PermissionType } from "@/src/lib/permissions";

type NavItem = { href: string; label: string; icon: LucideIcon; permission?: PermissionType };
const nav: NavItem[] = [
  { href: "/dashboard", label: "نظرة عامة", icon: LayoutDashboard },
  { href: "/dashboard/workshops", label: "الورش والبرامج", icon: BookOpen },
  {
    href: "/dashboard/professional-growth-plans",
    label: "خطط النمو المهني",
    icon: Route,
    permission: Permission.ProfessionalGrowthPlansRead,
  },
  { href: "/dashboard/staff", label: "المشاركون", icon: Users, permission: Permission.StaffRead },
  {
    href: "/dashboard/reports",
    label: "التقارير والتحليلات",
    icon: BarChart3,
    permission: Permission.ReportsRead,
  },
];
const management: NavItem[] = [
  {
    href: "/dashboard/settings",
    label: "الإعدادات",
    icon: Settings2,
    permission: Permission.SchoolSettingsManage,
  },
  {
    href: "/dashboard/settings#criteria",
    label: "معايير القياس",
    icon: ClipboardCheck,
    permission: Permission.SchoolSettingsManage,
  },
  {
    href: "/dashboard/settings/activity",
    label: "النشاط والتدقيق",
    icon: Activity,
    permission: Permission.AuditRead,
  },
  { href: "/dashboard/settings/team", label: "فريق المدرسة", icon: Users, permission: Permission.TeamManage },
];

export function DashboardShell({
  children,
  schoolName = "المدرسة الحالية",
  userLabel = "مدير المدرسة",
  userRole = "SCHOOL_OWNER",
}: {
  children: ReactNode;
  schoolName?: string;
  userLabel?: string;
  userRole?: UserRole;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = (items: NavItem[]) =>
    items
      .filter((item) => !item.permission || hasPermission(userRole, item.permission))
      .map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={`nav-item ${active ? "active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={17} />
            {label}
          </Link>
        );
      });
  return (
    <ToastProvider>
      <div className="app-shell">
        <button
          className={`sidebar-scrim ${open ? "visible" : ""}`}
          aria-label="إغلاق القائمة"
          onClick={() => setOpen(false)}
        />
        <aside className={`sidebar dashboard-sidebar ${open ? "open" : ""}`}>
          <div className="sidebar-top">
            <Logo href="/dashboard" />
            <button
              className="icon-button sidebar-close"
              onClick={() => setOpen(false)}
              aria-label="إغلاق القائمة"
            >
              <X size={18} />
            </button>
          </div>
          <div className="nav-section">
            <div className="nav-label">مساحة العمل</div>
            <nav className="nav-list" aria-label="التنقل الرئيسي">
              {links(nav)}
            </nav>
          </div>
          <div className="nav-section">
            <div className="nav-label">إدارة المنصة</div>
            <nav className="nav-list">{links(management)}</nav>
          </div>
          <div className="sidebar-spacer" />
          <div className="school-switcher">
            <span className="school-avatar">م</span>
            <span>
              <strong>{schoolName}</strong>
              <small>المدرسة النشطة</small>
            </span>
            <ChevronLeft size={14} />
          </div>
          <div className="user-card">
            <div className="avatar">م</div>
            <div>
              <div className="user-name">{userLabel}</div>
              <div className="user-role">{userRole === "SCHOOL_OWNER" ? "مالك المدرسة" : "مسؤول مدرسة"}</div>
            </div>
            <LogoutButton icon={<LogOut size={14} />} label="" />
          </div>
        </aside>
        <main className="main-content">
          <header className="dashboard-topbar">
            <button
              className="icon-button mobile-nav-trigger"
              onClick={() => setOpen(true)}
              aria-label="فتح القائمة"
            >
              <Menu size={18} />
            </button>
            <GlobalSearch />
            <div className="topbar-spacer" />
            <QuickActions />
            <NotificationBell />
            <span className="topbar-divider" />
            <span className="topbar-status">
              <span /> النظام يعمل بصورة طبيعية
            </span>
          </header>
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
