"use client";

import { Minus, Plus } from "lucide-react";

export function RatingStepper({
  value,
  onChange,
  label,
  disabled = false,
  dataCell,
}: {
  value?: number | null;
  onChange: (value: number) => void;
  label: string;
  disabled?: boolean;
  dataCell?: "evaluation" | "post";
}) {
  const current = typeof value === "number" && value >= 1 && value <= 5 ? value : null;

  function change(next: number) {
    if (next >= 1 && next <= 5) onChange(next);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      event.preventDefault();
      change((current ?? 0) + 1);
    }
    if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      event.preventDefault();
      change((current ?? 6) - 1);
    }
    if (event.key === "Home") {
      event.preventDefault();
      change(1);
    }
    if (event.key === "End") {
      event.preventDefault();
      change(5);
    }
    if (/^[1-5]$/.test(event.key)) change(Number(event.key));
  }

  return (
    <div
      className="rating-stepper"
      role="group"
      aria-label={label}
      data-evaluation-cell={dataCell === "evaluation" ? true : undefined}
      data-post-cell={dataCell === "post" ? true : undefined}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className="rating-stepper-button"
        aria-label={`خفض ${label}`}
        title="خفض التقييم"
        disabled={disabled || current === null || current <= 1}
        onClick={() => change((current ?? 1) - 1)}
      >
        <Minus size={15} aria-hidden="true" />
      </button>
      <output className="rating-stepper-value" aria-label={`${current ?? "غير مكتمل"} من 5`}>
        <strong>{current ?? "—"}</strong>
        <span>/5</span>
      </output>
      <button
        type="button"
        className="rating-stepper-button"
        aria-label={`رفع ${label}`}
        title="رفع التقييم"
        disabled={disabled || current === 5}
        onClick={() => change((current ?? 0) + 1)}
      >
        <Plus size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
