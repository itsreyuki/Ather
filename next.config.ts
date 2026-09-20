import type { NextConfig } from "next";

const configuredAppHost = (() => {
  try {
    return process.env.APP_URL ? new URL(process.env.APP_URL).hostname : undefined;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The Next.js development badge is not part of the product UI.
  // Production builds never render it; disabling it also keeps local client demos clean.
  devIndicators: false,
  // Allow the configured HTTPS tunnel to load Next development assets.
  // The value comes from APP_URL so changing the tunnel never requires
  // duplicating a hostname in application code.
  allowedDevOrigins: configuredAppHost ? [configuredAppHost] : [],
  output: "standalone",
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-better-sqlite3", "better-sqlite3", "pdf-parse"],
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/better-sqlite3/**/*",
      "./node_modules/@prisma/adapter-better-sqlite3/**/*",
    ],
    "/api/dashboard/workshops/*/report/export": [
      "./node_modules/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-400-normal.woff",
      "./node_modules/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-700-normal.woff",
    ],
  },
};

export default nextConfig;
