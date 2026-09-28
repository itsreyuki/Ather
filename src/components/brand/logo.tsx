import Image from "next/image";
import Link from "next/link";
import logoImage from "@/src/assets/logo.png";

export function Logo({ href = "/", className = "" }: { href?: string; className?: string }) {
  return <Link className={`logo ${className}`.trim()} href={href} aria-label="أثر - الصفحة الرئيسية"><span className="logo-symbol"><Image className="logo-image" src={logoImage} alt="" width={36} height={36} priority={href === "/"} /></span><span className="logo-copy"><strong>أثر</strong><small>ATHAR</small></span></Link>;
}
