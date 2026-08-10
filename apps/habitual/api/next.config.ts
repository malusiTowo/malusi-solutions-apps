import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship raw TypeScript; Next transpiles them.
  transpilePackages: [
    "@habitual/core",
    "@repo/api",
    "@repo/auth",
    "@repo/db",
    "@repo/design",
    "@repo/payments",
    "@repo/ui",
    "@repo/ai",
    "@repo/analytics",
    "@repo/email",
    "@repo/notifications",
    "@repo/sms",
  ],
  // `ws` has optional native deps (bufferutil, utf-8-validate) that must not be
  // bundled; the Neon driver is kept beside it so both resolve from node_modules.
  serverExternalPackages: ["@neondatabase/serverless", "ws"],
  typescript: { ignoreBuildErrors: false },
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  telemetry: false,
  // Store credentials are follow-ups; disabling source map upload without a token.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
