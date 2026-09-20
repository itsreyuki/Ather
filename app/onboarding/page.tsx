import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/src/components/onboarding/wizard";
import { getSessionContext } from "@/src/lib/auth";

export default async function OnboardingPage() { const session = await getSessionContext(); if (!session) redirect("/auth/login"); if (session.membership) redirect("/onboarding/import"); return <main className="onboarding-page"><OnboardingWizard /></main>; }
