import Link from "next/link";
import { Logo } from "@/src/components/brand/logo";

export default function TermsPage() { return <main className="legal-page"><Logo /><article className="legal-content"><Link className="text-link" href="/">← العودة للرئيسية</Link><h1>الشروط والأحكام</h1><p>باستخدام أثر، تقر المدرسة بصحة البيانات التي تدخلها وباستخدام المؤشرات كأدوات قياس داخلية مساعدة على القرار.</p><h2>طبيعة المؤشرات</h2><p>لا تدعي المنصة إثبات أثر سببي علمي؛ التقارير تصف مؤشرات التغير بين القياس القبلي والبعدي وتقييمات المتدربين.</p><h2>مسؤولية الحساب</h2><p>تلتزم المدرسة بحماية بيانات الدخول، وتبقى جميع عمليات الاعتماد النهائية ضمن مسؤولية المستخدم المخول.</p></article></main>; }
