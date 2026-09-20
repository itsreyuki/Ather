import { NextResponse } from "next/server";
import { revokeTeacherSession } from "@/src/lib/teacher-session";

export async function POST() {
  await revokeTeacherSession();
  return NextResponse.json({ nextPath: "/teacher" });
}
