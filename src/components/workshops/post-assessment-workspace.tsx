"use client";

import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusBadge } from "@/src/components/ui/status-badge";

type Participant = {
  participantId: string;
  staffId: string;
  fullName: string;
  jobTitle: string | null;
  importSourceName?: string | null;
  importSourceFileName?: string | null;
};
type Criterion = { id: string; name: string; weight: number };

export function PostAssessmentWorkspace({
  workshopId,
  participants,
  criteria,
  initialScores,
  preScores,
  canEdit,
}: {
  workshopId: string;
  participants: Participant[];
  criteria: Criterion[];
  initialScores: Record<string, number>;
  preScores: Record<string, number>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [scores, setScores] = useState(initialScores);
  const [hidePre, setHidePre] = useState(false);
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [review, setReview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const expected = participants.length * criteria.length;
  const completed = Object.keys(scores).length;
  const visible = participants.filter(
    (person) =>
      !incompleteOnly || criteria.some((criterion) => !scores[`${person.participantId}:${criterion.id}`]),
  );
  async function saveScore(participantId: string, criterionId: string, score: number) {
    setScores((current) => ({ ...current, [`${participantId}:${criterionId}`]: score }));
    try {
      const response = await fetch(`/api/dashboard/workshops/${workshopId}/evaluations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "POST", items: [{ participantId, criterionId, score }] }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "تعذر حفظ التقييم");
      setSavedAt(new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر حفظ التقييم");
    }
  }
  function focusCell(row: number, column: number, direction: -1 | 1) {
    const target = document
      .querySelector(`[data-post-row="${row}"]`)
      ?.querySelectorAll<HTMLInputElement>("input[data-post-cell]")?.[column + direction];
    target?.focus();
  }
  async function finalize() {
    if (!confirmed) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/dashboard/workshops/${workshopId}/finalize-post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "اعتماد التقييمات وإنهاء قياس الورشة" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذر إنهاء القياس");
      router.push(data.nextPath);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر إنهاء القياس");
      setBusy(false);
    }
  }
  if (!canEdit)
    return (
      <section className="panel post-workspace">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">التقييم البعدي</h2>
            <p className="panel-caption">تم اعتماد التقييمات وإصدار التقرير، وأصبحت للقراءة فقط.</p>
          </div>
          <StatusBadge tone="success">مكتمل</StatusBadge>
        </div>
        <div className="assessment-readonly-grid">
          {participants.map((person) => (
            <div key={person.participantId}>
              <strong>{person.fullName}</strong>
              <small className="participant-source">
                المصدر: {person.importSourceName ?? person.importSourceFileName ?? "استيراد نور"}
              </small>
              <span>
                {criteria
                  .map(
                    (criterion) =>
                      `${criterion.name}: ${scores[`${person.participantId}:${criterion.id}`] ?? "—"}`,
                  )
                  .join(" · ")}
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  return (
    <section className="panel post-workspace">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">التقييم البعدي</h2>
          <p className="panel-caption">
            تم تقييم {completed.toLocaleString("ar-SA")} من {expected.toLocaleString("ar-SA")}.{" "}
            {savedAt ? `آخر حفظ ${savedAt}` : "يحفظ كل إدخال تلقائيًا."}
          </p>
        </div>
        <StatusBadge tone="warning">مسودة بعدي</StatusBadge>
      </div>
      {review ? (
        <div className="post-review">
          <div className="lock-warning">
            <strong>مراجعة قبل الاعتماد</strong>
            <p>لا يمكن تعديل التقييمات البعدية بعد اعتمادها، وسيتم حساب مؤشر الأثر وإصدار التقرير.</p>
          </div>
          <div className="review-summary">
            <div>
              <span>المشاركون</span>
              <strong>{participants.length.toLocaleString("ar-SA")}</strong>
            </div>
            <div>
              <span>المعايير</span>
              <strong>{criteria.length.toLocaleString("ar-SA")}</strong>
            </div>
            <div>
              <span>الاكتمال</span>
              <strong>
                {completed.toLocaleString("ar-SA")} من {expected.toLocaleString("ar-SA")}
              </strong>
            </div>
          </div>
          <label className="confirmation-check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />{" "}
            أفهم أن اعتماد التقييمات البعدية سيقفلها نهائيًا.
          </label>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="wizard-actions">
            <button className="button button-secondary" onClick={() => setReview(false)}>
              <ChevronRight size={15} /> الرجوع للتعديل
            </button>
            <button
              className="button button-primary"
              onClick={() => void finalize()}
              disabled={!confirmed || busy}
            >
              <Save size={15} /> اعتماد التقييمات وإنهاء قياس الورشة
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="post-tools">
            <label>
              <input
                type="checkbox"
                checked={hidePre}
                onChange={(event) => setHidePre(event.target.checked)}
              />{" "}
              إخفاء التقييم القبلي أثناء الإدخال
            </label>
            <label>
              <input
                type="checkbox"
                checked={incompleteOnly}
                onChange={(event) => setIncompleteOnly(event.target.checked)}
              />{" "}
              غير مكتمل فقط
            </label>
          </div>
          <div className="evaluation-desktop">
            <table className="evaluation-table post-evaluation-table">
              <thead>
                <tr>
                  <th>المعلم</th>
                  {criteria.map((criterion) => (
                    <th key={criterion.id}>
                      {criterion.name}
                      <small>{criterion.weight}٪</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((person, rowIndex) => (
                  <tr data-post-row={rowIndex} key={person.participantId}>
                    <th>
                      {person.fullName}
                      <small>{person.jobTitle ?? "—"}</small>
                    </th>
                    {criteria.map((criterion, columnIndex) => {
                      const key = `${person.participantId}:${criterion.id}`;
                      return (
                        <td key={criterion.id}>
                          <input
                            data-post-cell
                            value={scores[key] ?? ""}
                            type="number"
                            min="1"
                            max="5"
                            disabled={busy}
                            aria-label={`${person.fullName} ${criterion.name}`}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              if (value >= 1 && value <= 5)
                                void saveScore(person.participantId, criterion.id, value);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                                event.preventDefault();
                                focusCell(rowIndex, columnIndex, event.key === "ArrowRight" ? 1 : -1);
                              }
                            }}
                          />
                          {!hidePre && <small className="pre-score">قبلي: {preScores[key] ?? "—"}</small>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="evaluation-mobile">
            {visible.map((person) => (
              <article className="mobile-evaluation-card" key={person.participantId}>
                <strong>{person.fullName}</strong>
                <small>{person.jobTitle ?? "—"}</small>
                {criteria.map((criterion) => {
                  const key = `${person.participantId}:${criterion.id}`;
                  return (
                    <label key={criterion.id}>
                      <span>
                        {criterion.name}
                        {!hidePre && <small>قبلي: {preScores[key] ?? "—"}</small>}
                      </span>
                      <input
                        value={scores[key] ?? ""}
                        type="number"
                        min="1"
                        max="5"
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (value >= 1 && value <= 5)
                            void saveScore(person.participantId, criterion.id, value);
                        }}
                      />
                    </label>
                  );
                })}
              </article>
            ))}
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="wizard-actions">
            <span />
            {completed === expected ? (
              <button className="button button-primary" onClick={() => setReview(true)}>
                مراجعة واعتماد التقييمات <ChevronLeft size={15} />
              </button>
            ) : (
              <span className="muted">أكمل كل الخلايا للمتابعة</span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
