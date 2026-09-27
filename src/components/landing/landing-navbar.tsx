"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/src/components/brand/logo";
import { ContactDialog } from "./contact-dialog";

type LandingNavbarProps = { phone: string; whatsappNumber: string; whatsappMessage: string };
const links = [{ href: "#about", label: "عن أثر" }, { href: "#workflow", label: "كيف تعمل" }, { href: "#features", label: "المزايا" }, { href: "#pricing", label: "عرض الإطلاق" }, { href: "#faq", label: "الأسئلة الشائعة" }];

export function LandingNavbar({ phone, whatsappNumber, whatsappMessage }: LandingNavbarProps) {
  const [open, setOpen] = useState(false);
  return <header className="landing-navbar"><Logo href="/" /><nav className={`landing-nav-links ${open ? "is-open" : ""}`} aria-label="التنقل الرئيسي">{links.map((link) => <a href={link.href} key={link.href} onClick={() => setOpen(false)}>{link.label}</a>)}<div className="landing-mobile-actions"><ContactDialog phone={phone} whatsappNumber={whatsappNumber} whatsappMessage={whatsappMessage} label="تواصل معنا" /><Link className="button button-primary" href="/auth/register">ابدأ الآن</Link></div></nav><div className="landing-desktop-actions"><ContactDialog phone={phone} whatsappNumber={whatsappNumber} whatsappMessage={whatsappMessage} /><Link className="button button-primary" href="/auth/register">ابدأ الآن</Link></div><button className="landing-menu-toggle" type="button" aria-label={open ? "إغلاق القائمة" : "فتح القائمة"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? <X size={20} /> : <Menu size={20} />}</button></header>;
}
