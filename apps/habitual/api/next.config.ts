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
  ],
  serverExternalPackages: ["mongodb"],
  typescript: { ignoreBuildErrors: false },
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  telemetry: false,
  // Store credentials are follow-ups; disabling source map upload without a token.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
