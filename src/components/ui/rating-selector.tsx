"use client";

import { useId, useRef, useState } from "react";

const labels = ["منخفض جدًا", "منخفض", "متوسط", "مرتفع", "مرتفع جدًا"];

export function RatingSelector({ value, onChange }: { value?: number; onChange?: (value: number) => void }) {
  const [internalValue, setInternalValue] = useState(value ?? 0);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const groupId = useId();
  const selected = value ?? internalValue;

  function choose(next: number, focus = false) {
    setInternalValue(next);
    onChange?.(next);
    if (focus) buttons.current[next - 1]?.focus();
  }

  function move(current: number, direction: -1 | 1) {
    choose(Math.min(5, Math.max(1, current + direction)), true);
  }

  return <fieldset className="rating-selector">
    <legend id={groupId}>التقييم من 1 إلى 5</legend>
    <div className="rating-options" role="radiogroup" aria-labelledby={groupId}>
      {labels.map((label, index) => {
        const score = index + 1;
        return <button key={score} ref={(element) => { buttons.current[index] = element; }} type="button" role="radio" aria-checked={selected === score} aria-label={`${score} من 5 — ${label}`} title={label} tabIndex={selected === score || (selected === 0 && score === 1) ? 0 : -1} className={selected === score ? "selected" : ""} onClick={() => choose(score)} onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") { event.preventDefault(); move(score, -1); }
          if (event.key === "ArrowRight" || event.key === "ArrowUp") { event.preventDefault(); move(score, 1); }
          if (event.key === "Home") { event.preventDefault(); choose(1, true); }
          if (event.key === "End") { event.preventDefault(); choose(5, true); }
        }}>{score}<span>{label}</span></button>;
      })}
    </div>
  </fieldset>;
}
