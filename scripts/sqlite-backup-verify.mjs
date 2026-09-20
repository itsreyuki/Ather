import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";

const source = resolve(process.argv[2] || "backups");
const backupPath = existsSync(source) && source.toLowerCase().endsWith(".db")
  ? source
  : "";
if (!backupPath) throw new Error("Pass a SQLite .db backup path as the first argument.");
const temporaryRoot = await mkdtemp(join(tmpdir(), "athar-sqlite-verify-"));
const copy = join(temporaryRoot, "restore.db");
try {
  await writeFile(copy, readFileSync(backupPath));
  const database = new Database(copy, { readonly: true });
  try {
    const integrity = database.prepare("PRAGMA integrity_check").get();
    if (integrity?.integrity_check !== "ok") throw new Error("SQLite integrity check failed.");
    database.prepare('SELECT COUNT(*) AS count FROM "School"').get();
  } finally {
    database.close();
  }
  console.log("SQLite backup restore verification passed.");
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
