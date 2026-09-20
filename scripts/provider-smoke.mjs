import { existsSync, readFileSync } from "node:fs";

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*["']?([^"']*)["']?\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

loadEnv(new URL("../.env.production", import.meta.url));
loadEnv(new URL("../.env", import.meta.url));

if (process.env.ATHAR_PROVIDER_TEST !== "true") {
  throw new Error("Provider smoke tests can contact external services. Set ATHAR_PROVIDER_TEST=true to continue.");
}

const [channel] = process.argv.slice(2);
if (!new Set(["monitor", "redis"]).has(channel)) {
  throw new Error("Usage: npm run providers:verify -- <monitor|redis>");
}

async function request(url, apiKey, payload) {
  if (!url || !apiKey) throw new Error("Provider URL or API key is missing.");
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
  return response.json().catch(() => ({}));
}


if (channel === "monitor") {
  await request(process.env.ERROR_MONITORING_DSN, process.env.ERROR_MONITORING_API_KEY, { service: "athar", timestamp: new Date().toISOString(), error: { name: "ProviderSmokeTest", message: "Intentional monitoring test" }, context: { purpose: "PROVIDER_SMOKE_TEST" } });
  console.log("Error monitoring endpoint accepted the test event.");
}

if (channel === "redis") {
  const base = process.env.RATE_LIMIT_REDIS_URL?.replace(/\/$/, "");
  const token = process.env.RATE_LIMIT_REDIS_TOKEN;
  if (!base || !token) throw new Error("RATE_LIMIT_REDIS_URL or RATE_LIMIT_REDIS_TOKEN is missing.");
  const response = await fetch(`${base}/ping`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5_000) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.result !== "PONG") throw new Error("Redis REST endpoint did not return PONG.");
  console.log("Rate-limit Redis endpoint returned PONG.");
}
