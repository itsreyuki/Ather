import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";

const SESSION_COOKIE = "athar_session";
const SESSION_DAYS = 30;

function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function createSession(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new Error("USER_NOT_FOUND");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { userId, tokenHash: tokenHash(token), expiresAt } });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production" && process.env.ATHAR_E2E !== "true", sameSite: "lax", path: "/", expires: expiresAt });
  return expiresAt;
}

export async function getSessionContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findFirst({ where: { tokenHash: tokenHash(token), revokedAt: null, expiresAt: { gt: new Date() } }, include: { user: { include: { memberships: { where: { status: "ACTIVE" }, include: { school: true } } } } } });
  if (!session) return null;
  return { sessionId: session.id, user: session.user, membership: session.user.memberships[0] ?? null };
}

export async function requireSession() {
  const context = await getSessionContext();
  if (!context) throw new Error("UNAUTHENTICATED");
  return context;
}

export async function revokeCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await db.session.updateMany({ where: { tokenHash: tokenHash(token), revokedAt: null }, data: { revokedAt: new Date() } });
  cookieStore.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production" && process.env.ATHAR_E2E !== "true", sameSite: "lax", path: "/", expires: new Date(0) });
}

export async function revokeAllUserSessions(userId: string) {
  await db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
