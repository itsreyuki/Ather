import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const envUrl = new URL("../.env", import.meta.url);
const exampleUrl = new URL("../.env.example", import.meta.url);

let content = existsSync(envUrl) ? readFileSync(envUrl, "utf8") : readFileSync(exampleUrl, "utf8");

function readValue(name) {
  const line = content.split(/\r?\n/).find((item) => new RegExp(`^\\s*${name}\\s*=`).test(item));
  if (!line) return undefined;
  return line.replace(new RegExp(`^\\s*${name}\\s*=\\s*`), "").trim().replace(/^['"]|['"]$/g, "");
}

function setValue(name, value) {
  const line = `${name}="${value.replaceAll('"', '\\"')}"`;
  const pattern = new RegExp(`^\\s*${name}\\s*=.*$`, "m");
  content = pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`;
}

function isBase64(value, expectedBytes) {
  if (!value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  try {
    return Buffer.from(value, "base64").length === expectedBytes;
  } catch {
    return false;
  }
}

if (readValue("NODE_ENV") === "production") throw new Error("setup:dev لا يعمل في NODE_ENV=production.");

if (!readValue("DATABASE_URL") || readValue("DATABASE_URL").startsWith("postgresql:")) setValue("DATABASE_URL", "file:./data/athar.db");
setValue("NODE_ENV", "development");
setValue("APP_URL", readValue("APP_URL") || "http://localhost:3000");
setValue("NEXTAUTH_URL", readValue("NEXTAUTH_URL") || "http://localhost:3000");
if (!isBase64(readValue("AUTH_SECRET"), 48)) setValue("AUTH_SECRET", randomBytes(48).toString("base64"));
if (!isBase64(readValue("APP_ENCRYPTION_KEY"), 32)) setValue("APP_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
if (!isBase64(readValue("LOOKUP_HMAC_SECRET"), 48)) setValue("LOOKUP_HMAC_SECRET", randomBytes(48).toString("base64"));
setValue("RATE_LIMIT_STORE", "memory");
setValue("ERROR_MONITORING_PROVIDER", "development");
setValue("ATHAR_SEED", "false");

writeFileSync(envUrl, content.endsWith("\n") ? content : `${content}\n`, "utf8");
console.log("تم تجهيز .env للتطوير وتوليد الأسرار المفقودة أو غير الصالحة.");
console.log("لم يتم تعديل DATABASE_URL أو تشغيل قاعدة البيانات أو Seed.");
