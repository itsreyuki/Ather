import { NextResponse } from "next/server";
import { logger, reportError, traceId } from "./observability";

export class AppError extends Error {
  constructor(public readonly code: string, public readonly userMessage: string, public readonly status = 400, public readonly metadata: Record<string, unknown> = {}) { super(code); }
}

const messages: Record<string, string> = {
  UNAUTHENTICATED: "يجب تسجيل الدخول أولًا.",
  FORBIDDEN: "لا تملك الصلاحية لتنفيذ هذا الإجراء.",
  NOT_FOUND: "العنصر المطلوب غير موجود.",
  RATE_LIMITED: "محاولات كثيرة. أعد المحاولة لاحقًا.",
  INTERNAL_ERROR: "حدث خطأ غير متوقع. حاول مرة أخرى أو تواصل مع الدعم.",
};

export function apiErrorResponse(error: unknown, request?: Request, fallback = "تعذر تنفيذ الطلب") {
  const id = traceId(request);
  const known = error instanceof AppError;
  const code = known ? error.code : error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "INTERNAL_ERROR";
  const message = known ? error.userMessage : messages[code] ?? fallback;
  const status = known ? error.status : code === "UNAUTHENTICATED" ? 401 : code === "FORBIDDEN" ? 403 : code === "NOT_FOUND" ? 404 : code === "RATE_LIMITED" ? 429 : 500;
  if (status >= 500) reportError(error, { traceId: id, code });
  else logger.warn("handled_api_error", { traceId: id, code, status });
  return NextResponse.json({ error: message, code, traceId: id }, { status });
}
