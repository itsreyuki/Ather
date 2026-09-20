"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmAction } from "@/src/components/ui/confirm-action";

export function CancelWorkshopAction({ workshopId }: { workshopId: string }) {
  const router = useRouter(); const [reason, setReason] = useState(""); const [error, setError] = useState("");
  async function cancel() { const response = await fetch(`/api/dashboard/workshops/${workshopId}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, confirmation: "إلغاء الورشة" }) }); const data = await response.json(); if (!response.ok) { setError(data.error ?? "تعذر إلغاء الورشة"); return; } router.push(data.nextPath); }
  return <div className="cancel-workshop"><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="سبب الإلغاء (مطلوب)" aria-label="سبب إلغاء الورشة" /> <ConfirmAction title="إلغاء الورشة؟" description="سيتم تسجيل سبب الإلغاء ولن تدخل الورشة في مؤشرات الأثر. لا يمكن التراجع عن هذا الإجراء من هذه الصفحة." confirmLabel="تأكيد الإلغاء" onConfirm={cancel}><button className="button button-danger" disabled={reason.trim().length < 5}>إلغاء الورشة</button></ConfirmAction>{error && <span className="form-error" role="alert">{error}</span>}</div>;
}
