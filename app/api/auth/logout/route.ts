import { NextResponse } from "next/server";
import { getSessionContext, revokeCurrentSession } from "@/src/lib/auth";
import { db } from "@/src/lib/db";

export async function POST() { const session = await getSessionContext(); if (session?.membership) await db.auditLog.create({ data: { schoolId: session.membership.schoolId, userId: session.user.id, action: "LOGOUT", entity: "Session", entityId: session.sessionId } }); await revokeCurrentSession(); return NextResponse.json({ nextPath: "/" }); }
