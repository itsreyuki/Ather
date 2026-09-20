"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { EmptyState } from "@/src/components/ui/empty-state";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <main className="auth-page"><EmptyState icon={<AlertCircle size={20} />} title="حدث خطأ غير متوقع" description="تعذر إكمال الطلب. حاول مرة أخرى." action={<button className="button button-secondary" onClick={reset}><RefreshCw size={15} /> إعادة المحاولة</button>} /></main>; }
