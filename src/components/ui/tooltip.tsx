import type { ReactNode } from "react";

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return <span className="tooltip" title={label}>{children}<span className="sr-only">{label}</span></span>;
}
