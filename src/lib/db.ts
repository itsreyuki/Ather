import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const configuredUrl = process.env.DATABASE_URL ?? "file:./data/athar.db";
const databaseUrl = configuredUrl.startsWith("file:")
  ? "file:" + resolve(process.cwd(), configuredUrl.slice(5).split("?")[0])
  : configuredUrl;
if (databaseUrl.startsWith("file:")) mkdirSync(dirname(databaseUrl.slice(5)), { recursive: true });
const adapter = new PrismaBetterSqlite3({ url: databaseUrl }) as Prisma.PrismaClientOptions["adapter"];

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
