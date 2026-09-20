"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewWorkshopForm() {
  const router = useRouter();
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [startsAt, setStartsAt] = useState(""); const [endsAt, setEndsAt] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { const response = await fetch("/api/dashboard/workshops", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description, startsAt, endsAt }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "تعذر حفظ الورشة"); router.push(`/dashboard/workshops/${data.id}`); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "تعذر حفظ الورشة"); setBusy(false); }
  }
  return <form className="workshop-form" onSubmit={submit}><div className="field"><label htmlFor="workshop-title">اسم الورشة</label><input id="workshop-title" value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="مثال: استراتيجيات التعليم النشط" /></div><div className="field"><label htmlFor="workshop-description">الوصف</label><textarea id="workshop-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="ما الهدف من هذه الورشة؟" /></div><div className="form-grid"><div className="field"><label htmlFor="starts-at">تاريخ البداية</label><input id="starts-at" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} type="datetime-local" required /></div><div className="field"><label htmlFor="ends-at">تاريخ النهاية</label><input id="ends-at" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} type="datetime-local" required /></div></div>{error && <div className="form-error" role="alert">{error}</div>}<div className="form-actions"><button className="button button-primary" type="submit" disabled={busy}><Save size={15} /> {busy ? "جارٍ الحفظ..." : "حفظ كمسودة"}</button></div></form>;
}
