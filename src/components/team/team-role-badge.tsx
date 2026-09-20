import { StatusBadge } from "@/src/components/ui/status-badge";

export function TeamRoleBadge({ role }: { role: "SCHOOL_OWNER" | "SCHOOL_ADMIN" }) {
  return <StatusBadge tone={role === "SCHOOL_OWNER" ? "success" : "info"}>{role === "SCHOOL_OWNER" ? "مالك المدرسة" : "مسؤول مدرسة"}</StatusBadge>;
}
