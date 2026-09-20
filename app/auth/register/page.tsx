import Link from "next/link";
import { Logo } from "@/src/components/brand/logo";
import { AuthForm } from "@/src/components/auth/auth-forms";

export default function RegisterPage() {
  return <main className="auth-page"><section className="auth-card"><Logo /><h1>أنشئ مساحة مدرستك</h1><p>ابدأ بقياس أثر التدريب داخل مدرستك. الحساب الأول يصبح مالك المدرسة.</p><AuthForm mode="register" /><p className="auth-footer">لديك حساب بالفعل؟ <Link href="/auth/login">تسجيل الدخول</Link></p></section></main>;
}
