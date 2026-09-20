import { NextResponse } from "next/server";
import { serverNow } from "@/src/lib/clock";

export async function POST(request: Request) {
  if (process.env.ATHAR_E2E !== "true" || process.env.ATHAR_TEST_CLOCK !== "true")
    return new NextResponse(null, { status: 404 });
  const body = (await request.json().catch(() => null)) as { now?: unknown } | null;
  if (typeof body?.now !== "string" || Number.isNaN(new Date(body.now).valueOf()))
    return NextResponse.json({ error: "invalid test clock" }, { status: 400 });
  process.env.ATHAR_TEST_NOW = body.now;
  return NextResponse.json({ now: serverNow().toISOString() });
}
