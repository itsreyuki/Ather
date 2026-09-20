import Link from "next/link";
import { ArrowLeft, BarChart3, CheckCircle2, ShieldCheck } from "lucide-react";
import { Logo } from "@/src/components/brand/logo";

export default function HomePage() {
  return <main className="public-page">
    <nav className="public-nav" aria-label="التنقل الرئيسي">
      <Logo href="/" />
      <div className="public-nav-actions"><Link className="text-link" href="/auth/login">تسجيل الدخول</Link><Link className="button button-primary" href="/auth/register">ابدأ الآن <ArrowLeft size={16} /></Link></div>
    </nav>
    <section className="hero-section">
      <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot" /> منصة قياس الأثر التدريبي للمدارس</div><h1>من البيانات<br /><span>إلى القرار.</span></h1><p>أثر يساعدك على فهم ما يتغير بعد كل ورشة وبرنامج تدريبي، ببيانات واضحة وقرارات أكثر دقة.</p><div className="hero-actions"><Link className="button button-primary button-large" href="/auth/login">دخول مدير المدرسة <ArrowLeft size={17} /></Link><Link className="button button-secondary button-large" href="/teacher">دخول المعلمين</Link></div><div className="hero-trust"><CheckCircle2 size={16} /> مؤشرات داخلية قابلة للتفسير <ShieldCheck size={16} /> حماية بيانات متعددة المستأجرين</div></div>
      <div className="hero-card" aria-label="معاينة لمؤشر الأثر"><div className="hero-card-top"><div><span className="card-kicker">نظرة عامة</span><h2>الأثر التدريبي</h2></div><BarChart3 size={19} color="var(--blue)" /></div><div className="hero-score">—<small>بانتظار أول تقرير</small></div><div className="hero-card-line"><span /> <span /> <span /> <span /> <span /> <span /> <span /></div><div className="hero-card-footer"><span>القياس القبلي / البعدي</span><span className="muted">بيانات موثقة</span></div></div>
    </section>
    <section className="public-bottom"><span>أثر · قياس أبسط، قرار أوضح</span><span>نسخة تأسيسية قابلة للتوسع</span></section>
  </main>;
}
