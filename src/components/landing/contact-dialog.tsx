"use client";

import { Check, Clipboard, MessageCircle, Phone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getWhatsAppUrl, LANDING_CONFIG } from "@/src/config/landing";
import { LaunchAvailability } from "./launch-availability";

type ContactDialogProps = { phone: string; whatsappNumber: string; whatsappMessage: string; label?: string; className?: string };

export function ContactDialog({ phone, whatsappNumber, whatsappMessage, label = "تواصل معنا", className = "" }: ContactDialogProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [availability, setAvailability] = useState({ totalSlots: LANDING_CONFIG.totalSlots, availableSlots: LANDING_CONFIG.availableSlots, launchPrice: LANDING_CONFIG.launchPrice });
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const whatsappUrl = getWhatsAppUrl(whatsappNumber, whatsappMessage);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow; previousFocus.current?.focus(); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetch("/api/public/launch-availability", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<typeof availability> : null).then((data) => { if (data && !cancelled) setAvailability(data); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [open]);

  async function copyPhone() {
    if (!phone) return;
    try { await navigator.clipboard.writeText(phone); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); }
  }

  return <><button type="button" className={`landing-contact-trigger ${className}`} onClick={() => setOpen(true)}>{label}</button>{open && <div className="landing-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section className="landing-contact-dialog" role="dialog" aria-modal="true" aria-labelledby="landing-contact-title"><button ref={closeRef} type="button" className="landing-dialog-close" aria-label="إغلاق نافذة التواصل" onClick={() => setOpen(false)}><X size={19} /></button><span className="landing-dialog-icon" aria-hidden="true"><MessageCircle size={21} /></span><h2 id="landing-contact-title">تواصل مع فريق أثر</h2><p>نساعدك على التعرف إلى المنصة وبدء قياس الأثر في مدرستك.</p><div className="landing-contact-offer"><LaunchAvailability totalSlots={availability.totalSlots} availableSlots={availability.availableSlots} price={availability.launchPrice} compact /></div>{phone ? <div className="landing-contact-detail"><Phone size={17} /><a href={`tel:${phone}`}>{phone}</a><button type="button" className="landing-copy-button" aria-label="نسخ رقم التواصل" onClick={copyPhone}>{copied ? <Check size={15} /> : <Clipboard size={15} />}</button></div> : <div className="landing-contact-unconfigured">لم تُضبط قناة التواصل بعد. يُرجى ضبط الهاتف أو واتساب للحصول على كود الرخصة.</div>}<div className="landing-dialog-actions">{phone && <a className="button button-secondary" href={`tel:${phone}`}><Phone size={16} /> اتصال</a>}{whatsappUrl ? <a className="button button-primary" href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={16} /> واتساب</a> : <span className="landing-provider-note">قناة واتساب غير مفعلة حاليًا</span>}</div></section></div>}</>;
}
