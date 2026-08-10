/**
 * Sent.dm — the product's delivery-status webhook endpoint.
 *
 * Two deliberate limits shape this driver:
 *
 *  - Sent has no API for minting API keys, so the org key from `.env.factory` is
 *    passed through as the product's key rather than scoped per product. Rotating
 *    it is a dashboard action.
 *  - The signing secret is returned **once**, at endpoint creation. There is no
 *    read-back, so an endpoint that already exists is left alone and its secret is
 *    reused from Infisical; recovery is rotation, not retrieval.
 *
 * Like `clerk` and `anthropic`, this declares no required credentials and emits a
 * {@link ManualStep} when the token is absent — an unconfigured optional service
 * should not block the graph.
 */
import { request, requireJson } from "../http";
import type { Ctx, Driver } from "../driver";
import type { ManualStep, PlanStep, VerifyResult } from "../types";

const API = "https://api.sent.dm/v3";

/** Delivery lifecycle plus inbound. Template events are not consumed by the app. */
const EVENT_TYPES = [
  "message.queued",
  "message.scheduled",
  "message.routed",
  "message.sent",
  "message.delivered",
  "message.read",
  "message.filtered",
  "message.blocked",
  "message.failed",
  "message.received",
];

const displayName = (ctx: Ctx) => `${ctx.product}-${ctx.env}`;

/** Where Sent will POST. Mirrors the route at `api/src/app/api/webhooks/sent`. */
function endpointUrl(ctx: Ctx): string | undefined {
  const domain = ctx.manifest.domain;
  return domain === undefined ? undefined : `https://${domain}/api/webhooks/sent`;
}

const apiKey = (ctx: Ctx) => ctx.credentials["SENT_DM_API_KEY"];

const auth = (ctx: Ctx) => ({ "x-api-key": apiKey(ctx) ?? "" });

interface WebhookEndpoint {
  readonly id?: string;
  readonly display_name?: string;
  readonly endpoint_url?: string;
  readonly is_active?: boolean;
  readonly signing_secret?: string | null;
}

function manualSetup(ctx: Ctx): ManualStep {
  return {
    id: "sent",
    title: "Create the Sent.dm webhook endpoint",
    url: "https://app.sent.dm/settings/webhooks",
    instructions: [
      "Sign in to the Sent dashboard and open Settings → Webhooks.",
      `Add an endpoint named "${displayName(ctx)}" pointing at ${
        endpointUrl(ctx) ?? "https://<your-domain>/api/webhooks/sent"
      }.`,
      "Subscribe it to every message.* event, including message.received.",
      "Copy the signing secret (it starts with whsec_ and is shown only once).",
      "Copy an API key from Settings → API Keys.",
    ],
    provides: [
      { key: "SENT_DM_API_KEY", surfaces: ["api"] },
      { key: "SENT_DM_WEBHOOK_SECRET", surfaces: ["api"] },
    ],
  };
}

async function findEndpoint(ctx: Ctx): Promise<WebhookEndpoint | undefined> {
  const url = endpointUrl(ctx);
  if (url === undefined) return undefined;

  const list = await request<{ data?: { webhooks?: readonly WebhookEndpoint[] } }>(
    `${API}/webhooks`,
    { driver: "sent", headers: auth(ctx), allowStatus: [401, 403, 404] },
  );

  return list?.data?.webhooks?.find(
    (hook) => hook.endpoint_url === url || hook.display_name === displayName(ctx),
  );
}

