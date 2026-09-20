import type { CSSProperties } from "react";

export function ProgressRing({ value, label = "مكتمل" }: { value: number; label?: string }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return <div className="progress-ring" style={{ "--progress": `${safeValue * 3.6}deg` } as CSSProperties} role="img" aria-label={`${safeValue}% ${label}`}><div><strong>{safeValue}%</strong><small>{label}</small></div></div>;
}
