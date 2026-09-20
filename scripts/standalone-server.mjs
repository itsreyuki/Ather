import { cpSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const workspace = resolve(fileURLToPath(new URL("..", import.meta.url)));
const standaloneRoot = resolve(workspace, ".next", "standalone");
const serverPath = resolve(standaloneRoot, "server.js");
if (!existsSync(serverPath)) throw new Error("Standalone build not found. Run npm run build first.");

function readEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  return Object.fromEntries(
    readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .flatMap((line) => {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!match) return [];
        return [[match[1], match[2].replace(/^['"]|['"]$/g, "")]];
      }),
  );
}

// This wrapper launches the standalone server from .next/standalone, so
// relative file URLs would otherwise resolve inside that folder. Load the
// project environment here and let explicitly supplied process variables win.
const runtimeEnv = {
  ...readEnvFile(resolve(workspace, ".env")),
  ...readEnvFile(resolve(workspace, ".env.production")),
  ...process.env,
};

const configuredDatabaseUrl = runtimeEnv.DATABASE_URL;
const runtimeDatabaseUrl = configuredDatabaseUrl?.startsWith("file:./")
  ? "file:" + resolve(workspace, configuredDatabaseUrl.slice(5).split("?")[0])
  : configuredDatabaseUrl;

cpSync(resolve(workspace, ".next", "static"), resolve(standaloneRoot, ".next", "static"), { recursive: true, force: true });
if (existsSync(resolve(workspace, "public"))) cpSync(resolve(workspace, "public"), resolve(standaloneRoot, "public"), { recursive: true, force: true });

const child = spawn(process.execPath, [serverPath], {
  stdio: "inherit",
  shell: false,
  cwd: workspace,
  env: { ...runtimeEnv, ...(runtimeDatabaseUrl ? { DATABASE_URL: runtimeDatabaseUrl } : {}), HOSTNAME: runtimeEnv.HOSTNAME || "127.0.0.1", PORT: runtimeEnv.PORT || "3000" },
});

const stop = (signal) => child.kill(signal);
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
