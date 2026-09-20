import type { CSSProperties } from "react";

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  const safeCurrent = Math.min(Math.max(current, 0), Math.max(steps.length - 1, 0));
  const progress = steps.length > 1 ? (safeCurrent / (steps.length - 1)) * 100 : 0;
  return <div className="stepper-wrap">
    <div className="stepper-summary" aria-live="polite"><strong>الخطوة {safeCurrent + 1} من {steps.length}</strong><span>{steps[safeCurrent]}</span></div>
    <ol className="stepper" aria-label="خطوات الإعداد" style={{ "--step-progress": `${progress}%` } as CSSProperties}>
      {steps.map((step, index) => <li key={step} className={index < safeCurrent ? "completed" : index === safeCurrent ? "current" : ""} aria-current={index === safeCurrent ? "step" : undefined}>
        <span>{index < safeCurrent ? "✓" : index + 1}</span><small>{step}</small>
      </li>)}
    </ol>
  </div>;
}
