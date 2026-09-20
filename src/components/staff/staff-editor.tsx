"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmAction } from "@/src/components/ui/confirm-action";

type Props = { staffId: string; initial: { email: string | null; jobTitle: string | null; specialization: string | null; manualOverrideFields: string[]; phoneLast4: string | null } };

export function StaffEditor({ staffId, initial }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(initial.email ?? "");
  const [jobTitle, setJobTitle] = useState(initial.jobTitle ?? "");
  const [specialization, setSpecialization] = useState(initial.specialization ?? "");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const manuallyUpdated = (field: string) => initial.manualOverrideFields.includes(field);

  async function save() {
    setBusy(true); setError(""); setMessage("");
    const body: Record<string, string> = {};
    if (email !== (initial.email ?? "")) body.email = email;
    if (jobTitle !== (initial.jobTitle ?? "")) body.jobTitle = jobTitle;
    if (specialization !== (initial.specialization ?? "")) body.specialization = specialization;
    if (phone) body.phone = phone;
    if (!Object.keys(body).length) { setMessage("لا توجد تغييرات جديدة"); setBusy(false); return; }
    try {
      const response = await fetch(`/api/dashboard/staff/${staffId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذر حفظ التعديل");
      setPhone(""); setMessage("تم حفظ التعديل وتسجيله في سجل التدقيق"); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "تعذر حفظ التعديل"); }
    finally { setBusy(false); }
  }

  async function correctIdentity() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/dashboard/staff/${staffId}/identity`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nationalId, confirmation: "تغيير اسم المستخدم" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذر تصحيح اسم المستخدم");
      setNationalId(""); setMessage(`تم تصحيح اسم المستخدم، وآخر أربعة أحرف/أرقام الآن ${data.nationalIdLast4}`); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "تعذر تصحيح اسم المستخدم"); }
    finally { setBusy(false); }
  }

  return <div className="staff-editor"><div className="editor-grid">
    <label className="field"><span>الهاتف <small>{initial.phoneLast4 ? `الحالي: •••• ${initial.phoneLast4}` : "غير متوفر"}</small></span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="أدخل رقمًا جديدًا للتحديث" inputMode="tel" />{manuallyUpdated("phone") && <em className="manual-note">Manually Updated</em>}</label>
    <label className="field"><span>البريد الإلكتروني</span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />{manuallyUpdated("email") && <em className="manual-note">Manually Updated</em>}</label>
    <label className="field"><span>المسمى الوظيفي</span><input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />{manuallyUpdated("jobTitle") && <em className="manual-note">Manually Updated</em>}</label>
    <label className="field"><span>التخصص</span><input value={specialization} onChange={(event) => setSpecialization(event.target.value)} />{manuallyUpdated("specialization") && <em className="manual-note">Manually Updated</em>}</label>
  </div><div className="form-actions"><button className="button button-primary" onClick={save} disabled={busy}><Save size={15} /> حفظ التصحيحات</button></div>
    <div className="identity-correction"><div><strong>تصحيح اسم المستخدم في نور</strong><p>هذا الإجراء منفصل عن التصحيحات العادية، ويؤثر على مطابقة إعادة الاستيراد.</p></div><input value={nationalId} onChange={(event) => setNationalId(event.target.value)} placeholder="اسم المستخدم الجديد في نور" inputMode="text" /><ConfirmAction label="تصحيح اسم المستخدم" title="تأكيد تصحيح اسم المستخدم" description="سيتم تغيير مفتاح مطابقة هذا المنسوب في المدرسة وتسجيل العملية. اكتب اسم المستخدم الجديد كما هو في نور ثم أكد الإجراء." confirmLabel="تأكيد التصحيح" onConfirm={correctIdentity}><button className="button button-danger" disabled={!nationalId || busy}>تصحيح اسم المستخدم</button></ConfirmAction></div>
    {message && <div className="form-success" role="status">{message}</div>}{error && <div className="form-error" role="alert">{error}</div>}
  </div>;
}
