"use client";

import { ArrowRight, Mail, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ContactMode = "email" | "phone";

async function postJson(path: string, payload: Record<string, string | undefined>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error ?? "تعذر تنفيذ الطلب"), data);
  return data;
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [contactMode, setContactMode] = useState<ContactMode>("email");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const phone = String(form.get("phone") ?? "");
    const password = String(form.get("password") ?? "");

    try {
      const payload = mode === "login"
        ? { identity: contactMode === "email" ? email : phone, password }
        : {
            ...(contactMode === "email" ? { email } : { phone }),
            password,
            confirmPassword: String(form.get("confirmPassword") ?? ""),
          };
      const data = await postJson(`/api/auth/${mode}`, payload);
      router.push(data.nextPath);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تنفيذ الطلب");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <div className="contact-switch" role="tablist" aria-label={mode === "register" ? "طريقة التسجيل" : "طريقة الدخول"}>
        <button type="button" className={contactMode === "email" ? "active" : ""} onClick={() => setContactMode("email")} role="tab" aria-selected={contactMode === "email"}>
          <Mail size={15} /> بريد إلكتروني
        </button>
        <button type="button" className={contactMode === "phone" ? "active" : ""} onClick={() => setContactMode("phone")} role="tab" aria-selected={contactMode === "phone"}>
          <Smartphone size={15} /> رقم جوال
        </button>
      </div>
      {contactMode === "email" ? (
        <div className="field">
          <label htmlFor={`${mode}-email`}>البريد الإلكتروني</label>
          <input id={`${mode}-email`} name="email" type="email" autoComplete="email" required placeholder="name@school.sa" />
        </div>
      ) : (
        <div className="field">
          <label htmlFor={`${mode}-phone`}>رقم الجوال</label>
          <input id={`${mode}-phone`} name="phone" inputMode="tel" autoComplete="tel" required placeholder="05xxxxxxxx" />
        </div>
      )}
      <div className="field">
        <label htmlFor={`${mode}-password`}>كلمة المرور</label>
        <input id={`${mode}-password`} name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required placeholder="••••••••" />
      </div>
      {mode === "register" && (
        <div className="field">
          <label htmlFor="register-confirmPassword">تأكيد كلمة المرور</label>
          <input id="register-confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required placeholder="أعد كتابة كلمة المرور" />
        </div>
      )}
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="button button-primary" type="submit" disabled={busy}>
        {busy ? "جارٍ التنفيذ..." : mode === "login" ? <>دخول المدير <ArrowRight size={16} /></> : <>إنشاء الحساب <ArrowRight size={16} /></>}
      </button>
    </form>
  );
}
