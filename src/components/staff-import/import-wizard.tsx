"use client";

import { AlertCircle, CheckCircle2, Info, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import type { StaffCorrections, StaffField, StaffMapping } from "@/src/lib/staff-import";
import { NOOR_ROSTER_TEMPLATE, type NoorTemplateCheck } from "@/src/lib/noor-template";
import { ConfirmAction } from "@/src/components/ui/confirm-action";
import { StatusBadge } from "@/src/components/ui/status-badge";

type DiffRow = { fullName: string; rowNumber: number; issues?: string[] };
type PreviewRow = {
  rowNumber: number;
  fullName: string;
  nationalIdLast4: string;
  phoneLast4: string | null;
  jobTitle: string | null;
  specialization: string | null;
  email: string | null;
  errors: string[];
  warnings: string[];
  issues: string[];
  duplicateWithinFile: boolean;
  duplicateInSchool: boolean;
  duplicatePhoneWithinFile: boolean;
  duplicatePhoneInSchool: boolean;
};
type Preview = {
  fileName: string;
  sheetName: string;
  headers: string[];
  mapping: StaffMapping;
  confidence: Partial<Record<StaffField, "high" | "medium" | "low">>;
  needsMapping: boolean;
  noorTemplate: NoorTemplateCheck;
  diff: { newCount: number; updatedCount: number; conflictCount: number };
  rows: PreviewRow[];
  issueRowsTruncated?: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  duplicatePhoneRows: number;
  missingPhoneRows: number;
  reviewRows: number;
  emptyRows: number;
  formulaRows: number;
};
type CommitResult = {
  imported: number;
  needsPhone: number;
  needsReview: number;
  created: number;
  updated: number;
  missingFromLatest: number;
  missingStaff: Array<{ id: string; fullName: string; nationalIdLast4: string | null }>;
  conflicts: DiffRow[];
  createdRows: DiffRow[];
  updatedRows: DiffRow[];
};

const fields: Array<{ key: StaffField; label: string; required?: boolean }> = [
  { key: "fullName", label: "الاسم", required: true },
  { key: "nationalId", label: "اسم المستخدم في نور", required: true },
  { key: "phone", label: "رقم الجوال" },
  { key: "jobTitle", label: "المسمى الوظيفي" },
  { key: "specialization", label: "التخصص" },
  { key: "email", label: "البريد الإلكتروني" },
  { key: "employeeNumber", label: "الرقم الوظيفي" },
];

export function StaffImportWizard({ schoolName }: { schoolName: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<StaffMapping>({});
  const [corrections, setCorrections] = useState<StaffCorrections>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [deactivatedCount, setDeactivatedCount] = useState(0);

  function choose(nextFile: File | undefined) {
    setError("");
    setPreview(null);
    setResult(null);
    setCorrections({});
    if (nextFile) setFile(nextFile);
  }

  async function previewFile(nextMapping?: StaffMapping, nextCorrections: StaffCorrections = corrections) {
    if (!file) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    if (nextMapping) form.append("mapping", JSON.stringify(nextMapping));
    if (Object.keys(nextCorrections).length) form.append("corrections", JSON.stringify(nextCorrections));
    try {
      const response = await fetch("/api/onboarding/import/preview", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذر تحليل الملف");
      setPreview(data);
      setMapping(data.mapping ?? nextMapping ?? {});
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تحليل الملف");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!file || !preview || preview.invalidRows > 0) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    form.append("mapping", JSON.stringify(mapping));
    form.append("corrections", JSON.stringify(corrections));
    try {
      const response = await fetch("/api/onboarding/import/commit", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذر اعتماد الاستيراد");
      setResult(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر اعتماد الاستيراد");
    } finally {
      setBusy(false);
    }
  }

  async function deactivateMissing() {
    if (!result?.missingStaff.length) return;
    try {
      const response = await fetch("/api/onboarding/import/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffIds: result.missingStaff.map((staff) => staff.id) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذر تعطيل السجلات");
      setDeactivatedCount(data.deactivated ?? 0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تعطيل السجلات");
    }
  }

  function updateCorrection(rowNumber: number, field: StaffField, value: string) {
    setCorrections((current) => ({
      ...current,
      [String(rowNumber)]: { ...current[String(rowNumber)], [field]: value },
    }));
  }

  if (result) return <SuccessScreen result={result} schoolName={schoolName} deactivatedCount={deactivatedCount} deactivateMissing={deactivateMissing} error={error} />;

  return <div className="staff-import-wizard">
    <div className="import-wizard-head"><div><h1>استيراد المنسوبين</h1><p>ارفع ملف PDF الرسمي المستخرج من نظام نور، راجع المطابقة، ثم اعتمد السجلات.</p></div>{file && <StatusBadge tone="neutral">{file.name}</StatusBadge>}</div>
    <div className="import-privacy-note"><Info size={15} /> القالب المعتمد هو تقرير المنسوبين الرسمي PDF من نظام نور. يسمح النظام باختلاف ترتيب الأعمدة وبعض تسمياتها، ويعرض مثال القالب إذا لم تتطابق البنية.</div>
    <label className={`upload-drop ${file ? "has-file" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); choose(event.dataTransfer.files[0]); }}><UploadCloud size={27} /><strong>{file ? "تغيير الملف" : "اسحب ملف نور هنا أو اختره"}</strong><span>PDF نصي صادر مباشرة من نور · الحد الأعلى 10MB · لا يتم الاحتفاظ بالملف الخام</span><input ref={inputRef} type="file" accept=".pdf,application/pdf" onChange={(event) => choose(event.target.files?.[0])} /></label>
    {file && !preview && <div className="import-action-row"><button className="button button-primary" onClick={() => previewFile()} disabled={busy}>{busy ? "جارٍ التحليل..." : "تحليل الملف"}</button></div>}
    {preview && !preview.noorTemplate.matches && !preview.needsMapping && <NoorTemplateMismatch check={preview.noorTemplate} />}
    {preview?.needsMapping && <MappingPanel preview={preview} mapping={mapping} setMapping={setMapping} previewFile={previewFile} busy={busy} />}
    {preview?.noorTemplate.matches && !preview.needsMapping && <PreviewPanel preview={preview} corrections={corrections} updateCorrection={updateCorrection} reanalyze={() => previewFile(mapping, corrections)} commit={commit} busy={busy} />}
    {error && <div className="form-error" role="alert">{error}</div>}
  </div>;
}

function NoorTemplateMismatch({ check }: { check: NoorTemplateCheck }) {
  return <section className="noor-template-mismatch" role="alert"><div className="mapping-heading"><div><h2>الملف لا يطابق البنية المرجعية لنور</h2><p>احصل على قائمة المنسوبين مباشرة من نظام نور ثم صدّرها بصيغة PDF كما هي. لا يمكن اعتماد هذا الملف قبل تصحيح القالب.</p></div><AlertCircle size={19} color="var(--danger)" /></div>{check.issues.map((issue) => <p className="template-issue" key={issue}>{issue}</p>)}<div className="template-example"><strong>الشكل المتوقع للملف</strong><div className="table-scroll"><table className="data-table"><thead><tr>{NOOR_ROSTER_TEMPLATE.expectedColumns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody><tr>{NOOR_ROSTER_TEMPLATE.sampleRow.map((value, index) => <td key={`${index}-${value}`}>{value}</td>)}</tr></tbody></table></div><small>المثال أعلاه توضيحي ببيانات غير حقيقية. قد يختلف ترتيب الأعمدة، لكن لا يستطيع النظام إثبات مصدر الملف من الأعمدة وحدها.</small></div></section>;
}

function MappingPanel({ preview, mapping, setMapping, previewFile, busy }: { preview: Preview; mapping: StaffMapping; setMapping: (value: StaffMapping | ((current: StaffMapping) => StaffMapping)) => void; previewFile: (mapping: StaffMapping) => Promise<void>; busy: boolean }) {
  return <section className="mapping-panel"><div className="mapping-heading"><div><h2>راجع مطابقة الأعمدة</h2><p>بعض الأعمدة لم تطابق حقول النظام بدرجة كافية. اختر الحقل المناسب لكل عمود.</p></div><Info size={18} color="var(--blue)" /></div><div className="mapping-grid">{fields.map((field) => <label className="mapping-row" key={field.key}><span>{field.label}{field.required && <em>مطلوب</em>}</span><select value={mapping[field.key] ?? ""} onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value || undefined }))}><option value="">غير موجود</option>{preview.headers.map((header) => <option key={`${field.key}-${header}`} value={header}>{header}</option>)}</select></label>)}</div><button className="button button-secondary" onClick={() => previewFile(mapping)} disabled={busy}>{busy ? "جارٍ إعادة التحليل..." : "تطبيق المطابقة وإعادة التحليل"}</button></section>;
}

function PreviewPanel({ preview, corrections, updateCorrection, reanalyze, commit, busy }: { preview: Preview; corrections: StaffCorrections; updateCorrection: (rowNumber: number, field: StaffField, value: string) => void; reanalyze: () => Promise<void>; commit: () => Promise<void>; busy: boolean }) {
  const hasErrors = preview.invalidRows > 0;
  return <>
    <section className="import-summary"><SummaryItem label="عدد الصفوف" value={preview.totalRows} /><SummaryItem label="سجلات سليمة" value={preview.validRows} tone="success" /><SummaryItem label="مكررة" value={preview.duplicateRows} tone={preview.duplicateRows ? "warning" : "neutral"} /><SummaryItem label="ناقصة / تحتاج مراجعة" value={preview.missingPhoneRows + preview.invalidRows} tone={preview.invalidRows ? "error" : "warning"} /><SummaryItem label="غير صالحة" value={preview.invalidRows} tone={preview.invalidRows ? "error" : "neutral"} /></section>
    {hasErrors && <div className="import-correction-required" role="alert"><AlertCircle size={17} /><div><strong>لا يمكن الحفظ بعد</strong><p>توجد {preview.invalidRows.toLocaleString("ar-SA")} سجلات غير سليمة. افتح سبب الخلل في الجدول، صحح البيانات، ثم اضغط «إعادة التحقق». سيصبح الحفظ متاحًا بعد وصول عدد السجلات غير الصالحة إلى صفر.</p></div></div>}
    <section className="import-diff import-diff-preview"><h2>فرق الملف الحالي</h2><div className="diff-counts"><DiffCount label="جديد" value={preview.diff.newCount} tone="success" /><DiffCount label="محدّث" value={preview.diff.updatedCount} tone="info" /><DiffCount label="متعارض / يحتاج مراجعة" value={preview.diff.conflictCount} tone="warning" /></div></section>
    <div className="import-meta">ورقة البيانات: <strong>{preview.sheetName}</strong> · الصفوف التي تحتوي معادلات: {preview.formulaRows} · الصفوف الفارغة المستبعدة: {preview.emptyRows}{preview.issueRowsTruncated ? " · يتم عرض أول ٢٠٠ صف يحتاج تصحيحًا" : ""}</div>
    <div className="table-scroll import-preview-table"><table className="data-table"><thead><tr><th>الصف</th><th>الاسم</th><th>اسم المستخدم في نور</th><th>الجوال</th><th>المسمى</th><th>الحالة والسبب</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.fullName || "—"}</td><td>•••• {row.nationalIdLast4 || "—"}</td><td>{row.phoneLast4 ? `•••• ${row.phoneLast4}` : "غير متوفر"}</td><td>{row.jobTitle || "—"}</td><td><RowIssueDetails row={row} correction={corrections[String(row.rowNumber)] ?? {}} updateCorrection={updateCorrection} reanalyze={reanalyze} busy={busy} /></td></tr>)}</tbody></table></div>
    <div className="import-privacy-note"><AlertCircle size={15} /> لن يتم عرض المعرّف كاملًا، ولن يتم الاحتفاظ بملف PDF الخام بعد انتهاء المعالجة. التعديلات هنا تستخدم لإعادة تحليل الصف ثم تُحفظ القيم المصححة فقط.</div>
    <div className="form-actions"><button className="button button-primary" onClick={commit} disabled={busy || hasErrors || !preview.validRows}>{busy ? "جارٍ الاعتماد..." : "اعتماد الاستيراد وتفعيل لوحة المؤشرات"}</button></div>
  </>;
}

function RowIssueDetails({ row, correction, updateCorrection, reanalyze, busy }: { row: PreviewRow; correction: StaffCorrections[string]; updateCorrection: (rowNumber: number, field: StaffField, value: string) => void; reanalyze: () => Promise<void>; busy: boolean }) {
  const hasIssues = row.issues.length > 0 || row.duplicateInSchool;
  if (!hasIssues) return <StatusBadge tone="success">سليم</StatusBadge>;
  const valueFor = (field: StaffField, fallback: string) => typeof correction[field] === "string" ? correction[field] as string : fallback;
  return <details className="import-row-issues"><summary><StatusBadge tone={row.errors.length ? "error" : "warning"}>{row.errors.length ? "غير سليم" : "مراجعة"}</StatusBadge><span>عرض السبب والتصحيح</span></summary><div className="import-row-issue-body"><ul>{row.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul><div className="import-correction-grid"><label><span>الاسم</span><input value={valueFor("fullName", row.fullName)} onChange={(event) => updateCorrection(row.rowNumber, "fullName", event.target.value)} /></label><label><span>اسم المستخدم الصحيح في نور</span><input inputMode="text" placeholder="أدخله كما هو في نور" value={valueFor("nationalId", "")} onChange={(event) => updateCorrection(row.rowNumber, "nationalId", event.target.value)} /></label><label><span>رقم الجوال الصحيح</span><input inputMode="tel" placeholder="05xxxxxxxx" value={valueFor("phone", "")} onChange={(event) => updateCorrection(row.rowNumber, "phone", event.target.value)} /></label><label><span>البريد الإلكتروني</span><input type="email" value={valueFor("email", row.email ?? "")} onChange={(event) => updateCorrection(row.rowNumber, "email", event.target.value)} /></label></div><button className="button button-secondary" onClick={() => void reanalyze()} disabled={busy}>{busy ? "جارٍ التحقق..." : "إعادة التحقق من هذا التصحيح"}</button></div></details>;
}

function SuccessScreen({ result, schoolName, deactivatedCount, deactivateMissing, error }: { result: CommitResult; schoolName: string; deactivatedCount: number; deactivateMissing: () => Promise<void>; error: string }) {
  return <div className="import-success"><div className="success-icon"><CheckCircle2 size={28} /></div><h1>تم استيراد {result.imported.toLocaleString("ar-SA")} من المنسوبين</h1><p>تم تجهيز {schoolName}. يوجد {result.needsPhone.toLocaleString("ar-SA")} يحتاجون رقم جوال و{result.needsReview.toLocaleString("ar-SA")} سجلات تحتاج مراجعة.</p><div className="success-grid"><div><strong>{result.imported}</strong><span>تم استيرادهم</span></div><div><strong>{result.needsPhone}</strong><span>يحتاجون رقم جوال</span></div><div><strong>{result.needsReview}</strong><span>سجلات تحتاج مراجعة</span></div></div><section className="import-diff"><h2>فرق إعادة الاستيراد</h2><div className="diff-counts"><DiffCount label="جديد" value={result.created} tone="success" /><DiffCount label="محدّث" value={result.updated} tone="info" /><DiffCount label="لم يعد موجودًا" value={result.missingStaff.length} tone="warning" /><DiffCount label="متعارض" value={result.conflicts.length} tone="error" /></div>{result.createdRows.length > 0 && <DiffList title="سجلات جديدة" rows={result.createdRows} />}{result.updatedRows.length > 0 && <DiffList title="سجلات محدّثة" rows={result.updatedRows} />}{result.conflicts.length > 0 && <DiffList title="سجلات متعارضة تحتاج مراجعة" rows={result.conflicts} />}{result.missingStaff.length > 0 && <><p>لم يتم حذف المنسوبين غير الموجودين أو تعطيلهم تلقائيًا.</p><div className="import-diff-list">{result.missingStaff.map((staff) => <div className="import-diff-row" key={staff.id}><span>{staff.fullName}</span><small>هوية تنتهي بـ {staff.nationalIdLast4 ?? "—"}</small></div>)}</div>{deactivatedCount > 0 ? <StatusBadge tone="success">تم تعطيل {deactivatedCount.toLocaleString("ar-SA")} سجلًا</StatusBadge> : <ConfirmAction label="تعطيل المنسوبين غير الموجودين" title="تعطيل المنسوبين غير الموجودين؟" description="سيتم إبقاؤهم في السجل التاريخي مع تحويل حالتهم إلى غير نشط. لن تُحذف مشاركاتهم أو بياناتهم السابقة." confirmLabel="تعطيل المحددين" onConfirm={deactivateMissing}><button className="button button-danger">تعطيل المنسوبين غير الموجودين</button></ConfirmAction>}</>}</section>{error && <div className="form-error" role="alert">{error}</div>}<div className="form-actions"><Link className="button button-primary" href="/dashboard">الانتقال إلى لوحة المؤشرات</Link><Link className="button button-secondary" href="/dashboard/staff">عرض المنسوبين</Link></div></div>;
}

function DiffCount({ label, value, tone }: { label: string; value: number; tone: "success" | "info" | "warning" | "error" }) { return <div className={`diff-count ${tone}`}><strong>{value.toLocaleString("ar-SA")}</strong><span>{label}</span></div>; }
function DiffList({ title, rows }: { title: string; rows: DiffRow[] }) { return <details className="diff-details"><summary>{title} ({rows.length.toLocaleString("ar-SA")})</summary><div className="import-diff-list">{rows.slice(0, 50).map((row) => <div className="import-diff-row" key={`${row.rowNumber}-${row.fullName}`}><span>{row.fullName}</span><small>صف {row.rowNumber.toLocaleString("ar-SA")}{row.issues?.length ? ` · ${row.issues.join("، ")}` : ""}</small></div>)}</div></details>; }
function SummaryItem({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "success" | "warning" | "error" | "neutral" }) { return <div className={`import-summary-item ${tone}`}><strong>{value.toLocaleString("ar-SA")}</strong><span>{label}</span></div>; }
