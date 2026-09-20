import Link from "next/link";
import { SearchX } from "lucide-react";
import { Logo } from "@/src/components/brand/logo";

export default function NotFound() { return <main className="auth-page"><div className="state-card"><Logo /><div className="state-icon"><SearchX size={20} /></div><h1>الصفحة غير موجودة</h1><p>يبدو أن الرابط الذي فتحته غير متاح.</p><Link className="button button-primary" href="/">العودة للرئيسية</Link></div></main>; }
