import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const ADMIN_COOKIE = "athar_admin_session";
const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;

function adminSecret() { return process.env.ATHAR_ADMIN_SECRET?.trim() ?? ""; }
export function adminPath() { return process.env.ATHAR_ADMIN_PATH?.trim() ?? ""; }

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function signature(value: string) { return createHmac("sha256", adminSecret()).update(value).digest("base64url"); }

export function isAdminPath(value: string) { return Boolean(adminPath()) && safeEqual(value, adminPath()); }

export function isAdminSecret(value: string) { return Boolean(adminSecret()) && safeEqual(value, adminSecret()); }

export async function createAdminSession() {
  if (!adminSecret()) throw new Error("ADMIN_SECRET_NOT_CONFIGURED");
  const expiresAt = Date.now() + ADMIN_SESSION_MS;
  const payload = `${expiresAt}.${randomBytes(18).toString("base64url")}`;
  const token = `${payload}.${signature(payload)}`;
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production" && process.env.ATHAR_E2E !== "true", sameSite: "strict", path: "/", expires: new Date(expiresAt) });
}

export async function hasAdminSession() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value ?? "";
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expiresText, nonce, providedSignature] = parts;
  const expiresAt = Number(expiresText);
  if (!nonce || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  return safeEqual(providedSignature, signature(`${expiresText}.${nonce}`));
}

export async function requireAdminSession() {
  if (!(await hasAdminSession())) throw new Error("ADMIN_UNAUTHENTICATED");
}

export async function revokeAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production" && process.env.ATHAR_E2E !== "true", sameSite: "strict", path: "/", expires: new Date(0) });
}
