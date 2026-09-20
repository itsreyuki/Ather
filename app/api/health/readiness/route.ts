import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { assertProductionEnv } from "@/src/lib/env";
import { reportError, traceId } from "@/src/lib/observability";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = traceId(request);
  try {
    if (process.env.NODE_ENV === "production") assertProductionEnv();
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ready", service: "athar", check: "readiness", timestamp: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    reportError(error, { traceId: id, check: "readiness" });
    return NextResponse.json({ status: "not_ready", service: "athar", check: "readiness", traceId: id }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
