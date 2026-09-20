"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmAction } from "@/src/components/ui/confirm-action";

export function DeleteWorkshopAction({ workshopId, compact = false }: { workshopId: string; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/dashboard/workshops/${encodeURIComponent(workshopId)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "تعذر حذف الورشة");
      router.push(data.nextPath ?? "/dashboard/workshops");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر حذف الورشة");
      setBusy(false);
    }
  }

  return <div className="delete-workshop-action">
    <ConfirmAction
      title="حذف الورشة؟"
      description="ستختفي الورشة من قائمة العمل ولن تعود قابلة للفتح. ستبقى سجلات القياس والتقرير التاريخي وسجل التدقيق محفوظة للرجوع النظامي."
      confirmLabel="حذف الورشة"
      onConfirm={remove}
    >
      <button type="button" className={`button button-danger ${compact ? "button-compact" : ""}`} disabled={busy}>
        <Trash2 size={15} />
        {busy ? "جارٍ الحذف..." : "حذف الورشة"}
      </button>
    </ConfirmAction>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
