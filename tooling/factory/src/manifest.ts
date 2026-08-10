/**
 * `apps/<product>/product.manifest.ts` — the declared intent for a product.
 *
 * The manifest says *what* a product needs; drivers decide *how* to get it. It is
 * committed, hand-editable, and contains no secrets and no resource ids (those live
 * in `.factory/state.json`).
 */
import { z } from "zod";

const kebab = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, "Use a lowercase kebab-case name (e.g. my-app)");

/**
 * Neon Postgres. `region` is a Neon region id (`aws-<cloud-region>`), not a bare
 * cloud region — a project cannot be moved between regions after creation.
 */
const neonSchema = z.object({
  region: z.string().default("aws-eu-west-1"),
  pgVersion: z.number().int().min(14).max(17).default(17),
});

/**
 * Sent.dm messaging. Only the webhook endpoint is provisioned: Sent has no API for
 * minting API keys, so the org key is passed through (see the driver).
 */
const sentSchema = z.object({
  /** Path the delivery webhook posts to, appended to the product's domain. */
  webhookPath: z.string().default("/api/webhooks/sent"),
});

const vercelSchema = z.object({
  framework: z.string().default("nextjs"),
  /** Monorepo subdirectory Vercel builds from. Defaults to the product's api app. */
  rootDirectory: z.string().optional(),
});

const sentrySchema = z.object({
  /** Which Sentry projects to create. Mobile is skipped when there is no mobile surface. */
  projects: z.array(z.enum(["web", "mobile"])).default(["web", "mobile"]),
  team: z.string().default("malusi-solutions"),
});

const posthogSchema = z.object({
  host: z.string().url().default("https://us.i.posthog.com"),
});

const resendSchema = z.object({
  /** The From address for transactional mail. Its domain gets verified via Cloudflare. */
  from: z.string().email(),
});

const cloudflareSchema = z.object({
  /** The apex zone the product's domain lives under, e.g. `malusi.solutions`. */
  zone: z.string(),
});

const stripeSchema = z.object({
  /**
   * `shared-account` provisions Products/Prices/webhook endpoints inside the one
   * Stripe account named by `STRIPE_SECRET_KEY`. Creating a *separate* account per
   * product requires a reviewed Stripe App (Claimable Sandboxes) — see the Stripe
   * driver for the upgrade path.
   */
  mode: z.literal("shared-account").default("shared-account"),
  /** Price in the smallest currency unit, e.g. 900 = £9.00. Omit for no default price. */
  monthlyPriceMinor: z.number().int().positive().optional(),
  currency: z.string().length(3).default("gbp"),
});

export const productManifestSchema = z.object({
  name: kebab,
  displayName: z.string(),
  /** Production hostname. Also seeds the Resend From domain and the Vercel domain. */
  domain: z.string().optional(),
  /**
   * Local dev port for this product's Next app. Allocated at creation by scanning
   * sibling manifests, so two products never collide on 3000.
   */
  devPort: z.number().int().min(3000).max(3999),
  surfaces: z
    .object({ api: z.boolean().default(true), mobile: z.boolean().default(true) })
    .default({ api: true, mobile: true }),
  services: z
    .object({
      neon: z.union([neonSchema, z.literal(false)]).default(neonSchema.parse({})),
      // Opt-in: messaging costs money and needs a Sent account.
      sent: z.union([sentSchema, z.literal(false)]).default(false),
      vercel: z.union([vercelSchema, z.literal(false)]).default(vercelSchema.parse({})),
      sentry: z.union([sentrySchema, z.literal(false)]).default(sentrySchema.parse({})),
      posthog: z.union([posthogSchema, z.literal(false)]).default(posthogSchema.parse({})),
      resend: z.union([resendSchema, z.literal(false)]).default(false),
      cloudflare: z.union([cloudflareSchema, z.literal(false)]).default(false),
      stripe: z.union([stripeSchema, z.literal(false)]).default(false),
      // Services with no options are a bare boolean.
      github: z.boolean().default(true),
      infisical: z.boolean().default(true),
      expo: z.boolean().default(true),
      clerk: z.boolean().default(true),
      anthropic: z.boolean().default(true),
    })
    // `prefault` (not `default`) so an omitted `services` block is parsed through the
    // per-field defaults above rather than needing a fully-populated literal here.
    .prefault({}),
});

export type ProductManifest = z.infer<typeof productManifestSchema>;
export type ProductManifestInput = z.input<typeof productManifestSchema>;

/**
 * Identity helper so manifests get autocomplete and are validated at load time
 * rather than deep inside a driver.
 */
export function defineProduct(input: ProductManifestInput): ProductManifest {
  return productManifestSchema.parse(input);
}

/** Driver ids a manifest has switched off, so the runner can prune them from the DAG. */
export function disabledServices(manifest: ProductManifest): Set<string> {
  const off = new Set<string>();
  for (const [id, value] of Object.entries(manifest.services)) {
    if (value === false) off.add(id);
  }
  if (!manifest.surfaces.mobile) off.add("expo");
  return off;
}
