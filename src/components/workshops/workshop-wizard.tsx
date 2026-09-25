"use client";

import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ConfirmAction } from "@/src/components/ui/confirm-action";
import { CalendarDateInput } from "@/src/components/ui/calendar-date-input";
import { RatingStepper } from "@/src/components/ui/rating-stepper";
import { StatusBadge } from "@/src/components/ui/status-badge";

type Staff = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  specialization: string | null;
  importSourceName?: string | null;
  importSourceFileName?: string | null;
  importFormat?: string | null;
  importReviewRequired?: boolean;
};
type Criterion = {
  id?: string;
  clientKey: string;
  name: string;
  description: string;
  category: string;
  guidance: string;
  weight: number;
  targetValue: number | null;
};
type Info = {
  title: string;
  description: string;
  facilitator: string;
  facilitatorStaffId: string;
  providerOrganization: string;
  workshopType: string;
  programType: string;
  category: string;
  deliveryMode: "IN_PERSON" | "REMOTE" | "HYBRID";
  locationOrUrl: string;
  startsAt: string;
  endsAt: string;
  objectives: string;
  notes: string;
};
type Initial = {
  id?: string;
  templateId?: string;
  info: Info;
  participantIds: string[];
  participantMap?: Record<string, string>;
  criteria: Criterion[];
  scores: Record<string, number>;
  draftStep: number;
};
type Template = {
  templateName: string;
  name: string;
  description: string | null;
  category: string | null;
  guidance: string | null;
  defaultWeight: number | null;
};

const emptyInfo: Info = {
  title: "",
  description: "",
  facilitator: "",
  facilitatorStaffId: "",
  providerOrganization: "",
  workshopType: "",
  programType: "",
  category: "",
  deliveryMode: "IN_PERSON",
  locationOrUrl: "",
  startsAt: "",
  endsAt: "",
  objectives: "",
  notes: "",
};
const presets = [
  { name: "تطبيق المعرفة", category: "المعرفة" },
  { name: "جودة الأداء", category: "الأداء" },
  { name: "الكفاءة", category: "الأداء" },
  { name: "الثقة المهنية", category: "السلوك" },
  { name: "نقل المعرفة", category: "الأثر" },
  { name: "الالتزام بالإجراء", category: "الإجراءات" },
];
const steps = ["معلومات الورشة", "المشاركون", "معايير الأثر", "التقييم القبلي", "المراجعة والاعتماد"];

