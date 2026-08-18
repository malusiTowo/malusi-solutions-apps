import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      build: {
        command: "next build",
        dependsOn: [{ task: "build", from: "dependencies" }],
        // Cached tasks run with a filtered environment: only the vars below
        // (fingerprinted) plus vp's common set (CI, NEXT_*, PATH, …) reach the
        // task. Add a new env var here or the cache will span changes to it —
        // and `next build` won't see it at all.
        env: [
          "NODE_ENV",
          "SKIP_ENV_VALIDATION",
          "DATABASE_URL",
          "DATABASE_URL_UNPOOLED",
          "DATABASE_REPLICA_URLS",
          "CLERK_SECRET_KEY",
          "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
          "STRIPE_SECRET_KEY",
          "STRIPE_WEBHOOK_SECRET",
          "STRIPE_PRICE_ID",
          "RESEND_API_KEY",
          "RESEND_FROM",
          "ANTHROPIC_API_KEY",
          "SENT_DM_API_KEY",
          "SENT_DM_WEBHOOK_SECRET",
          "SENT_DM_SANDBOX",
          "NEXT_PUBLIC_POSTHOG_KEY",
          "NEXT_PUBLIC_POSTHOG_HOST",
          "SENTRY_DSN",
          "NEXT_PUBLIC_SENTRY_DSN",
          "SENTRY_AUTH_TOKEN",
          "SENTRY_ORG",
          "SENTRY_PROJECT",
          "NEXT_PUBLIC_APP_URL",
        ],
        // Don't archive Next's incremental build cache.
        output: [".next/**", "!.next/cache/**"],
      },
      typecheck: {
        command: "tsc --noEmit",
      },
    },
  },
});
