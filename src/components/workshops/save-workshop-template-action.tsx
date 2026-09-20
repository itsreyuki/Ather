"use client";

import { CopyPlus } from "lucide-react";
import { useState } from "react";

export function SaveWorkshopTemplateAction({ workshopId }: { workshopId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    const name = window.prompt("اسم القالب");
    if (!name?.trim()) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/dashboard/workshops/${workshopId}/template`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذر حفظ القالب");
      setMessage("تم حفظ القالب");
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر حفظ القالب"); } finally { setBusy(false); }
  }
  return <span className="inline-action"><button className="button button-secondary" type="button" onClick={() => void save()} disabled={busy}><CopyPlus size={15} /> {busy ? "جارٍ الحفظ..." : "حفظ كقالب"}</button>{message && <small className="inline-action-message">{message}</small>}</span>;
}
