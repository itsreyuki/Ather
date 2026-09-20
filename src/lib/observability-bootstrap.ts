import { configureErrorMonitorFromEnv, logger } from "@/src/lib/observability";

export function registerServerObservability() {
  configureErrorMonitorFromEnv();
  logger.info("observability_registered", {
    monitorConfigured: process.env.ERROR_MONITORING_PROVIDER === "configured",
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
  });
}
