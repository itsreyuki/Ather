"use client";

import { ArrowLeft, MessageCircle } from "lucide-react";
import Link from "next/link";
import { ContactDialog } from "./contact-dialog";

type StickyCtaProps = { phone: string; whatsappNumber: string; whatsappMessage: string };
export function StickyCta({ phone, whatsappNumber, whatsappMessage }: StickyCtaProps) {
  return <div className="landing-sticky-cta"><span><strong>عرض الإطلاق</strong><small>10 مقاعد فقط · 250 ر.س</small></span><div><ContactDialog phone={phone} whatsappNumber={whatsappNumber} whatsappMessage={whatsappMessage} label="تواصل" className="landing-sticky-contact" /><Link className="button button-primary" href="/auth/register">ابدأ الآن <ArrowLeft size={15} /></Link></div><MessageCircle className="landing-sticky-decoration" size={16} aria-hidden="true" /></div>;
}
