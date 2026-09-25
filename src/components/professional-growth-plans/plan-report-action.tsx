"use client";

import { FileBarChart2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PlanReportAction({ planId }: { planId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function createReport() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/dashboard/professional-growth-plans/${planId}/report`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذر إنشاء التقرير.");
      router.push(data.nextPath);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر إنشاء التقرير.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="plan-report-action">
      <button
        className="button button-primary"
        type="button"
        disabled={busy}
        onClick={() => void createReport()}
      >
        <FileBarChart2 size={15} />
        {busy ? "جارٍ إنشاء التقرير..." : "استخراج تقرير الخطة الشامل"}
      </button>
      {error && <small className="form-error">{error}</small>}
    </div>
  );
}
