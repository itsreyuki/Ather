import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const workspace = resolve(fileURLToPath(new URL("..", import.meta.url)));
const envPath = resolve(workspace, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*["']?([^"']*)["']?\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const databaseUrl = process.env.DATABASE_URL || "file:./data/athar.db";
if (!databaseUrl.startsWith("file:")) throw new Error("SQLite DATABASE_URL is required.");
const databasePath = resolve(workspace, databaseUrl.slice(5).split("?")[0]);
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const output = resolve(process.argv[2] || resolve(workspace, "backups", "athar-" + stamp + ".db"));
if (!existsSync(databasePath)) throw new Error("SQLite database not found: " + databasePath);
if (existsSync(output)) throw new Error("Refusing to overwrite an existing backup: " + output);
await mkdir(dirname(output), { recursive: true });

const source = new Database(databasePath, { readonly: true });
try {
  source.pragma("query_only = ON");
  const integrity = source.prepare("PRAGMA integrity_check").get();
  if (integrity?.integrity_check !== "ok") throw new Error("SQLite integrity check failed.");
  await source.backup(output);
} finally {
  source.close();
}
const checksum = createHash("sha256").update(await readFile(output)).digest("hex");
await writeFile(output + ".sha256", checksum + "  " + basename(output) + "\n", "utf8");
console.log("Backup created: " + output);
console.log("SHA-256: " + checksum);
