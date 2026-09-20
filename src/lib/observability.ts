type LogLevel = "info" | "warn" | "error";
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const sensitiveKey = /(password|secret|token|authorization|cookie|otp|code|phone|national.?id|identity|encryption|api.?key)/i;

export function redactText(input: string): string {
  return input
    .slice(0, 2_000)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [Redacted]")
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1[CredentialsRedacted]@")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EmailRedacted]")
    .replace(/(?<!\d)(?:\+?\d[\s().-]*){6,20}(?!\d)/g, "[NumberRedacted]")
    .replace(/\b[A-Za-z0-9+/=_-]{32,}\b/g, "[TokenRedacted]")
    .slice(0, 500);
}

export function redact(value: unknown, depth = 0): JsonValue {
  if (depth > 4) return "[Truncated]";
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return typeof value === "string" ? redactText(value) : value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1));
  if (value instanceof Error) return { name: value.name, message: redactText(value.message) };
  if (typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 100).map(([key, item]) => [key, sensitiveKey.test(key) ? "[Redacted]" : redact(item, depth + 1)]));
  return String(value);
}

function write(level: LogLevel, event: string, metadata: Record<string, unknown> = {}) {
  const safeMetadata = redact(metadata);
  const entry = { timestamp: new Date().toISOString(), level, service: "athar", event, ...(typeof safeMetadata === "object" && safeMetadata !== null && !Array.isArray(safeMetadata) ? safeMetadata : {}) };
  const output = JSON.stringify(entry);
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.info(output);
}

export const logger = { info: (event: string, metadata?: Record<string, unknown>) => write("info", event, metadata), warn: (event: string, metadata?: Record<string, unknown>) => write("warn", event, metadata), error: (event: string, metadata?: Record<string, unknown>) => write("error", event, metadata) };

export interface ErrorMonitor { captureException(error: unknown, context: Record<string, unknown>): void | Promise<void>; }
export class NoopErrorMonitor implements ErrorMonitor { captureException() {} }

export class HttpErrorMonitor implements ErrorMonitor {
  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly timeoutMs = 5_000,
  ) {}

  async captureException(error: unknown, context: Record<string, unknown>) {
    const safeError = redact(error instanceof Error ? error : new Error(String(error)));
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        service: "athar",
        timestamp: new Date().toISOString(),
        error: safeError,
        context: redact(context),
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new Error("ERROR_MONITOR_DELIVERY_FAILED");
  }
}

let monitor: ErrorMonitor = new NoopErrorMonitor();
export function configureErrorMonitor(next: ErrorMonitor) { monitor = next; }
export function configureErrorMonitorFromEnv(env: NodeJS.ProcessEnv = process.env) {
  monitor = env.ERROR_MONITORING_PROVIDER === "configured" && env.ERROR_MONITORING_DSN && env.ERROR_MONITORING_API_KEY
    ? new HttpErrorMonitor(env.ERROR_MONITORING_DSN, env.ERROR_MONITORING_API_KEY)
    : new NoopErrorMonitor();
}

export async function reportErrorAsync(error: unknown, context: Record<string, unknown> = {}) {
  const safeContext = redact(context) as Record<string, unknown>;
  logger.error("unhandled_error", { error, ...safeContext });
  try {
    await monitor.captureException(error, safeContext);
  } catch (monitorError) {
    logger.warn("error_monitor_delivery_failed", { error: monitorError });
  }
}

export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  void reportErrorAsync(error, context);
}

export function traceId(request?: Request) { return request?.headers.get("x-request-id")?.slice(0, 100) || globalThis.crypto.randomUUID(); }
