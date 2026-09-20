"use client";

import { CopyPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DuplicateWorkshopAction({ workshopId }: { workshopId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [copyParticipants, setCopyParticipants] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function duplicate() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/dashboard/workshops/${workshopId}/duplicate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ copyParticipants }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذر إنشاء الورشة الجديدة");
      router.push(data.nextPath);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "تعذر إنشاء الورشة الجديدة"); setBusy(false); }
  }
  return <>{<button className="button button-secondary" type="button" onClick={() => setOpen(true)}><CopyPlus size={15} /> استخدام كورشة جديدة</button>}{open && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="duplicate-title"><button className="dialog-close" onClick={() => setOpen(false)} aria-label="إغلاق"><X size={17} /></button><h2 id="duplicate-title">استخدام كورشة جديدة</h2><p>سيتم نسخ المعلومات العامة والمعايير والأوزان فقط. لن تُنسخ التواريخ أو التقييمات أو التقرير.</p><label className="confirmation-check"><input type="checkbox" checked={copyParticipants} onChange={(event) => setCopyParticipants(event.target.checked)} /> نسخ المشاركين أيضًا</label>{copyParticipants && <small className="dialog-hint">يمكنك تعديل القائمة في الخطوة التالية.</small>}{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><button className="button button-secondary" onClick={() => setOpen(false)}>إلغاء</button><button className="button button-primary" onClick={() => void duplicate()} disabled={busy}>{busy ? "جارٍ الإنشاء..." : "إنشاء وفتح المسودة"}</button></div></section></div>}</>;
}
