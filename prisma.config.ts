import { readFileSync } from "node:fs";
import { defineConfig } from "prisma/config";

if (!process.env.DATABASE_URL) {
  try {
    const envText = readFileSync(new URL("./.env", import.meta.url), "utf8");
    for (const line of envText.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*["']?([^"']*)["']?\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    // CI and production normally provide environment variables directly.
  }
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for Prisma CLI commands.");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations-sqlite" },
  datasource: { url: process.env.DATABASE_URL },
});
