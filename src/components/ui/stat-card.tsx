import type { ReactNode } from "react";

export function StatCard({ label, value, detail, icon }: { label: string; value: string; detail?: string; icon?: ReactNode }) {
  return <article className="stat-card ui-stat-card"><div className="ui-stat-top"><span className="stat-label">{label}</span>{icon && <span className="ui-stat-icon">{icon}</span>}</div><div className="stat-value">{value}</div>{detail && <div className="stat-meta">{detail}</div>}</article>;
}
