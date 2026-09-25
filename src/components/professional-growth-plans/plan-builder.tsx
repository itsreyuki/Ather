"use client";

import { Download, FileUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Staff = { id: string; fullName: string; jobTitle: string | null };
type ProgramType =
  | "TECHNICAL"
  | "TECHNICAL_EDUCATIONAL"
  | "PROFESSIONAL"
  | "PROFESSIONAL_EDUCATIONAL"
  | "EDUCATIONAL"
  | "EDUCATIONAL_EDUCATIONAL";
type Program = {
  key: string;
  title: string;
  programType: ProgramType | "";
  facilitatorStaffId: string;
  participantIds: string[];
  sourceName?: string;
  matchState?: "MATCHED" | "MISSING" | "AMBIGUOUS";
  resolvedFromImport?: boolean;
};

const types: Array<[ProgramType, string]> = [
  ["TECHNICAL", "تقني"],
  ["TECHNICAL_EDUCATIONAL", "تقني تعليمي"],
  ["PROFESSIONAL", "مهني"],
  ["PROFESSIONAL_EDUCATIONAL", "مهني تعليمي"],
  ["EDUCATIONAL", "تربوي"],
  ["EDUCATIONAL_EDUCATIONAL", "تربوي تعليمي"],
];
const blank = (): Program => ({
  key: crypto.randomUUID(),
  title: "",
  programType: "",
  facilitatorStaffId: "",
  participantIds: [],
});

export function ProfessionalGrowthPlanBuilder({ staff }: { staff: Staff[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [programs, setPrograms] = useState<Program[]>([blank()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const update = (key: string, patch: Partial<Program>) =>
    setPrograms((items) => items.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  async function importWorkbook(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData();
    form.set("file", file);
    try {
      const response = await fetch("/api/dashboard/professional-growth-plans/import-preview", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذر تحليل النموذج.");
      setPrograms(
        data.programs.map(
          (item: {
            rowNumber: number;
            title: string;
            programType: ProgramType;
            facilitatorName: string;
            match: { state: Program["matchState"]; staffId: string | null };
          }) => ({
            key: crypto.randomUUID(),
            title: item.title,
            programType: item.programType,
            facilitatorStaffId: item.match.staffId ?? "",
            participantIds: [],
            sourceName: item.facilitatorName,
            matchState: item.match.state,
            resolvedFromImport: item.match.state !== "MATCHED",
          }),
        ),
      );
      setNotice("تم تحليل النموذج. أكمل المشاركين وحل أي منفذ يحتاج تحديدًا قبل الاعتماد.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تحليل النموذج.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function submit() {
    setError("");
    if (!title.trim() || !periodLabel.trim()) return setError("اسم الخطة والفترة الدراسية مطلوبان.");
    if (!programs.length) return setError("أضف برنامجًا واحدًا على الأقل.");
    if (
      programs.some(
        (item) =>
          !item.title.trim() || !item.programType || !item.facilitatorStaffId || !item.participantIds.length,
      )
    )
      return setError("أكمل اسم ونوع ومنفذ ومشاركي كل برنامج قبل الاعتماد.");
    setBusy(true);
    try {
      const response = await fetch("/api/dashboard/professional-growth-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, periodLabel, programs }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذر اعتماد الخطة.");
      router.push(data.nextPath);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر اعتماد الخطة.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="wizard-panel professional-plan-builder">
      <div className="wizard-panel-heading">
        <h2>بيانات الخطة والبرامج</h2>
        <p>
          أضف البرامج يدويًا أو ارفع نموذج Excel، ثم اعتمد الخطة لتصبح برامجها مسودات قياس جاهزة للاستكمال.
        </p>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>اسم الخطة</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="خطة النمو المهني"
          />
        </label>
        <label className="field">
          <span>الفترة الدراسية</span>
          <input
            value={periodLabel}
            onChange={(event) => setPeriodLabel(event.target.value)}
            placeholder="1447–1448 هـ"
          />
        </label>
      </div>
      <div className="plan-import-actions">
        <a className="button button-secondary" href="/api/dashboard/professional-growth-plans/template">
          <Download size={15} /> تحميل نموذج Excel فارغ
        </a>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          <FileUp size={15} /> رفع النموذج بعد التعبئة
        </button>
        <input
          ref={input}
          hidden
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => void importWorkbook(event.target.files?.[0])}
        />
      </div>
      {notice && (
        <p className="form-info" role="status">
          {notice}
        </p>
      )}
      <div className="plan-program-list">
        {programs.map((program, index) => (
          <article className="plan-program-row" key={program.key}>
            <div className="plan-program-heading">
              <strong>البرنامج {index + 1}</strong>
              {program.sourceName && <small>المنفذ في الملف: {program.sourceName}</small>}
              <button
                type="button"
                className="icon-button"
                aria-label="حذف البرنامج"
                onClick={() => setPrograms((items) => items.filter((item) => item.key !== program.key))}
                disabled={programs.length === 1}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>اسم البرنامج</span>
                <input
                  value={program.title}
                  onChange={(event) => update(program.key, { title: event.target.value })}
                />
              </label>
              <label className="field">
                <span>نوع البرنامج</span>
                <select
                  value={program.programType}
                  onChange={(event) =>
                    update(program.key, { programType: event.target.value as ProgramType })
                  }
                >
                  <option value="">اختر النوع</option>
                  {types.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>
                  المنفذ{" "}
                  {program.matchState === "AMBIGUOUS"
                    ? "— توجد أسماء متشابهة"
                    : program.matchState === "MISSING"
                      ? "— لم تتم مطابقته"
                      : ""}
                </span>
                <select
                  value={program.facilitatorStaffId}
                  onChange={(event) =>
                    update(program.key, { facilitatorStaffId: event.target.value, matchState: "MATCHED" })
                  }
                >
                  <option value="">حدد المنفذ</option>
                  {staff.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.fullName}
                      {item.jobTitle ? ` — ${item.jobTitle}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>المشاركون</span>
                <select
                  multiple
                  value={program.participantIds}
                  onChange={(event) =>
                    update(program.key, {
                      participantIds: Array.from(event.target.selectedOptions, (option) => option.value),
                    })
                  }
                >
                  {staff.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.fullName}
                    </option>
                  ))}
                </select>
                <small>استخدم Ctrl أو ⌘ لاختيار أكثر من منسوب.</small>
              </label>
            </div>
          </article>
        ))}
      </div>
      <div className="wizard-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={() => setPrograms((items) => [...items, blank()])}
        >
          <Plus size={15} /> إضافة برنامج
        </button>
        <button type="button" className="button button-primary" disabled={busy} onClick={() => void submit()}>
          {busy ? "جارٍ الحفظ..." : "اعتماد خطة النمو المهني"}
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
