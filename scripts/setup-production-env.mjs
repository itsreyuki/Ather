import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, readFile, writeFile } from "node:fs/promises";

const targetUrl = new URL("../.env.production", import.meta.url);
const exampleUrl = new URL("../.env.example", import.meta.url);

try {
  await copyFile(exampleUrl, targetUrl, constants.COPYFILE_EXCL);
} catch (error) {
  if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
    throw new Error(".env.production already exists; refusing to overwrite production secrets.");
  }
  throw error;
}

let content = await readFile(targetUrl, "utf8");
function setValue(name, value) {
  const line = `${name}="${value.replaceAll('"', '\\"')}"`;
  const pattern = new RegExp(`^\\s*${name}\\s*=.*$`, "m");
  content = pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`;
}

setValue("NODE_ENV", "production");
setValue("APP_URL", "https://replace-me.invalid");
setValue("NEXTAUTH_URL", "https://replace-me.invalid");
setValue("DATABASE_URL", "file:./data/athar.db");
setValue("AUTH_SECRET", randomBytes(48).toString("base64"));
setValue("APP_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
setValue("LOOKUP_HMAC_SECRET", randomBytes(48).toString("base64"));
setValue("ERROR_MONITORING_PROVIDER", "configured");
setValue("RATE_LIMIT_STORE", "upstash");
setValue("ATHAR_SEED", "false");
setValue("SEED_DEMO_EMAIL", "");
setValue("SEED_DEMO_PASSWORD", "");

await writeFile(targetUrl, content.endsWith("\n") ? content : `${content}\n`, { encoding: "utf8", mode: 0o600 });
console.log("Created .env.production with fresh local secrets.");
console.log("Database URL and replace-me URLs are intentionally left for the deployment owner.");
