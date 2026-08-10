import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/** Validated, typed environment. Import from `~/env` instead of `process.env`. */
export const env = createEnv({
  server: {
    /** Neon pooled connection string — used by both drivers at runtime. */
    DATABASE_URL: z.string().url().optional(),
    /** Neon direct endpoint. drizzle-kit DDL only; the app never reads it. */
    DATABASE_URL_UNPOOLED: z.string().url().optional(),
    /** Optional comma-separated read replicas. */
    DATABASE_REPLICA_URLS: z.string().optional(),
    CLERK_SECRET_KEY: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    SENT_DM_API_KEY: z.string().optional(),
    /** `whsec_…` signing secret for the Sent webhook endpoint. */
    SENT_DM_WEBHOOK_SECRET: z.string().optional(),
    /** Set to "1" outside production to simulate every send. */
    SENT_DM_SANDBOX: z.string().optional(),
    SENTRY_DSN: z.string().optional(),
    SENTRY_AUTH_TOKEN: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  emptyStringAsUndefined: true,
  // Keys are optional in the skeleton; set SKIP_ENV_VALIDATION=1 to bypass entirely.
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
