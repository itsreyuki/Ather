"use client";

import { CheckCircle2, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Toast = { id: number; title: string; description?: string };
type ToastContextValue = { toast: (toast: Omit<Toast, "id">) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const toast = useCallback((item: Omit<Toast, "id">) => { const id = Date.now(); setItems((current) => [...current, { ...item, id }]); window.setTimeout(() => setItems((current) => current.filter((toastItem) => toastItem.id !== id)), 4500); }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  return <ToastContext.Provider value={value}>{children}<div className="toast-region" aria-live="polite" aria-atomic="true">{items.map((item) => <div className="toast" key={item.id}><CheckCircle2 size={18} color="var(--emerald)" /><div><strong>{item.title}</strong>{item.description && <p>{item.description}</p>}</div><button onClick={() => setItems((current) => current.filter((toastItem) => toastItem.id !== item.id))} aria-label="إغلاق التنبيه"><X size={15} /></button></div>)}</div></ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
