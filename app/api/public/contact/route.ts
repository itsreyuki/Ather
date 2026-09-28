import { NextResponse } from "next/server";
import { LANDING_CONFIG } from "@/src/config/landing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  return NextResponse.json(
    {
      phone: LANDING_CONFIG.contactPhone,
      whatsappNumber: LANDING_CONFIG.whatsappNumber,
      whatsappMessage: LANDING_CONFIG.whatsappMessage,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
