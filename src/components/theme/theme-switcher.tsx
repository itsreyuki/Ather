"use client";

import { themeOptions, useTheme } from "./theme-provider";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return <div className="theme-switcher" role="group" aria-label="تبديل الثيم">
    <span className="theme-switcher-label">المظهر</span>
    <div className="theme-switcher-options">
      {themeOptions.map((option) => <button className={`theme-option theme-option-${option.id} ${theme === option.id ? "active" : ""}`} key={option.id} type="button" aria-label={`استخدام الثيم ${option.label}`} aria-pressed={theme === option.id} title={option.label} onClick={() => setTheme(option.id)}><span aria-hidden="true">{option.icon}</span><b>{option.shortLabel}</b></button>)}
    </div>
  </div>;
}
