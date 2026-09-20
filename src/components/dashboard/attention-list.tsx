"use client";

import { BookOpen, Check, ClipboardCheck, FileWarning, Smartphone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/src/components/ui/empty-state";
import { StatusBadge } from "@/src/components/ui/status-badge";
import type { DashboardAttentionItem } from "@/src/lib/dashboard-attention-types";

const icons = {
  POST_ASSESSMENT: ClipboardCheck,
  PHONELESS_STAFF: Smartphone,
  IMPORT_REVIEW: FileWarning,
  DRAFT_WORKSHOP: BookOpen,
} as const;

export function AttentionList({ initialItems }: { initialItems: DashboardAttentionItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function dismiss(item: DashboardAttentionItem) {
    if (busyKey) return;
    setBusyKey(item.key);
    setError(null);
    const previous = items;
    setItems((current) => current.filter((candidate) => candidate.key !== item.key));
    try {
      const response = await fetch("/api/dashboard/attention", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ alertKey: item.key, fingerprint: item.fingerprint }),
      });
      if (!response.ok) throw new Error("dismiss_failed");
    } catch {
      setItems(previous);
      setError("تعذر إخفاء التنبيه. حدّث الصفحة وحاول مرة أخرى.");
    } finally {
      setBusyKey(null);
    }
  }

  if (items.length === 0) {
    return <EmptyState title="لا توجد إجراءات معلقة" description="كل الأسباب التي تحتاج تدخلك تبدو مكتملة حاليًا." />;
  }

  return <>
    <div className="attention-list" aria-live="polite">
      {items.map((item) => {
        const Icon = icons[item.kind];
        return <div className="attention-item" key={`${item.key}:${item.fingerprint}`}>
          <Link className="attention-item-link" href={item.href}>
            <span className={`attention-icon ${item.tone}`}><Icon size={16} aria-hidden="true" /></span>
            <span className="attention-item-copy"><strong>{item.title}</strong><small>{item.description}</small></span>
            <StatusBadge tone={item.tone}>{item.statusLabel}</StatusBadge>
          </Link>
          <button
            className="attention-dismiss"
            type="button"
            onClick={() => void dismiss(item)}
            disabled={busyKey !== null}
            aria-label={`إنهاء التنبيه: ${item.title}`}
            title="إخفاء هذا التنبيه"
          >
            <Check size={14} aria-hidden="true" />
            <span>انتهى</span>
          </button>
        </div>;
      })}
    </div>
    {error && <p className="attention-error" role="alert">{error}</p>}
  </>;
}