export function WorkshopWizard({ staff, initial }: { staff: Staff[]; initial?: Initial }) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(initial?.draftStep ?? 0, 4));
  const [workshopId, setWorkshopId] = useState(initial?.id ?? null);
  const [info, setInfo] = useState<Info>(initial?.info ?? emptyInfo);
  const [selectedIds, setSelectedIds] = useState<string[]>(initial?.participantIds ?? []);
  const [participantMap, setParticipantMap] = useState<Record<string, string>>(initial?.participantMap ?? {});
  const [criteria, setCriteria] = useState<Criterion[]>(initial?.criteria ?? []);
  const [scores, setScores] = useState<Record<string, number>>(initial?.scores ?? {});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const workshopIdRef = useRef(workshopId);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    workshopIdRef.current = workshopId;
  }, [workshopId]);

  async function saveInfo(nextInfo: Info, nextStep = step) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        workshopIdRef.current
          ? `/api/dashboard/workshops/${workshopIdRef.current}`
          : "/api/dashboard/workshops",
        {
          method: workshopIdRef.current ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...nextInfo, draftStep: nextStep }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذر حفظ المسودة");
      if (!workshopIdRef.current) {
        workshopIdRef.current = data.id;
        setWorkshopId(data.id);
        window.history.replaceState(null, "", `/dashboard/workshops/new?id=${data.id}`);
      }
      setSavedAt(new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }));
      return workshopIdRef.current;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر حفظ المسودة");
      return null;
    } finally {
      setSaving(false);
    }
  }
  function updateInfo(patch: Partial<Info>) {
    const next = { ...info, ...patch };
    setInfo(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveInfo(next);
    }, 700);
  }
  function requireId() {
    if (!workshopIdRef.current) {
      setError("أدخل اسم الورشة أو احفظ المسودة أولًا");
      return null;
    }
    return workshopIdRef.current;
  }
  async function nextStep() {
    setError("");
    if (step === 0) {
      if (!info.title.trim()) return setError("اسم الورشة مطلوب");
      if (!info.programType) return setError("اختر نوع البرنامج");
      if (!info.facilitatorStaffId) return setError("اختر منفذ الورشة");
      if (!info.startsAt || !info.endsAt) return setError("تاريخ ووقت البداية والنهاية مطلوبان");
      if (new Date(info.endsAt) <= new Date(info.startsAt))
        return setError("تاريخ النهاية يجب أن يكون بعد البداية");
      if (!(await saveInfo(info, 1))) return;
    }
    if (step === 1) {
      const id = requireId();
      if (!id) return;
      if (!selectedIds.length) return setError("اختر مشاركًا واحدًا على الأقل");
      if (!(await saveParticipants(id))) return;
    }
    if (step === 2) {
      const id = requireId();
      if (!id) return;
      if (!criteria.length) return setError("أضف معيارًا واحدًا على الأقل");
      if (Math.abs(criteria.reduce((sum, item) => sum + item.weight, 0) - 100) > 0.01)
        return setError("مجموع الأوزان يجب أن يساوي 100٪");
      if (!(await saveCriteria(id))) return;
    }
    if (step === 3) {
      const expected = selectedIds.length * criteria.length;
      const completed = completedScores();
      if (completed < expected)
        return setError(`أكمل التقييم القبلي لكل المشاركين والمعايير (${completed} من ${expected})`);
    }
    setStep((current) => Math.min(4, current + 1));
  }
  function previousStep() {
    setError("");
    setStep((current) => Math.max(0, current - 1));
  }
  async function saveParticipants(id: string) {
    setSaving(true);
    try {
      const response = await fetch(`/api/dashboard/workshops/${id}/participants`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffIds: selectedIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذر حفظ المشاركين");
      setParticipantMap(
        Object.fromEntries(
          (data.participants ?? []).map((item: { staffId: string; id: string }) => [item.staffId, item.id]),
        ),
      );
      setSavedAt(new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }));
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر حفظ المشاركين");
      return false;
    } finally {
      setSaving(false);
    }
  }
  async function saveCriteria(id: string) {
    setSaving(true);
    try {
      const response = await fetch(`/api/dashboard/workshops/${id}/criteria`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          criteria: criteria.map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            category: item.category,
            guidance: item.guidance,
            weight: item.weight,
            targetValue: item.targetValue,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذر حفظ المعايير");
      setCriteria(
        data.criteria.map((item: Omit<Criterion, "clientKey">, index: number) => ({
          ...item,
          clientKey: criteria[index]?.clientKey ?? crypto.randomUUID(),
          description: item.description ?? "",
          category: item.category ?? "",
          guidance: item.guidance ?? "",
          targetValue: item.targetValue ?? null,
        })),
      );
      setSavedAt(new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }));
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر حفظ المعايير");
      return false;
    } finally {
      setSaving(false);
    }
  }
  function completedScores() {
    const participantKeys = new Set(selectedIds.map((id) => participantMap[id] ?? id));
    const criterionKeys = new Set(
      criteria.map((criterion) => criterion.id).filter((id): id is string => Boolean(id)),
    );
    return Object.keys(scores).filter((key) => {
      const separator = key.indexOf(":");
      return (
        separator > 0 &&
        participantKeys.has(key.slice(0, separator)) &&
        criterionKeys.has(key.slice(separator + 1))
      );
    }).length;
  }
  function participantKey(staffId: string) {
    return participantMap[staffId] ?? staffId;
  }
  async function saveScore(staffId: string, criterionId: string, score: number) {
    const participantId = participantKey(staffId);
    const key = `${participantId}:${criterionId}`;
    setScores((current) => ({ ...current, [key]: score }));
    const id = requireId();
    if (!id) return;
    try {
      const response = await fetch(`/api/dashboard/workshops/${id}/evaluations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ participantId, criterionId, score }] }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "تعذر حفظ التقييم");
      setSavedAt(new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر حفظ التقييم");
    }
  }
  async function bulkScores(staffIds: string[], criterionId: string, score: number) {
    await Promise.all(staffIds.map((staffId) => saveScore(staffId, criterionId, score)));
  }
  async function finalize() {
    const id = requireId();
    if (!id || !confirmed) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/dashboard/workshops/${id}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "اعتماد وبدء عملية القياس" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذر اعتماد الورشة");
      router.push(data.nextPath);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر اعتماد الورشة");
      setSaving(false);
    }
  }

  return (
    <section className="workshop-wizard">
      <header className="wizard-top">
        <div>
          <span className="eyebrow">قياس ورشة جديدة</span>
          <h1>{info.title || "مسودة ورشة"}</h1>
          <p>
            {saving
              ? "جارٍ حفظ المسودة..."
              : savedAt
                ? `آخر حفظ تلقائي ${savedAt}`
                : "يتم حفظ المسودة تلقائيًا"}
          </p>
        </div>
        <StatusBadge tone={workshopId ? "success" : "neutral"}>
          {workshopId ? "مسودة محفوظة" : "مسودة جديدة"}
        </StatusBadge>
      </header>
      <ol className="wizard-steps">
        {steps.map((label, index) => (
          <li className={index === step ? "current" : index < step ? "completed" : ""} key={label}>
            <span>{index < step ? <Check size={14} /> : index + 1}</span>
            <small>{label}</small>
          </li>
        ))}
      </ol>
      {step === 0 && <InfoStep info={info} staff={staff} updateInfo={updateInfo} />}
      {step === 1 && (
        <ParticipantsStep staff={staff} selectedIds={selectedIds} setSelectedIds={setSelectedIds} />
      )}
      {step === 2 && <CriteriaStep criteria={criteria} setCriteria={setCriteria} />}
      {step === 3 && (
        <EvaluationStep
          staff={staff.filter((item) => selectedIds.includes(item.id))}
          criteria={criteria.filter((item) => item.id)}
          scores={scores}
          saveScore={saveScore}
          bulkScores={bulkScores}
          completed={completedScores()}
          participantMap={participantMap}
        />
      )}
      {step === 4 && (
        <ReviewStep
          info={info}
          staff={staff.filter((item) => selectedIds.includes(item.id))}
          criteria={criteria}
          completed={completedScores()}
          confirmed={confirmed}
          setConfirmed={setConfirmed}
          finalize={finalize}
        />
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <footer className="wizard-actions">
        <button className="button button-secondary" onClick={previousStep} disabled={step === 0 || saving}>
          <ChevronRight size={15} /> السابق
        </button>
        {step < 4 ? (
          <button className="button button-primary" onClick={() => void nextStep()} disabled={saving}>
            {saving ? "جارٍ الحفظ..." : "التالي"}
            <ChevronLeft size={15} />
          </button>
        ) : (
          <button
            className="button button-primary"
            onClick={() => void finalize()}
            disabled={!confirmed || saving}
          >
            <Save size={15} /> اعتماد وبدء عملية القياس
          </button>
        )}
      </footer>
    </section>
  );
}

function InfoStep({
  info,
  staff,
  updateInfo,
}: {
  info: Info;
  staff: Staff[];
  updateInfo: (patch: Partial<Info>) => void;
}) {
  const duration =
    info.startsAt && info.endsAt && new Date(info.endsAt) > new Date(info.startsAt)
      ? Math.round((new Date(info.endsAt).getTime() - new Date(info.startsAt).getTime()) / 60000)
      : null;
  return (
    <section className="wizard-panel">
      <div className="wizard-panel-heading">
        <h2>معلومات الورشة</h2>
        <p>أدخل الأساسيات، وسيتم حفظ المسودة تلقائيًا أثناء الكتابة.</p>
      </div>
      <div className="form-grid">
        <Field
          label="اسم الورشة"
          value={info.title}
          onChange={(value) => updateInfo({ title: value })}
          required
        />
        <label className="field">
          <span>نوع البرنامج</span>
          <select
            value={info.programType}
            onChange={(event) =>
              updateInfo({
                programType: event.target.value as Info["programType"],
                workshopType: event.target.selectedOptions[0]?.text ?? "",
              })
            }
          >
            <option value="">اختر النوع</option>
            <option value="TECHNICAL">تقني</option>
            <option value="TECHNICAL_EDUCATIONAL">تقني تعليمي</option>
            <option value="PROFESSIONAL">مهني</option>
            <option value="PROFESSIONAL_EDUCATIONAL">مهني تعليمي</option>
            <option value="EDUCATIONAL">تربوي</option>
            <option value="EDUCATIONAL_EDUCATIONAL">تربوي تعليمي</option>
          </select>
        </label>
        <label className="field">
          <span>منفذ الورشة</span>
          <select
            value={info.facilitatorStaffId}
            onChange={(event) => {
              const selected = staff.find((item) => item.id === event.target.value);
              updateInfo({ facilitatorStaffId: event.target.value, facilitator: selected?.fullName ?? "" });
            }}
          >
            <option value="">اختر أحد المنسوبين</option>
            {staff.map((item) => (
              <option value={item.id} key={item.id}>
                {item.fullName}
                {item.jobTitle ? ` — ${item.jobTitle}` : ""}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="الجهة المقدمة"
          value={info.providerOrganization}
          onChange={(value) => updateInfo({ providerOrganization: value })}
        />
        <Field
          label="المجال / التصنيف"
          value={info.category}
          onChange={(value) => updateInfo({ category: value })}
        />
      </div>
      <Field
        label="وصف مختصر"
        value={info.description}
        onChange={(value) => updateInfo({ description: value })}
        textarea
      />
      <div className="form-grid">
        <label className="field">
          <span>موقع التنفيذ</span>
          <select
            value={info.deliveryMode}
            onChange={(event) => updateInfo({ deliveryMode: event.target.value as Info["deliveryMode"] })}
          >
            <option value="IN_PERSON">حضوري</option>
            <option value="REMOTE">عن بعد</option>
            <option value="HYBRID">هجين</option>
          </select>
        </label>
        <Field
          label="المكان أو الرابط"
          value={info.locationOrUrl}
          onChange={(value) => updateInfo({ locationOrUrl: value })}
        />
      </div>
      <div className="form-grid">
        <CalendarDateInput
          label="تاريخ ووقت البداية"
          value={info.startsAt}
          onChange={(value) => updateInfo({ startsAt: value })}
          required
        />
        <CalendarDateInput
          label="تاريخ ووقت النهاية"
          value={info.endsAt}
          onChange={(value) => updateInfo({ endsAt: value })}
          required
        />
      </div>
      {duration !== null && (
        <div className="duration-note">
          المدة التلقائية: {Math.floor(duration / 60) ? `${Math.floor(duration / 60)} ساعة` : ""}{" "}
          {duration % 60 ? `${duration % 60} دقيقة` : ""}
        </div>
      )}
      <Field
        label="أهداف الورشة"
        value={info.objectives}
        onChange={(value) => updateInfo({ objectives: value })}
        textarea
      />
      <Field
        label="ملاحظات (اختياري)"
        value={info.notes}
        onChange={(value) => updateInfo({ notes: value })}
        textarea
      />
    </section>
  );
}
function Field({
  label,
  value,
  onChange,
  required,
  textarea,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  textarea?: boolean;
  type?: string;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <em>مطلوب</em>}
      </span>
      {textarea ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={type}
          required={required}
        />
      )}
    </label>
  );
}

function ParticipantsStep({
  staff,
  selectedIds,
  setSelectedIds,
}: {
  staff: Staff[];
  selectedIds: string[];
  setSelectedIds: (value: string[] | ((current: string[]) => string[])) => void;
}) {
  const [query, setQuery] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const normalized = query.trim().toLowerCase();
  const specializations = [...new Set(staff.map((item) => item.specialization).filter(Boolean))] as string[];
  const jobTitles = [...new Set(staff.map((item) => item.jobTitle).filter(Boolean))] as string[];
  const filtered = staff.filter(
    (item) =>
      (!normalized ||
        `${item.fullName} ${item.jobTitle ?? ""} ${item.specialization ?? ""} ${item.importSourceName ?? ""}`
          .toLowerCase()
          .includes(normalized)) &&
      (!specialization || item.specialization === specialization) &&
      (!jobTitle || item.jobTitle === jobTitle),
  );
  const allFiltered = filtered.length > 0 && filtered.every((item) => selectedIds.includes(item.id));
  function toggle(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }
  function toggleFiltered() {
    setSelectedIds((current) =>
      allFiltered
        ? current.filter((id) => !filtered.some((item) => item.id === id))
        : [...new Set([...current, ...filtered.map((item) => item.id)])],
    );
  }
  function reviewCount(value: boolean | undefined) {
    return value ? 1 : 0;
  }
  return (
    <section className="wizard-panel">
      <div className="wizard-panel-heading">
        <h2>اختيار المشاركين</h2>
        <p>
          تم اختيار {selectedIds.length.toLocaleString("ar-SA")} من {staff.length.toLocaleString("ar-SA")}{" "}
          منسوبًا.
        </p>
      </div>
      <div className="directory-toolbar wizard-filters">
        <input
          className="input-control"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث بالاسم أو المصدر"
        />
        <select value={specialization} onChange={(event) => setSpecialization(event.target.value)}>
          <option value="">كل التخصصات</option>
          {specializations.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select value={jobTitle} onChange={(event) => setJobTitle(event.target.value)}>
          <option value="">كل المسميات</option>
          {jobTitles.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button className="button button-secondary" onClick={toggleFiltered}>
          {allFiltered ? "إزالة المحدد" : "تحديد النتائج"}
        </button>
      </div>
      <div className="selection-summary">
        تم اختيار <strong>{selectedIds.length.toLocaleString("ar-SA")}</strong> من{" "}
        {staff.length.toLocaleString("ar-SA")} منسوبًا
      </div>
      <div className="participant-grid">
        {filtered.map((item) => (
          <label
            className={`participant-option ${selectedIds.includes(item.id) ? "selected" : ""}`}
            key={item.id}
          >
            <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggle(item.id)} />
            <span>
              <strong>{item.fullName}</strong>
              <small>
                {item.jobTitle ?? "—"} · {item.specialization ?? "—"}
              </small>
              <small className="participant-source">
                المصدر: {item.importSourceName ?? item.importSourceFileName ?? "استيراد نور"}
                {item.importFormat === "NOOR_STAFF_ROSTER" ||
                item.importFormat === "NOOR_ADMINISTRATIVE_ROSTER"
                  ? " · منسوبين"
                  : ""}
                {reviewCount(item.importReviewRequired) > 0 ? " · يحتاج مطابقة" : ""}
              </small>
            </span>
          </label>
        ))}
      </div>
      {filtered.length === 0 && <div className="detail-empty">لا توجد نتائج مطابقة.</div>}
    </section>
  );
}

function CriteriaStep({
  criteria,
  setCriteria,
}: {
  criteria: Criterion[];
  setCriteria: (value: Criterion[] | ((current: Criterion[]) => Criterion[])) => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateName, setTemplateName] = useState("");
  useEffect(() => {
    void fetch("/api/dashboard/criterion-templates")
      .then((response) => (response.ok ? response.json() : { templates: [] }))
      .then((data) => setTemplates(data.templates ?? []));
  }, []);
  const total = criteria.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
  function equalWeights(items: Criterion[]) {
    if (!items.length) return items;
    const each = Number((100 / items.length).toFixed(2));
    return items.map((item, index) => ({
      ...item,
      weight: index === items.length - 1 ? Number((100 - each * (items.length - 1)).toFixed(2)) : each,
    }));
  }
  function add(name = "") {
    setCriteria((current) =>
      equalWeights([
        ...current,
        {
          clientKey: crypto.randomUUID(),
          name,
          description: "",
          category: "",
          guidance: "",
          weight: 0,
          targetValue: null,
        },
      ]),
    );
  }
  function update(index: number, patch: Partial<Criterion>) {
    setCriteria((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }
  function distribute() {
    if (!criteria.length) return;
    setCriteria((current) => equalWeights(current));
  }
  function updateWeight(index: number, rawValue: number) {
    setCriteria((current) => {
      if (current.length === 1) return current.map((item) => ({ ...item, weight: 100 }));
      const value = Math.min(100, Math.max(0, Number.isFinite(rawValue) ? rawValue : 0));
      const otherIndexes = current.map((_, itemIndex) => itemIndex).filter((itemIndex) => itemIndex !== index);
      const othersTotal = otherIndexes.reduce((sum, itemIndex) => sum + Math.max(0, Number(current[itemIndex].weight) || 0), 0);
      const remaining = 100 - value;
      let allocated = 0;
      return current.map((item, itemIndex) => {
        if (itemIndex === index) return { ...item, weight: Number(value.toFixed(2)) };
        const position = otherIndexes.indexOf(itemIndex);
        if (position === otherIndexes.length - 1) return { ...item, weight: Number((remaining - allocated).toFixed(2)) };
        const share = othersTotal > 0 ? (Math.max(0, Number(item.weight) || 0) / othersTotal) * remaining : remaining / otherIndexes.length;
        const rounded = Number(share.toFixed(2));
        allocated += rounded;
        return { ...item, weight: rounded };
      });
    });
  }
  function removeCriterion(index: number) {
    setCriteria((current) => equalWeights(current.filter((_, itemIndex) => itemIndex !== index)));
  }
  function move(index: number, direction: -1 | 1) {
    setCriteria((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  function applyTemplate(name: string) {
    const selected = templates.filter((item) => item.templateName === name);
    if (selected.length)
      setCriteria(
        selected.map((item) => ({
          clientKey: crypto.randomUUID(),
          name: item.name,
          description: item.description ?? "",
          category: item.category ?? "",
          guidance: item.guidance ?? "",
          weight: item.defaultWeight ?? 0,
          targetValue: null,
        })),
      );
  }
  async function saveTemplate() {
    if (!templateName.trim() || !criteria.length) return;
    await fetch("/api/dashboard/criterion-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateName, criteria }),
    });
    setTemplateName("");
  }
  return (
    <section className="wizard-panel">
      <div className="wizard-panel-heading">
        <h2>معايير قياس الأثر</h2>
        <p>
          أنشئ المعايير أو استخدم قالبًا. تتوزع الأوزان تلقائيًا وتحافظ على مجموع 100٪ عند تعديل أي معيار.
          <span className={`criteria-total ${Math.abs(total - 100) < 0.01 ? "valid-total" : "invalid-total"}`}>
            <i><b style={{ width: `${Math.min(100, Math.max(0, total))}%` }} /></i>
            <strong>{total.toLocaleString("ar-SA")}٪</strong>
          </span>
        </p>
      </div>
      <div className="template-toolbar">
        <select value="" onChange={(event) => applyTemplate(event.target.value)}>
          <option value="">استخدام قالب محفوظ</option>
          {[...new Set(templates.map((item) => item.templateName))].map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <div className="preset-buttons">
          {presets.slice(0, 3).map((preset) => (
            <button className="button button-secondary" key={preset.name} onClick={() => add(preset.name)}>
              {preset.name}
            </button>
          ))}
        </div>
        <button className="button button-secondary" onClick={() => add()}>
          <Plus size={15} /> معيار جديد
        </button>
        <button className="button button-secondary" onClick={distribute} disabled={!criteria.length}>
          توزيع الأوزان بالتساوي
        </button>
      </div>
      <div className="criteria-list">
        {criteria.map((item, index) => (
          <article className="criterion-editor" key={item.clientKey}>
            <div className="criterion-editor-top">
              <strong>المعيار {index + 1}</strong>
              <span className="criterion-order">
                <button onClick={() => move(index, -1)} aria-label="تحريك لأعلى">
                  <ArrowUp size={14} />
                </button>
                <button onClick={() => move(index, 1)} aria-label="تحريك لأسفل">
                  <ArrowDown size={14} />
                </button>
                <button
                  onClick={() =>
                    removeCriterion(index)
                  }
                  aria-label="حذف المعيار"
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
            <div className="form-grid">
              <Field
                label="اسم المعيار"
                value={item.name}
                onChange={(value) => update(index, { name: value })}
                required
              />
              <Field
                label="مجال المعيار"
                value={item.category}
                onChange={(value) => update(index, { category: value })}
              />
              <div className="criterion-weight-field">
                <div className="criterion-weight-label">
                  <span>وزن المعيار</span>
                  <output>{item.weight.toLocaleString("ar-SA")}٪</output>
                </div>
                <input
                  className="criterion-weight-range"
                  type="range"
                  min="0"
                  max="100"
                  step="0.01"
                  value={item.weight}
                  aria-label={`وزن ${item.name || `المعيار ${index + 1}`}`}
                  onChange={(event) => updateWeight(index, Number(event.target.value))}
                />
                <div className="criterion-weight-meter" aria-hidden="true">
                  <span style={{ width: `${item.weight}%` }} />
                </div>
                <small>عند التعديل، يعاد توزيع بقية الأوزان تلقائيًا.</small>
              </div>
              <label className="field">
                <span>هدف اختياري (1–5)</span>
                <input
                  type="number"
                  min="1"
                  max="5"
                  step="1"
                  value={item.targetValue ?? ""}
                  onChange={(event) =>
                    update(index, { targetValue: event.target.value ? Number(event.target.value) : null })
                  }
                />
              </label>
            </div>
            <Field
              label="الوصف"
              value={item.description}
              onChange={(value) => update(index, { description: value })}
              textarea
            />
            <Field
              label="إرشادات القياس"
              value={item.guidance}
              onChange={(value) => update(index, { guidance: value })}
              textarea
            />
          </article>
        ))}
      </div>
      {criteria.length > 0 && (
        <div className="save-template">
          <input
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="اسم القالب"
          />
          <button
            className="button button-secondary"
            onClick={() => void saveTemplate()}
            disabled={!templateName.trim()}
          >
            حفظ المعايير كقالب
          </button>
        </div>
      )}
    </section>
  );
}

function EvaluationStep({
  staff,
  criteria,
  scores,
  saveScore,
  bulkScores,
  completed,
  participantMap,
}: {
  staff: Staff[];
  criteria: Criterion[];
  scores: Record<string, number>;
  saveScore: (staffId: string, criterionId: string, score: number) => Promise<void>;
  bulkScores: (staffIds: string[], criterionId: string, score: number) => Promise<void>;
  completed: number;
  participantMap: Record<string, string>;
}) {
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [bulkCriterion, setBulkCriterion] = useState(criteria[0]?.id ?? "");
  const [bulkScore, setBulkScore] = useState(3);
  const keyFor = (staffId: string, criterionId: string) =>
    `${participantMap[staffId] ?? staffId}:${criterionId}`;
  const visible = staff.filter(
    (person) => !incompleteOnly || criteria.some((criterion) => !scores[keyFor(person.id, criterion.id!)]),
  );
  const expected = staff.length * criteria.length;
  return (
    <section className="wizard-panel evaluation-panel">
      <div className="wizard-panel-heading">
        <h2>التقييم القبلي</h2>
        <p>
          تم تقييم {completed.toLocaleString("ar-SA")} من {expected.toLocaleString("ar-SA")}. استخدم الأسهم أو
          Tab للتنقل السريع.
        </p>
      </div>
      <div className="evaluation-tools">
        <label>
          <input
            type="checkbox"
            checked={incompleteOnly}
            onChange={(event) => setIncompleteOnly(event.target.checked)}
          />{" "}
          غير مكتمل فقط
        </label>
        <div className="bulk-tool">
          <select value={bulkCriterion} onChange={(event) => setBulkCriterion(event.target.value)}>
            <option value="">المعيار</option>
            {criteria.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select value={bulkScore} onChange={(event) => setBulkScore(Number(event.target.value))}>
            {[1, 2, 3, 4, 5].map((value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
          <ConfirmAction
            title="تطبيق قيمة على مجموعة"
            description="سيتم تطبيق القيمة على المشاركين الظاهرين حاليًا لهذا المعيار. يمكنك تعديل أي خلية لاحقًا."
            confirmLabel="تطبيق"
            onConfirm={() =>
              bulkCriterion
                ? bulkScores(
                    visible.map((item) => item.id),
                    bulkCriterion,
                    bulkScore,
                  )
                : Promise.resolve()
            }
          >
            <button className="button button-secondary" disabled={!bulkCriterion}>
              تطبيق على الظاهرين
            </button>
          </ConfirmAction>
        </div>
      </div>
      <div className="evaluation-desktop">
        <table className="evaluation-table">
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
            {visible.map((person, personIndex) => (
              <tr data-evaluation-row={personIndex} key={person.id}>
                <th>
                  {person.fullName}
                  <small>{person.jobTitle ?? "—"}</small>
                  <small className="participant-source">
                    المصدر: {person.importSourceName ?? person.importSourceFileName ?? "استيراد نور"}
                  </small>
                </th>
                {criteria.map((criterion) => (
                  <td key={criterion.id}>
                    <RatingStepper
                      value={scores[keyFor(person.id, criterion.id!)]}
                      label={`${person.fullName} — ${criterion.name}`}
                      dataCell="evaluation"
                      onChange={(value) => void saveScore(person.id, criterion.id!, value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="evaluation-mobile">
        {visible.map((person) => (
          <article className="mobile-evaluation-card" key={person.id}>
            <strong>{person.fullName}</strong>
            <small>{person.jobTitle ?? "—"}</small>
            <small className="participant-source">
              المصدر: {person.importSourceName ?? person.importSourceFileName ?? "استيراد نور"}
            </small>
            {criteria.map((criterion) => (
              <label key={criterion.id}>
                <span>{criterion.name}</span>
                <RatingStepper
                  value={scores[keyFor(person.id, criterion.id!)]}
                  label={`${person.fullName} — ${criterion.name}`}
                  onChange={(value) => void saveScore(person.id, criterion.id!, value)}
                />
              </label>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}

function ReviewStep({
  info,
  staff,
  criteria,
  completed,
  confirmed,
  setConfirmed,
  finalize,
}: {
  info: Info;
  staff: Staff[];
  criteria: Criterion[];
  completed: number;
  confirmed: boolean;
  setConfirmed: (value: boolean) => void;
  finalize: () => Promise<void>;
}) {
  const duration =
    info.startsAt && info.endsAt
      ? Math.round((new Date(info.endsAt).getTime() - new Date(info.startsAt).getTime()) / 60000)
      : 0;
  return (
    <section className="wizard-panel">
      <div className="wizard-panel-heading">
        <h2>مراجعة واعتماد</h2>
        <p>راجع كل التفاصيل قبل قفل بيانات الورشة والتقييمات القبلية.</p>
      </div>
      <div className="review-summary">
        <div>
          <span>الورشة</span>
          <strong>{info.title || "—"}</strong>
        </div>
        <div>
          <span>الفترة</span>
          <strong>
            {info.startsAt || "—"} — {info.endsAt || "—"}
          </strong>
        </div>
        <div>
          <span>المدة</span>
          <strong>{duration ? `${Math.floor(duration / 60)} ساعة ${duration % 60} دقيقة` : "—"}</strong>
        </div>
        <div>
          <span>المشاركون</span>
          <strong>{staff.length.toLocaleString("ar-SA")}</strong>
        </div>
        <div>
          <span>المعايير</span>
          <strong>{criteria.length.toLocaleString("ar-SA")}</strong>
        </div>
        <div>
          <span>اكتمال القبلي</span>
          <strong>
            {completed.toLocaleString("ar-SA")} من {(staff.length * criteria.length).toLocaleString("ar-SA")}
          </strong>
        </div>
      </div>
      <div className="lock-warning">
        <strong>تنبيه القفل</strong>
        <p>بعد اعتماد الورشة سيتم قفل بياناتها والتقييمات القبلية ولن يمكن تعديلها.</p>
      </div>
      <label className="confirmation-check">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />{" "}
        أفهم أن اعتماد الورشة سيقفل بيانات القياس.
      </label>
      <button className="sr-only" onClick={() => void finalize()}>
        اعتماد
      </button>
    </section>
  );
}
