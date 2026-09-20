import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["scripts/standalone-server.mjs"], {
  stdio: "inherit",
  shell: false,
  env: { ...process.env, ATHAR_E2E: "true", ATHAR_TEST_CLOCK: "true", NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: "3000" },
});

const stop = (signal) => child.kill(signal);
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
