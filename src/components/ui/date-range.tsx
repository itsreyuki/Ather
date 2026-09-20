import { CalendarDays } from "lucide-react";

export function DateRange() {
  return <label className="date-range"><CalendarDays size={16} aria-hidden="true" /><span className="sr-only">الفترة الزمنية</span><select defaultValue="all" aria-label="الفترة الزمنية"><option value="all">كل الفترات</option><option value="month">هذا الشهر</option><option value="quarter">هذا الربع</option><option value="year">هذا العام</option></select></label>;
}
