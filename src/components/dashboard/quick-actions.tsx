"use client";

import { BookOpen, ChevronDown, ClipboardCheck, FileUp, Plus, BarChart3 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function QuickActions() {
  const [open, setOpen] = useState(false);
  return <div className="quick-actions"><button className="button button-primary quick-actions-trigger" type="button" onClick={() => setOpen((value) => !value)}><Plus size={15} /> إجراء سريع <ChevronDown size={13} /></button>{open && <><button className="quick-actions-scrim" aria-label="إغلاق الإجراءات السريعة" onClick={() => setOpen(false)} /><div className="quick-actions-menu"><strong>إجراءات سريعة</strong><Link href="/dashboard/workshops/new" onClick={() => setOpen(false)}><BookOpen size={15} /> قياس ورشة جديدة</Link><Link href="/dashboard/staff/import" onClick={() => setOpen(false)}><FileUp size={15} /> استيراد / تحديث نور</Link><Link href="/dashboard/workshops?status=POST_ASSESSMENT_AVAILABLE" onClick={() => setOpen(false)}><ClipboardCheck size={15} /> فتح التقييمات البعدية المنتظرة</Link><Link href="/dashboard/reports" onClick={() => setOpen(false)}><BarChart3 size={15} /> التقارير</Link></div></>}</div>;
}
