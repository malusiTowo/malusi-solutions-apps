/**
 * Stripe — a Product, an optional recurring Price, and a webhook endpoint pointed at
 * the product's deployed `/api/webhooks/stripe` route.
 *
 * **Scope.** Stripe has no API for creating an ordinary account, so every product
 * shares the one account behind `STRIPE_SECRET_KEY` and is separated by metadata
 * instead. Creating a genuinely separate account per product is possible via
 * Claimable Sandboxes (`POST /v2/core/claimable_sandboxes`, which returns
 * `pk_test`/`sk_test` directly), but that requires building a Stripe App, uploading
 * it, and being granted access through Stripe's app review — and unclaimed sandboxes
 * expire after 60 days. When such an App exists, this driver is where it plugs in.
 *
 * Depends on `vercel` because the webhook endpoint needs the deployment URL.
 */
import { request, requireJson } from "../http";
import type { Ctx, Driver } from "../driver";
import type { ManualStep, PlanStep, VerifyResult } from "../types";

const API = "https://api.stripe.com/v1";

/** Metadata key used to find this product's objects inside the shared account. */
const TAG = "malusi_factory_product";

interface StripeObject {
  readonly id: string;
}

interface StripeList<T> {
  readonly data: readonly T[];
}

interface Price extends StripeObject {
  readonly unit_amount: number | null;
  readonly currency: string;
  readonly active: boolean;
}

interface WebhookEndpoint extends StripeObject {
  readonly url: string;
  readonly status: string;
  /** Only present in the create response. */
  readonly secret?: string;
}

const auth = (ctx: Ctx) => ({ authorization: `Bearer ${ctx.credentials["STRIPE_SECRET_KEY"]}` });

const tagValue = (ctx: Ctx) => `${ctx.product}-${ctx.env}`;
const webhookUrl = (ctx: Ctx) => `${ctx.outputs["NEXT_PUBLIC_APP_URL"] ?? ""}/api/webhooks/stripe`;

/** Stripe search is eventually consistent, but adequate for a provisioning lookup. */
async function findProduct(ctx: Ctx): Promise<StripeObject | undefined> {
  const found = await request<StripeList<StripeObject>>(`${API}/products/search`, {
    driver: "stripe",
    headers: auth(ctx),
    query: { query: `metadata['${TAG}']:'${tagValue(ctx)}'`, limit: 1 },
    allowStatus: [400],
  });
  return found?.data[0];
}

async function findWebhook(ctx: Ctx): Promise<WebhookEndpoint | undefined> {
  const url = webhookUrl(ctx);
  if (url.startsWith("/")) return undefined;

  const list = await request<StripeList<WebhookEndpoint>>(`${API}/webhook_endpoints`, {
    driver: "stripe",
    headers: auth(ctx),
    query: { limit: 100 },
  });
  return list?.data.find((w) => w.url === url);
}

