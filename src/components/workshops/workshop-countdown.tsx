"use client";

import { useEffect, useState } from "react";

function formatRemaining(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days.toLocaleString("ar-SA")} يوم ${hours.toLocaleString("ar-SA")} ساعة`;
  if (hours) return `${hours.toLocaleString("ar-SA")} ساعة ${minutes.toLocaleString("ar-SA")} دقيقة`;
  return `${minutes.toLocaleString("ar-SA")} دقيقة`;
}

export function WorkshopCountdown({ mode, targetAt, serverNow }: { mode: "SCHEDULED" | "IN_PROGRESS" | "POST_ASSESSMENT_AVAILABLE" | "COMPLETED" | "CANCELLED" | "DRAFT"; targetAt: string | null; serverNow: string }) {
  const [remaining, setRemaining] = useState(() => targetAt ? new Date(targetAt).getTime() - new Date(serverNow).getTime() : 0);
  useEffect(() => { if (!targetAt) return; const offset = new Date(serverNow).getTime() - Date.now(); const timer = window.setInterval(() => setRemaining(new Date(targetAt).getTime() - (Date.now() + offset)), 1000); return () => window.clearInterval(timer); }, [serverNow, targetAt]);
  if (mode === "POST_ASSESSMENT_AVAILABLE") return <div className="workshop-countdown ready"><span>الحالة الزمنية</span><strong>التقييم البعدي جاهز</strong><small>تم الاعتماد على وقت الخادم في تحديد الحالة.</small></div>;
  if (mode === "COMPLETED") return <div className="workshop-countdown complete"><span>الحالة الزمنية</span><strong>اكتملت الورشة</strong></div>;
  if (mode === "CANCELLED") return <div className="workshop-countdown"><span>الحالة الزمنية</span><strong>الورشة ملغاة</strong></div>;
  if (!targetAt) return null;
  return <div className={`workshop-countdown ${remaining <= 0 ? "expired" : ""}`}><span>{mode === "SCHEDULED" ? "تبدأ الورشة خلال" : "تنتهي الورشة خلال"}</span><strong>{remaining > 0 ? formatRemaining(remaining) : "انتهى الوقت — حدّث الصفحة"}</strong><small>عداد العرض فقط؛ الحالة الرسمية محسوبة على الخادم.</small></div>;
}
