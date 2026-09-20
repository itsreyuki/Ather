import type { ReactNode } from "react";

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return <div className="state-card empty-state"><div className="state-icon">{icon}</div><h2>{title}</h2>{description && <p>{description}</p>}{action && <div className="state-action">{action}</div>}</div>;
}