export const sentDriver: Driver = {
  id: "sent",
  dependsOn: [],
  outputs: [
    { key: "SENT_DM_API_KEY", surfaces: ["api"] },
    { key: "SENT_DM_WEBHOOK_SECRET", surfaces: ["api"] },
  ],
  // Intentionally empty: an absent token degrades to a manual step, see above.
  credentials: [],

  resourceName: (ctx) => displayName(ctx),

  async plan(ctx): Promise<readonly PlanStep[]> {
    if (ctx.manifest.services.sent === false) return [];

    if (apiKey(ctx) === undefined) {
      return [
        { action: "noop", resource: "Sent.dm webhook", detail: "manual — no SENT_DM_API_KEY set" },
      ];
    }

    const url = endpointUrl(ctx);
    if (url === undefined) {
      return [
        { action: "noop", resource: "Sent.dm webhook", detail: "manual — manifest has no domain" },
      ];
    }

    const existing = await findEndpoint(ctx);
    return [
      {
        action: existing ? "noop" : "create",
        resource: `Sent.dm webhook "${displayName(ctx)}"`,
        detail: existing ? url : `${url} — signing secret shown once`,
      },
    ];
  },

  async apply(ctx) {
    if (ctx.manifest.services.sent === false) return {};
    if (ctx.dryRun) return {};

    const key = apiKey(ctx);
    const url = endpointUrl(ctx);
    if (key === undefined || url === undefined) {
      return { manualSteps: [manualSetup(ctx)] };
    }

    const existing = await findEndpoint(ctx);
    if (existing) {
      ctx.logger.debug(`Sent webhook ${displayName(ctx)} already exists; leaving it alone`);
      return {
        statePatch: { webhookId: existing.id, endpointUrl: existing.endpoint_url },
        // The secret is unreadable after creation, so only the API key is re-emitted.
        secrets: { SENT_DM_API_KEY: key },
      };
    }

    const created = await requireJson<{ data?: WebhookEndpoint }>(`${API}/webhooks`, {
      method: "POST",
      driver: "sent",
      headers: { ...auth(ctx), "Idempotency-Key": `factory-${displayName(ctx)}` },
      body: {
        display_name: displayName(ctx),
        endpoint_url: url,
        event_types: EVENT_TYPES,
      },
    });

    const hook = created.data;
    const secret = hook?.signing_secret ?? undefined;
    ctx.logger.info(`  created Sent webhook ${displayName(ctx)} → ${url}`);

    return {
      statePatch: { webhookId: hook?.id, endpointUrl: hook?.endpoint_url ?? url },
      secrets: {
        SENT_DM_API_KEY: key,
        ...(secret !== undefined ? { SENT_DM_WEBHOOK_SECRET: secret } : {}),
      },
      // Creation without a returned secret is recoverable only by rotating it.
      manualSteps: secret === undefined ? [manualSetup(ctx)] : undefined,
    };
  },

  async verify(ctx): Promise<VerifyResult> {
    if (ctx.manifest.services.sent === false) return { ok: true, message: "sent disabled" };

    const missing = ["SENT_DM_API_KEY", "SENT_DM_WEBHOOK_SECRET"].filter(
      (name) => typeof ctx.outputs[name] !== "string",
    );
    if (missing.length > 0) {
      return { ok: false, message: "Sent credentials not set", missing };
    }

    if (apiKey(ctx) === undefined) {
      return { ok: true, message: "credentials present (endpoint managed manually)" };
    }

    const existing = await findEndpoint(ctx);
    if (!existing) {
      return { ok: false, message: `no Sent webhook pointing at ${endpointUrl(ctx) ?? "?"}` };
    }

    return existing.is_active === false
      ? { ok: false, message: `webhook ${displayName(ctx)} is disabled` }
      : { ok: true, message: `webhook ${displayName(ctx)} active` };
  },

  async destroy(ctx) {
    if (apiKey(ctx) === undefined) return;

    const recorded = ctx.state.environments[ctx.env]?.["sent"]?.["webhookId"];
    const id = typeof recorded === "string" ? recorded : (await findEndpoint(ctx))?.id;
    if (id === undefined) return;

    await request(`${API}/webhooks/${id}`, {
      method: "DELETE",
      driver: "sent",
      headers: auth(ctx),
      allowStatus: [404],
    });
    ctx.logger.info(`  deleted Sent webhook ${displayName(ctx)}`);
  },
};
