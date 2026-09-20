import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return <Link className="logo" href={href} aria-label="أثر - الصفحة الرئيسية"><span className="logo-symbol">أ</span><span className="logo-copy"><strong>أثر</strong><small>ATHAR</small></span></Link>;
}
