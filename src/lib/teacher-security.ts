import { createHash } from "node:crypto";

export type TeacherRiskContext = {
  ip: string;
  userAgent: string;
  identifierHash?: string;
};

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export interface RateLimitProvider {
  consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

export class DevelopmentRateLimitProvider implements RateLimitProvider {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const current = this.buckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    bucket.count += 1;
    this.buckets.set(key, bucket);
    return {
      allowed: bucket.count <= limit,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
}

export class UpstashRateLimitProvider implements RateLimitProvider {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const script =
      "local count=redis.call('INCR',KEYS[1]);if count==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]);end;return {count,redis.call('PTTL',KEYS[1])}";
    try {
      const response = await fetch(this.url.endsWith("/pipeline") ? this.url : `${this.url}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}`, "content-type": "application/json" },
        body: JSON.stringify([["EVAL", script, "1", key, String(windowMs)]]),
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new Error("RATE_LIMIT_STORE_UNAVAILABLE");
      const body = (await response.json()) as Array<{ result?: [number, number] }>;
      const [count, ttl] = body[0]?.result ?? [limit + 1, windowMs];
      return { allowed: count <= limit, retryAfterSeconds: Math.max(1, Math.ceil(ttl / 1000)) };
    } catch {
      return { allowed: false, retryAfterSeconds: 60 };
    }
  }
}

export class FailClosedRateLimitProvider implements RateLimitProvider {
  async consume(): Promise<RateLimitResult> {
    return { allowed: false, retryAfterSeconds: 60 };
  }
}

export interface TeacherRiskAdapter {
  evaluate(context: TeacherRiskContext): Promise<{ allowed: boolean; score: number; reasons: string[] }>;
}

class DevelopmentRiskAdapter implements TeacherRiskAdapter {
  async evaluate() {
    return { allowed: true, score: 0, reasons: [] };
  }
}

const e2eMode = process.env.ATHAR_E2E === "true";
const rateLimiter: RateLimitProvider =
  process.env.RATE_LIMIT_STORE === "upstash" &&
  process.env.RATE_LIMIT_REDIS_URL &&
  process.env.RATE_LIMIT_REDIS_TOKEN
    ? new UpstashRateLimitProvider(process.env.RATE_LIMIT_REDIS_URL, process.env.RATE_LIMIT_REDIS_TOKEN)
    : process.env.NODE_ENV === "production" && !e2eMode
      ? new FailClosedRateLimitProvider()
      : new DevelopmentRateLimitProvider();
const risk: TeacherRiskAdapter = new DevelopmentRiskAdapter();

export function requestFingerprint(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  return { ip, userAgent };
}

export function securityFingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

export async function checkTeacherRisk(request: Request, identifierHash?: string) {
  const requestInfo = requestFingerprint(request);
  if (process.env.ATHAR_E2E === "true") {
    return { ...requestInfo, allowed: true, retryAfterSeconds: 0, riskScore: 0, reasons: [] as string[] };
  }
  const context = { ...requestInfo, identifierHash };
  const ipLimitPromise = rateLimiter.consume(
    `teacher:ip:${securityFingerprint(requestInfo.ip)}`,
    8,
    10 * 60_000,
  );
  const identityLimitPromise = identifierHash
    ? rateLimiter.consume(`teacher:id:${identifierHash}`, 5, 15 * 60_000)
    : Promise.resolve({ allowed: true, retryAfterSeconds: 0 });
  const [ipLimit, identityLimit] = await Promise.all([ipLimitPromise, identityLimitPromise]);
  const riskResult = await risk.evaluate(context);
  return {
    ...requestInfo,
    allowed: ipLimit.allowed && identityLimit.allowed && riskResult.allowed,
    retryAfterSeconds: Math.max(ipLimit.retryAfterSeconds, identityLimit.retryAfterSeconds),
    riskScore: riskResult.score,
    reasons: riskResult.reasons,
  };
}
