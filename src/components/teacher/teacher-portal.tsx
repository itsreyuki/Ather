"use client";

import { ArrowLeft, LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type School = { id: string; name: string; city: string };
type TeacherLoginResponse = { error?: string; message?: string; schools?: School[]; requiresSchoolSelection?: boolean; nextPath?: string };

async function postJson(path: string, payload: Record<string, string>) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const data = await response.json() as TeacherLoginResponse;
  if (!response.ok) throw new Error(data.error ?? "تعذر تنفيذ الطلب");
  return data;
}

export function TeacherLogin() {
  const router = useRouter();
  const [stage, setStage] = useState<"lookup" | "schools">("lookup");
  const [username, setUsername] = useState("");
  const [schools, setSchools] = useState<School[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function lookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await postJson("/api/teacher/lookup", { username });
      if (data.requiresSchoolSelection && data.schools) {
        setSchools(data.schools);
        setStage("schools");
        return;
      }
      router.push(data.nextPath ?? "/teacher");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر بدء الدخول");
    } finally {
      setBusy(false);
    }
  }

  async function selectSchool(schoolId: string) {
    setBusy(true);
    setError("");
    try {
      const data = await postJson("/api/teacher/select-school", { username, schoolId });
      router.push(data.nextPath ?? "/teacher");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر اختيار المدرسة");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page"><section className="auth-card teacher-auth-card"><div className="teacher-brand"><span>أثر</span><small>ATHAR</small></div>{stage === "lookup" ? <><div className="teacher-intro"><div className="teacher-icon"><ShieldCheck size={21} /></div><div><h1>دخول المنسوبين</h1><p>أدخل اسم المستخدم المسجل به في نظام نور للوصول إلى الورش التدريبية المرتبطة بسجلك في المدرسة.</p></div></div><form className="auth-form" onSubmit={lookup}><div className="field"><label htmlFor="teacher-username">اسم المستخدم في نور</label><input id="teacher-username" value={username} onChange={(event) => setUsername(event.target.value)} inputMode="text" autoComplete="username" required placeholder="أدخل اسم المستخدم كما هو في نور" /></div>{message && <div className="form-info" role="status">{message}</div>}{error && <div className="form-error" role="alert">{error}</div>}<button className="button button-primary" type="submit" disabled={busy}>{busy ? "جارٍ الدخول..." : <>متابعة <ArrowLeft size={16} /></>}</button></form><div className="privacy-note"><LockKeyhole size={15} /><span>يُستخدم اسم المستخدم لمطابقة السجل فقط، ولا يُخزّن كنص مكشوف.</span></div></> : <><div className="teacher-intro"><div className="teacher-icon"><ShieldCheck size={21} /></div><div><h1>اختر المدرسة</h1><p>يرتبط سجلك بأكثر من مدرسة. اختر المدرسة التي تريد الدخول إليها.</p></div></div><div className="teacher-school-list">{schools.map((school) => <button className="teacher-school-option" type="button" key={school.id} onClick={() => void selectSchool(school.id)} disabled={busy}><strong>{school.name}</strong><span>{school.city}</span><ArrowLeft size={16} /></button>)}</div>{error && <div className="form-error" role="alert">{error}</div>}<button className="text-button" type="button" onClick={() => { setStage("lookup"); setError(""); }}>استخدام اسم مستخدم آخر</button></>}<p className="auth-footer"><a href="/auth/login">العودة إلى دخول المدير</a></p></section></main>;
}

export function TeacherLogoutButton() {
  const router = useRouter();
  async function logout() { await fetch("/api/teacher/logout", { method: "POST" }); router.push("/teacher"); router.refresh(); }
  return <button className="button button-ghost" type="button" onClick={logout}><LogOut size={15} /> تسجيل الخروج</button>;
}
