"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { EmptyState } from "@/src/components/ui/empty-state";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <EmptyState icon={<AlertCircle size={20} />} title="تعذر تحميل هذه الصفحة" description="حدث خطأ مؤقت. حاول تحديث الصفحة مرة أخرى." action={<button className="button button-secondary" onClick={reset}><RefreshCw size={15} /> إعادة المحاولة</button>} />;
}
