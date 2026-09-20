"use client";

import { AlertTriangle, X } from "lucide-react";
import { useState, type ReactNode } from "react";

export function ConfirmAction({ label = "تأكيد الإجراء", title, description, confirmLabel = "تأكيد", children, onConfirm }: { label?: string; title: string; description: string; confirmLabel?: string; children: ReactNode; onConfirm?: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function confirm() { setBusy(true); try { await onConfirm?.(); setOpen(false); } finally { setBusy(false); } }
  return <>
    <span onClick={() => setOpen(true)} aria-label={label}>{children}</span>
    {open && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description"><button className="dialog-close" onClick={() => setOpen(false)} aria-label="إغلاق"><X size={17} /></button><div className="dialog-icon"><AlertTriangle size={20} /></div><h2 id="confirm-title">{title}</h2><p id="confirm-description">{description}</p><div className="dialog-actions"><button className="button button-secondary" onClick={() => setOpen(false)}>إلغاء</button><button className="button button-danger" onClick={confirm} disabled={busy}>{busy ? "جارٍ التنفيذ..." : confirmLabel}</button></div></section></div>}
  </>;
}
