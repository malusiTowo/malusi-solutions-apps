/**
 * The driver registry.
 *
 * Order here is irrelevant — `resolveLevels` sorts by `dependsOn`. The resulting
 * graph for a fully-enabled product is roughly:
 *
 *   github  infisical  neon  sentry  posthog  resend  clerk  anthropic   ← level 1
 *                     ↓        ↓        ↓        ↓
 *                          vercel            cloudflare                   ← level 2
 *                     ↓            ↓
 *                  stripe        expo                                     ← level 3
 */
import { anthropicDriver } from "./anthropic";
import { clerkDriver } from "./clerk";
import { cloudflareDriver } from "./cloudflare";
import { expoDriver } from "./expo";
import { githubDriver } from "./github";
import { infisicalDriver } from "./infisical";
import { neonDriver } from "./neon";
import { posthogDriver } from "./posthog";
import { resendDriver } from "./resend";
import { sentDriver } from "./sent";
import { sentryDriver } from "./sentry";
import { stripeDriver } from "./stripe";
import { vercelDriver } from "./vercel";
import type { Driver } from "../driver";

export const ALL_DRIVERS: readonly Driver[] = [
  anthropicDriver,
  clerkDriver,
  cloudflareDriver,
  expoDriver,
  githubDriver,
  infisicalDriver,
  neonDriver,
  posthogDriver,
  resendDriver,
  sentDriver,
  sentryDriver,
  stripeDriver,
  vercelDriver,
];

export {
  anthropicDriver,
  clerkDriver,
  cloudflareDriver,
  expoDriver,
  githubDriver,
  infisicalDriver,
  neonDriver,
  posthogDriver,
  resendDriver,
  sentDriver,
  sentryDriver,
  stripeDriver,
  vercelDriver,
};