export const stripeDriver: Driver = {
  id: "stripe",
  // The webhook endpoint URL is only known once Vercel has a production hostname.
  dependsOn: ["vercel"],
  outputs: [
    { key: "STRIPE_PRICE_ID", surfaces: ["api"] },
    { key: "STRIPE_WEBHOOK_SECRET", surfaces: ["api"] },
  ],
  credentials: ["STRIPE_SECRET_KEY"],

  resourceName: (ctx) => tagValue(ctx),

  async plan(ctx): Promise<readonly PlanStep[]> {
    const config = ctx.manifest.services.stripe;
    if (config === false) return [];

    const product = await findProduct(ctx);
    const webhook = await findWebhook(ctx);
    const steps: PlanStep[] = [
      {
        action: product ? "noop" : "create",
        resource: `Stripe Product "${ctx.manifest.displayName}"`,
        detail: `tagged ${TAG}=${tagValue(ctx)}`,
      },
    ];

    if (config.monthlyPriceMinor !== undefined) {
      steps.push({
        action: "create",
        resource: `Stripe Price ${config.monthlyPriceMinor} ${config.currency}/month`,
      });
    }

    steps.push({
      action: webhook ? "noop" : "create",
      resource: `Stripe webhook → ${webhookUrl(ctx)}`,
    });

    return steps;
  },

  async apply(ctx) {
    const config = ctx.manifest.services.stripe;
    if (config === false) return {};
    if (ctx.dryRun) return {};

    const statePatch: Record<string, unknown> = {};
    const secrets: Record<string, string> = {};

    // 1. Product.
    let product = await findProduct(ctx);
    if (!product) {
      product = await requireJson<StripeObject>(`${API}/products`, {
        method: "POST",
        driver: "stripe",
        headers: auth(ctx),
        form: {
          name: `${ctx.manifest.displayName} (${ctx.env})`,
          [`metadata[${TAG}]`]: tagValue(ctx),
        },
      });
      ctx.logger.info(`  created Stripe product ${product.id}`);
    }
    statePatch["productId"] = product.id;

    // 2. Price. Prices are immutable, so reuse a matching active one.
    if (config.monthlyPriceMinor !== undefined) {
      const prices = await request<StripeList<Price>>(`${API}/prices`, {
        driver: "stripe",
        headers: auth(ctx),
        query: { product: product.id, active: "true", limit: 100 },
      });

      let price = prices?.data.find(
        (p) => p.unit_amount === config.monthlyPriceMinor && p.currency === config.currency,
      );

      if (!price) {
        price = await requireJson<Price>(`${API}/prices`, {
          method: "POST",
          driver: "stripe",
          headers: auth(ctx),
          form: {
            product: product.id,
            unit_amount: String(config.monthlyPriceMinor),
            currency: config.currency,
            "recurring[interval]": "month",
          },
        });
        ctx.logger.info(`  created Stripe price ${price.id}`);
      }

      statePatch["priceId"] = price.id;
      secrets["STRIPE_PRICE_ID"] = price.id;
    }

    // 3. Webhook endpoint. The signing secret is only returned at creation, matching
    //    the route's `constructWebhookEvent` requirement.
    const url = webhookUrl(ctx);
    if (!url.startsWith("http")) {
      ctx.logger.warn("no deployment URL yet — skipping Stripe webhook endpoint");
      return { statePatch, secrets };
    }

    const existing = await findWebhook(ctx);
    if (!existing) {
      const created = await requireJson<WebhookEndpoint>(`${API}/webhook_endpoints`, {
        method: "POST",
        driver: "stripe",
        headers: auth(ctx),
        form: {
          url,
          "enabled_events[0]": "checkout.session.completed",
          "enabled_events[1]": "customer.subscription.created",
          "enabled_events[2]": "customer.subscription.updated",
          "enabled_events[3]": "customer.subscription.deleted",
          description: `${ctx.manifest.displayName} (${ctx.env}) — created by the factory`,
        },
      });

      statePatch["webhookEndpointId"] = created.id;
      if (created.secret !== undefined) secrets["STRIPE_WEBHOOK_SECRET"] = created.secret;
      ctx.logger.info(`  created Stripe webhook ${created.id} → ${url}`);
    } else {
      statePatch["webhookEndpointId"] = existing.id;
      ctx.logger.debug(`webhook for ${url} already exists`);
    }

    const manualSteps: ManualStep[] =
      secrets["STRIPE_WEBHOOK_SECRET"] === undefined && existing !== undefined
        ? [
            {
              id: "stripe-webhook-secret",
              title: "Copy the existing Stripe webhook signing secret",
              url: `https://dashboard.stripe.com/webhooks/${existing.id}`,
              instructions: [
                "Stripe only returns the signing secret when the endpoint is created.",
                "Open the endpoint above and reveal the signing secret.",
                `Add it to Infisical as STRIPE_WEBHOOK_SECRET for ${ctx.product}/${ctx.env}.`,
              ],
              provides: [{ key: "STRIPE_WEBHOOK_SECRET", surfaces: ["api"] }],
            },
          ]
        : [];

    return { statePatch, secrets, manualSteps };
  },

  async verify(ctx): Promise<VerifyResult> {
    const config = ctx.manifest.services.stripe;
    if (config === false) return { ok: true, message: "stripe disabled" };

    const product = await findProduct(ctx);
    if (!product) return { ok: false, message: `no Stripe product tagged ${tagValue(ctx)}` };

    const webhook = await findWebhook(ctx);
    if (!webhook) return { ok: false, message: `no webhook endpoint for ${webhookUrl(ctx)}` };

    return webhook.status === "enabled"
      ? { ok: true, message: `product ${product.id}, webhook ${webhook.id} enabled` }
      : { ok: false, message: `webhook ${webhook.id} is ${webhook.status}` };
  },

  async destroy(ctx) {
    const recorded = ctx.state.environments[ctx.env]?.["stripe"] ?? {};

    if (typeof recorded["webhookEndpointId"] === "string") {
      await request(`${API}/webhook_endpoints/${recorded["webhookEndpointId"]}`, {
        method: "DELETE",
        driver: "stripe",
        headers: auth(ctx),
        allowStatus: [404],
      });
    }

    // Stripe products with prices cannot be deleted, only archived.
    if (typeof recorded["productId"] === "string") {
      await request(`${API}/products/${recorded["productId"]}`, {
        method: "POST",
        driver: "stripe",
        headers: auth(ctx),
        form: { active: "false" },
        allowStatus: [404],
      });
      ctx.logger.info(`  archived Stripe product ${recorded["productId"]}`);
    }
  },
};
