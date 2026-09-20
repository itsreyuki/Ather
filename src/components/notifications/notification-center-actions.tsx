"use client";

import { CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";

export function NotificationCenterActions({ hasUnread }: { hasUnread: boolean }) {
  const router = useRouter();
  async function markAll() { await fetch("/api/dashboard/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ all: true }) }); router.refresh(); }
  return hasUnread ? <button className="button button-secondary" onClick={() => void markAll()}><CheckCheck size={15} /> تحديد الكل كمقروء</button> : null;
}
