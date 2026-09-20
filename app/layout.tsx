import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/src/components/theme/theme-provider";
import { ThemeSwitcher } from "@/src/components/theme/theme-switcher";

export const metadata: Metadata = {
  title: "أثر | قياس الأثر التدريبي",
  description: "منصة عربية لقياس أثر الورش والبرامج التدريبية على منسوبي المدارس.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('athar-theme');if(['dark','light','official','pink'].includes(t))document.documentElement.dataset.theme=t}catch(e){}" }} /></head><body><ThemeProvider><ThemeSwitcher />{children}</ThemeProvider></body></html>;
}
