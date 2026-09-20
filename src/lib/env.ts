import { z } from "zod";

const base64Secret = z.string().min(32).refine((value) => Buffer.from(value, "base64").length >= 24, "must be base64 encoded");
const encryptionKey = z.string().refine((value) => Buffer.from(value, "base64").length === 32, "must decode to exactly 32 bytes");

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  AUTH_SECRET: base64Secret.optional(),
  APP_ENCRYPTION_KEY: encryptionKey.optional(),
  LOOKUP_HMAC_SECRET: base64Secret.optional(),
  ID_LOOKUP_SECRET: z.string().optional(),
  FIELD_ENCRYPTION_KEY: z.string().optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  APP_URL: z.string().url().optional(),
  ERROR_MONITORING_PROVIDER: z.enum(["development", "configured"]).optional(),
  ERROR_MONITORING_DSN: z.string().url().optional().or(z.literal("")),
  ERROR_MONITORING_API_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  RATE_LIMIT_STORE: z.enum(["memory", "upstash"]).default("memory"),
  RATE_LIMIT_REDIS_URL: z.string().url().optional().or(z.literal("")),
  RATE_LIMIT_REDIS_TOKEN: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
});

const productionSchema = envSchema.extend({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: base64Secret,
  APP_ENCRYPTION_KEY: encryptionKey,
  LOOKUP_HMAC_SECRET: base64Secret,
  APP_URL: z.string().url(),
  ERROR_MONITORING_PROVIDER: z.literal("configured"),
  ERROR_MONITORING_DSN: z.string().url(),
  ERROR_MONITORING_API_KEY: z.string().min(1),
  RATE_LIMIT_STORE: z.literal("upstash"),
  RATE_LIMIT_REDIS_URL: z.string().url(),
  RATE_LIMIT_REDIS_TOKEN: z.string().min(1),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (!cachedEnv) cachedEnv = envSchema.parse({ ...process.env, APP_ENCRYPTION_KEY: process.env.APP_ENCRYPTION_KEY || process.env.FIELD_ENCRYPTION_KEY, LOOKUP_HMAC_SECRET: process.env.LOOKUP_HMAC_SECRET || process.env.ID_LOOKUP_SECRET });
  return cachedEnv;
}

export function hasDatabaseConfig(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function assertProductionEnv() {
  return productionSchema.parse({ ...process.env, APP_ENCRYPTION_KEY: process.env.APP_ENCRYPTION_KEY || process.env.FIELD_ENCRYPTION_KEY, LOOKUP_HMAC_SECRET: process.env.LOOKUP_HMAC_SECRET || process.env.ID_LOOKUP_SECRET });
}
