import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerServerObservability } = await import("@/src/lib/observability-bootstrap");
    registerServerObservability();
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (error instanceof Error && (error.name === "AbortError" || error.message.includes("destination stream closed early"))) return;
  const { reportErrorAsync } = await import("@/src/lib/observability");
  await reportErrorAsync(error, {
    method: request.method,
    path: request.path.split("?", 1)[0],
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    revalidateReason: context.revalidateReason,
  });
};
