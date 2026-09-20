import Link from "next/link";
import { Logo } from "@/src/components/brand/logo";
import { AuthForm } from "@/src/components/auth/auth-forms";

export default function LoginPage() {
  return <main className="auth-page"><section className="auth-card"><Logo /><h1>مرحبًا بعودتك</h1><p>سجّل الدخول إلى مساحة مدرستك وتابع أثر التدريب.</p><AuthForm mode="login" /><div className="auth-divider"><span>أو</span></div><Link className="button button-secondary auth-alt-button" href="/teacher">دخول المنسوبين باسم المستخدم في نور</Link><p className="auth-footer">لا تملك حسابًا؟ <Link href="/auth/register">إنشاء حساب مدرسة</Link></p></section></main>;
}
