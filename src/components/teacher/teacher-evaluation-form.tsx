"use client";

import { Check, Save } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { RatingSelector } from "@/src/components/ui/rating-selector";

type Criterion = { id: string; name: string; description: string | null; participantPrompt: string | null; weight: number };
type GeneralState = { contentQuality: number | null; needFit: number | null; deliveryQuality: number | null; applicability: number | null; overallSatisfaction: number | null; comment: string };

async function saveEvaluation(workshopId: string, payload: Record<string, unknown>) {
  const response = await fetch(`/api/teacher/workshops/${workshopId}/evaluation`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "تعذر حفظ التقييم");
  return data as { submitted?: boolean; savedAt?: string };
}

export function TeacherEvaluationForm({ workshopId, criteria, initialResponses, initialGeneral }: { workshopId: string; criteria: Criterion[]; initialResponses: Record<string, number | null>; initialGeneral: GeneralState }) {
  const [responses, setResponses] = useState<Record<string, number | null>>(initialResponses);
  const [general, setGeneral] = useState<GeneralState>(initialGeneral);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const initialized = useRef(false);
  const completed = criteria.filter((criterion) => typeof responses[criterion.id] === "number").length;

  const persist = useCallback(async (action: "autosave" | "submit") => {
    setSaving(true); setError("");
    try { const result = await saveEvaluation(workshopId, { action, criteria: criteria.map((criterion) => ({ criterionId: criterion.id, rating: responses[criterion.id] ?? null })), contentQuality: general.contentQuality, needFit: general.needFit, deliveryQuality: general.deliveryQuality, applicability: general.applicability, overallSatisfaction: general.overallSatisfaction, comment: general.comment }); setSaved(true); if (result.submitted) setSubmitted(true); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "تعذر حفظ التقييم"); }
    finally { setSaving(false); }
  }, [criteria, general, responses, workshopId]);

  useEffect(() => {
    if (!initialized.current) { initialized.current = true; return; }
    const timer = window.setTimeout(() => { void persist("autosave"); }, 800);
    return () => window.clearTimeout(timer);
  }, [persist]);

  if (submitted) return <section className="teacher-evaluation-success"><div className="teacher-success-mark">✓</div><h2>تم إرسال تقييمك</h2><p>شكرًا لمشاركتك. تم حفظ تقييمك ضمن مؤشرات الورشة وتحليلاتها.</p></section>;
  return <section className="teacher-evaluation-form"><div className="teacher-evaluation-progress"><div><strong>تقدم التقييم</strong><span>{completed.toLocaleString("ar-SA")} من {criteria.length.toLocaleString("ar-SA")}</span></div><div className="teacher-progress-track"><span style={{ width: `${criteria.length ? (completed / criteria.length) * 100 : 0}%` }} /></div></div><div className="teacher-evaluation-section-heading"><h2>معايير الورشة</h2><p>قيّم كل معيار بحسب تجربتك خلال الورشة.</p></div><div className="teacher-criteria-list">{criteria.map((criterion) => <article className="teacher-criterion-card" key={criterion.id}><div><h3>{criterion.name}</h3><p>{criterion.participantPrompt || criterion.description || "ما مدى تحقق هذا الجانب في الورشة؟"}</p></div><RatingSelector value={responses[criterion.id] ?? undefined} onChange={(value) => setResponses((current) => ({ ...current, [criterion.id]: value }))} /></article>)}</div><section className="teacher-general-feedback"><div className="teacher-evaluation-section-heading"><h2>أسئلة عامة عن التجربة</h2><p>هذه الأسئلة منفصلة عن مؤشرات أثر المعايير.</p></div><div className="teacher-general-grid"><GeneralRating label="جودة المحتوى" value={general.contentQuality} onChange={(value) => setGeneral((current) => ({ ...current, contentQuality: value }))} /><GeneralRating label="ملاءمة الورشة للاحتياج" value={general.needFit} onChange={(value) => setGeneral((current) => ({ ...current, needFit: value }))} /><GeneralRating label="جودة التقديم" value={general.deliveryQuality} onChange={(value) => setGeneral((current) => ({ ...current, deliveryQuality: value }))} /><GeneralRating label="إمكانية تطبيق ما تعلمته" value={general.applicability} onChange={(value) => setGeneral((current) => ({ ...current, applicability: value }))} /><GeneralRating label="الرضا العام" value={general.overallSatisfaction} onChange={(value) => setGeneral((current) => ({ ...current, overallSatisfaction: value }))} /></div></section><div className="teacher-comment-field"><label htmlFor="teacher-comment">ملاحظات إضافية <span>اختياري</span></label><textarea id="teacher-comment" maxLength={2000} value={general.comment} onChange={(event) => setGeneral((current) => ({ ...current, comment: event.target.value }))} placeholder="اكتب ملاحظتك إن رغبت..." /><small>{general.comment.length.toLocaleString("ar-SA")} / 2,000</small></div><div className="teacher-privacy-note"><Check size={16} />تُستخدم تقييمات المشاركين ضمن مؤشرات الورشة وتحليلاتها بصورة مجمعة.</div>{error && <div className="form-error" role="alert">{error}</div>}<div className="teacher-evaluation-actions"><span className="teacher-save-state">{saving ? <><Save size={14} /> جارٍ الحفظ...</> : saved ? <><Check size={14} /> تم الحفظ تلقائيًا</> : ""}</span><button className="button button-primary" type="button" disabled={saving || completed !== criteria.length} onClick={() => { if (window.confirm("بعد الإرسال لن تتمكن من تعديل تقييمك. هل تريد المتابعة؟")) void persist("submit"); }}>إرسال التقييم</button></div></section>;
}

function GeneralRating({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number) => void }) {
  return <div className="teacher-general-rating"><span>{label}</span><RatingSelector value={value ?? undefined} onChange={onChange} /></div>;
}
