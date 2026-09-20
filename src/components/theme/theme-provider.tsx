"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";

export const themeOptions = [
  { id: "dark", label: "الداكن", shortLabel: "داكن", icon: "◐" },
  { id: "light", label: "الفاتح", shortLabel: "فاتح", icon: "☼" },
  { id: "official", label: "الرسمي", shortLabel: "رسمي", icon: "◆" },
  { id: "pink", label: "الوردي", shortLabel: "وردي", icon: "♥" },
] as const;

export type ThemeId = (typeof themeOptions)[number]["id"];
const storageKey = "athar-theme";
const ThemeContext = createContext<{ theme: ThemeId; setTheme: (theme: ThemeId) => void }>({ theme: "dark", setTheme: () => undefined });

function isTheme(value: string | null): value is ThemeId { return themeOptions.some((option) => option.id === value); }
function applyTheme(theme: ThemeId) { document.documentElement.dataset.theme = theme; }

let currentTheme: ThemeId = "dark";
const subscribers = new Set<() => void>();
if (typeof window !== "undefined") {
  const saved = window.localStorage.getItem(storageKey);
  if (isTheme(saved)) currentTheme = saved;
}
function subscribe(listener: () => void) {
  subscribers.add(listener);
  const onStorage = () => { const saved = window.localStorage.getItem(storageKey); currentTheme = isTheme(saved) ? saved : "dark"; listener(); };
  window.addEventListener("storage", onStorage);
  return () => { subscribers.delete(listener); window.removeEventListener("storage", onStorage); };
}
function getSnapshot() { return currentTheme; }
function getServerSnapshot(): ThemeId { return "dark"; }

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => { applyTheme(theme); }, [theme]);
  const value = useMemo(() => ({ theme, setTheme: (next: ThemeId) => { currentTheme = next; applyTheme(next); window.localStorage.setItem(storageKey, next); subscribers.forEach((listener) => listener()); } }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }
