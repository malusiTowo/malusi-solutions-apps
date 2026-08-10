/**
 * Resend — a verified sending domain plus a domain-scoped API key.
 *
 * The created key is returned **once**, at creation. There is no read-back, so the
 * driver forwards it straight into `secrets` and records only the key's id in state.
 * If the local `.env` is lost, recovery is rotation, not retrieval.
 *
 * Domain creation returns the DNS records that must exist for verification; the
 * cloudflare driver consumes them, which is why it depends on this one.
 */
import { request, requireJson } from "../http";
import type { Ctx, Driver } from "../driver";
import type { PlanStep, VerifyResult } from "../types";

const API = "https://api.resend.com";

interface DnsRecord {
  readonly record: string;
  readonly name: string;
  readonly type: string;
  readonly value: string;
  readonly ttl?: string;
  readonly priority?: number;
}

interface Domain {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly records?: readonly DnsRecord[];
}

interface ApiKey {
  readonly id: string;
  readonly token: string;
}

const auth = (ctx: Ctx) => ({ authorization: `Bearer ${ctx.credentials["RESEND_API_KEY"]}` });

/** The sending domain is derived from the manifest's From address. */
function sendingDomain(ctx: Ctx): string | undefined {
  const config = ctx.manifest.services.resend;
  if (config === false) return undefined;
  return config.from.split("@")[1];
}

const keyName = (ctx: Ctx) => `${ctx.product}-${ctx.env}`;

async function findDomain(ctx: Ctx): Promise<Domain | undefined> {
  const name = sendingDomain(ctx);
  if (name === undefined) return undefined;

  const list = await request<{ data: readonly Domain[] }>(`${API}/domains`, {
    driver: "resend",
    headers: auth(ctx),
    allowStatus: [404],
  });

  const match = list?.data.find((d) => d.name === name);
  if (!match) return undefined;

  // The list response omits DNS records; fetch the full object for them.
  return request<Domain>(`${API}/domains/${match.id}`, {
    driver: "resend",
    headers: auth(ctx),
    allowStatus: [404],
  });
}

export const resendDriver: Driver = {
  id: "resend",
  dependsOn: [],
  outputs: [
    { key: "RESEND_API_KEY", surfaces: ["api"] },
    { key: "RESEND_FROM", surfaces: ["api"] },
  ],
  credentials: ["RESEND_API_KEY"],

  resourceName: (ctx) => sendingDomain(ctx) ?? ctx.product,

  async plan(ctx): Promise<readonly PlanStep[]> {
    const config = ctx.manifest.services.resend;
    if (config === false) return [];

    const existing = await findDomain(ctx);
    return [
      {
        action: existing ? "noop" : "create",
        resource: `Resend domain ${sendingDomain(ctx)}`,
        detail: existing ? `status: ${existing.status}` : "DNS records published via Cloudflare",
      },
      {
        action: "create",
        resource: `Resend API key "${keyName(ctx)}"`,
        detail: "scoped to the sending domain; token shown once",
      },
    ];
  },

  async apply(ctx) {
    const config = ctx.manifest.services.resend;
    if (config === false) return {};
    if (ctx.dryRun) return {};

    let domain = await findDomain(ctx);

    if (!domain) {
      domain = await requireJson<Domain>(`${API}/domains`, {
        method: "POST",
        driver: "resend",
        headers: auth(ctx),
        body: { name: sendingDomain(ctx) },
      });
      ctx.logger.info(`  created Resend domain ${domain.name}`);
    }

    // Reuse an existing key rather than accumulating one per apply — but the token is
    // unreadable after creation, so only create when we have nowhere to get it from.
    const recordedKeyId = ctx.state.environments[ctx.env]?.["resend"]?.["apiKeyId"];
    const alreadyHaveToken = typeof ctx.outputs["RESEND_API_KEY"] === "string";

    let token: string | undefined;
    let apiKeyId = typeof recordedKeyId === "string" ? recordedKeyId : undefined;

    if (apiKeyId === undefined || !alreadyHaveToken) {
      const created = await requireJson<ApiKey>(`${API}/api-keys`, {
        method: "POST",
        driver: "resend",
        headers: auth(ctx),
        body: { name: keyName(ctx), permission: "sending_access", domain_id: domain.id },
      });
      token = created.token;
      apiKeyId = created.id;
      ctx.logger.info(`  created Resend API key ${keyName(ctx)}`);
    }

    return {
      statePatch: {
        domainId: domain.id,
        domainName: domain.name,
        domainStatus: domain.status,
        apiKeyId,
        // Handed to the cloudflare driver, which publishes them.
        dnsRecords: domain.records ?? [],
      },
      secrets: {
        ...(token !== undefined ? { RESEND_API_KEY: token } : {}),
        RESEND_FROM: config.from,
      },
    };
  },

  async verify(ctx): Promise<VerifyResult> {
    const config = ctx.manifest.services.resend;
    if (config === false) return { ok: true, message: "resend disabled" };

    const domain = await findDomain(ctx);
    if (!domain) return { ok: false, message: `Resend domain ${sendingDomain(ctx)} not found` };

    return domain.status === "verified"
      ? { ok: true, message: `domain ${domain.name} verified` }
      : {
          ok: false,
          message: `domain ${domain.name} is "${domain.status}" — DNS may not have propagated`,
        };
  },

  async destroy(ctx) {
    const recordedKeyId = ctx.state.environments[ctx.env]?.["resend"]?.["apiKeyId"];
    if (typeof recordedKeyId === "string") {
      await request(`${API}/api-keys/${recordedKeyId}`, {
        method: "DELETE",
        driver: "resend",
        headers: auth(ctx),
        allowStatus: [404],
      });
    }

    const domain = await findDomain(ctx);
    if (domain) {
      await request(`${API}/domains/${domain.id}`, {
        method: "DELETE",
        driver: "resend",
        headers: auth(ctx),
        allowStatus: [404],
      });
      ctx.logger.info(`  deleted Resend domain ${domain.name}`);
    }
  },
};

export type { DnsRecord };
