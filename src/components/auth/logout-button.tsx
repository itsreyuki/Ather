"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton({ label = "تسجيل الخروج", icon }: { label?: string; icon?: ReactNode }) { const router = useRouter(); async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.push("/"); router.refresh(); } return <button className="logout-button" onClick={logout}>{icon}{label}</button>; }
