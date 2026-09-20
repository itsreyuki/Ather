import type { ReactNode } from "react";

export type StatusTone = "success" | "warning" | "error" | "neutral" | "info";

export function StatusBadge({ children, tone = "neutral", icon }: { children: ReactNode; tone?: StatusTone; icon?: ReactNode }) {
  return <span className={`status-badge status-${tone}`}><span className="status-badge-dot" />{icon}{children}</span>;
}
