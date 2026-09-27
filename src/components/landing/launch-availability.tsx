import { Check, Sparkles } from "lucide-react";

type LaunchAvailabilityProps = {
  totalSlots: number;
  availableSlots: number;
  price: number;
  compact?: boolean;
};

export function LaunchAvailability({ totalSlots, availableSlots, price, compact = false }: LaunchAvailabilityProps) {
  const safeTotal = Math.max(1, Math.floor(totalSlots));
  const safeAvailable = Math.min(safeTotal, Math.max(0, Math.floor(availableSlots)));
  const claimed = safeTotal - safeAvailable;
  const soldOut = safeAvailable === 0;

  return <section className={`launch-availability ${compact ? "is-compact" : ""} ${soldOut ? "is-sold-out" : ""}`} aria-label="توفر عرض الإطلاق">
    <div className="launch-availability-heading"><span className="launch-icon" aria-hidden="true"><Sparkles size={16} /></span><div><span className="launch-kicker">عرض الإطلاق</span><h2>{soldOut ? "اكتمل العدد المتاح" : "الوصول المبكر لمنصة أثر"}</h2></div></div>
    <div className="launch-price"><strong>{new Intl.NumberFormat("ar-SA").format(price)} ر.س</strong><span>دفع لمرة واحدة · وصول مدى الحياة</span></div>
    <div className="launch-progress" aria-label={`المتاح ${safeAvailable} من ${safeTotal}`}><div className="launch-progress-bar"><span style={{ width: `${(claimed / safeTotal) * 100}%` }} /></div><div className="launch-slots" aria-hidden="true">{Array.from({ length: safeTotal }, (_, index) => <span className={index < claimed ? "claimed" : "available"} key={index} />)}</div><div className="launch-availability-count"><strong key={safeAvailable} className="launch-number-pop">{safeAvailable}</strong><span>من {safeTotal} مقاعد متبقية</span></div></div>
    <p className="launch-note"><Check size={15} /> يتغير السعر لاحقًا، ويحتفظ المشتركون الأوائل بعرض الإطلاق.</p>
  </section>;
}
