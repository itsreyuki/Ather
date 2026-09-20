"use client";

import { Bell, CheckCheck, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type NotificationItem = { id: string; title: string; body: string; href: string | null; readAt: string | null; createdAt: string };
type NotificationResponse = { items: NotificationItem[]; unreadCount: number };

const dateFormatter = new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" });

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationResponse>({ items: [], unreadCount: 0 });

  async function refresh() {
    const response = await fetch("/api/dashboard/notifications", { cache: "no-store" });
    if (response.ok) setData(await response.json() as NotificationResponse);
  }

  useEffect(() => { const timer = window.setTimeout(() => { void refresh(); }, 0); return () => window.clearTimeout(timer); }, []);

  async function markRead(id: string) {
    await fetch("/api/dashboard/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    setData((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item), unreadCount: Math.max(0, current.unreadCount - 1) }));
  }

  async function markAllRead() {
    await fetch("/api/dashboard/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ all: true }) });
    setData((current) => ({ ...current, items: current.items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })), unreadCount: 0 }));
  }

  return <div className="notification-center"><button className="icon-button notification-trigger" aria-label="الإشعارات" aria-expanded={open} onClick={() => setOpen((value) => !value)}><Bell size={17} />{data.unreadCount > 0 && <span className="notification-count">{data.unreadCount > 99 ? "99+" : data.unreadCount.toLocaleString("ar-SA")}</span>}</button>{open && <><button className="notification-scrim" aria-label="إغلاق الإشعارات" onClick={() => setOpen(false)} /><section className="notification-popover" aria-label="مركز الإشعارات"><div className="notification-heading"><div><strong>مركز الإشعارات</strong><small>{data.unreadCount.toLocaleString("ar-SA")} غير مقروء</small></div><div className="notification-heading-actions">{data.unreadCount > 0 && <button className="icon-button small" aria-label="تحديد الكل كمقروء" onClick={() => void markAllRead()}><CheckCheck size={15} /></button>}<button className="icon-button small" aria-label="إغلاق" onClick={() => setOpen(false)}><X size={15} /></button></div></div>{data.items.length === 0 ? <div className="notification-empty">لا توجد إشعارات جديدة.</div> : <div className="notification-list">{data.items.slice(0, 10).map((item) => <div className={`notification-item ${item.readAt ? "read" : "unread"}`} key={item.id}><span className="notification-dot" /><div><strong>{item.title}</strong><p>{item.body}</p><small>{dateFormatter.format(new Date(item.createdAt))}</small>{item.href && <Link href={item.href} onClick={() => { void markRead(item.id); setOpen(false); }}>فتح التفاصيل <ExternalLink size={11} /></Link>}</div></div>)}</div>}<Link className="notification-all-link" href="/dashboard/notifications" onClick={() => setOpen(false)}>عرض كل الإشعارات</Link></section></>}</div>;
}
