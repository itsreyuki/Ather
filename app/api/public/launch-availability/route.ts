import { NextResponse } from "next/server";
import { getLaunchAvailability } from "@/src/lib/license-service";

export async function GET() {
  return NextResponse.json(await getLaunchAvailability(), { headers: { "Cache-Control": "no-store" } });
}
