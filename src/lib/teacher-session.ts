import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";

const TEACHER_SESSION_COOKIE = "athar_teacher_session";
const TEACHER_SESSION_HOURS = 8;

function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function createTeacherSession(staffId: string, schoolId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TEACHER_SESSION_HOURS * 60 * 60 * 1000);
  await db.teacherSession.create({ data: { tokenHash: tokenHash(token), staffId, schoolId, expiresAt } });
  const cookieStore = await cookies();
  // The session is consumed by both /teacher pages and /api/teacher routes.
  cookieStore.set(TEACHER_SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production" && process.env.ATHAR_E2E !== "true", sameSite: "lax", path: "/", expires: expiresAt });
  return expiresAt;
}

export async function getTeacherSessionContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TEACHER_SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.teacherSession.findFirst({ where: { tokenHash: tokenHash(token), revokedAt: null, expiresAt: { gt: new Date() } }, include: { staff: true, school: true } });
  if (!session || !session.staff.active) return null;
  return session;
}

export async function revokeTeacherSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TEACHER_SESSION_COOKIE)?.value;
  if (token) await db.teacherSession.updateMany({ where: { tokenHash: tokenHash(token), revokedAt: null }, data: { revokedAt: new Date() } });
  cookieStore.set(TEACHER_SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production" && process.env.ATHAR_E2E !== "true", sameSite: "lax", path: "/", expires: new Date(0) });
}

export function teacherSessionTokenHash(value: string) {
  return tokenHash(value);
}
