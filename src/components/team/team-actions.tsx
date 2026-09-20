"use client";

import { RotateCcw, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function TeamMemberStatusAction({ membershipId, status }: { membershipId: string; status: "ACTIVE" | "SUSPENDED" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const nextStatus = status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
  async function update() {
    if (!window.confirm(nextStatus === "SUSPENDED" ? "إيقاف وصول هذا المسؤول؟" : "إعادة تفعيل وصول هذا المسؤول؟")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/dashboard/settings/team/members/${membershipId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
      if (!response.ok) throw new Error();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return <button className="icon-text-button" type="button" onClick={() => void update()} disabled={busy} title={nextStatus === "SUSPENDED" ? "إيقاف العضو" : "إعادة تفعيل العضو"}>{nextStatus === "SUSPENDED" ? <UserMinus size={14} /> : <RotateCcw size={14} />}{busy ? "..." : nextStatus === "SUSPENDED" ? "إيقاف" : "تفعيل"}</button>;
}
