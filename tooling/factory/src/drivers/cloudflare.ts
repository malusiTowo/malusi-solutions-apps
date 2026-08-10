/**
 * Cloudflare DNS — publishes the records other drivers need to exist.
 *
 * Two sources feed it:
 *  - Resend's domain verification records (DKIM, SPF, DMARC), read from the resend
 *    driver's state patch.
 *  - A CNAME pointing the product's hostname at Vercel.
 *
 * This is why it runs last: it is the driver that makes the others actually work.
 */
import { request, requireJson } from "../http";
import type { Ctx, Driver } from "../driver";
import type { DnsRecord } from "./resend";
import type { PlanStep, VerifyResult } from "../types";

const API = "https://api.cloudflare.com/client/v4";

/** Where Vercel wants apex and subdomain records pointed. */
const VERCEL_CNAME = "cname.vercel-dns.com";

interface Zone {
  readonly id: string;
  readonly name: string;
}

interface Record_ {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly content: string;
}

interface Envelope<T> {
  readonly result: T;
  readonly success: boolean;
}

const auth = (ctx: Ctx) => ({
  authorization: `Bearer ${ctx.credentials["CLOUDFLARE_API_TOKEN"]}`,
});

async function findZone(ctx: Ctx): Promise<Zone | undefined> {
  const config = ctx.manifest.services.cloudflare;
  if (config === false) return undefined;

  const result = await request<Envelope<readonly Zone[]>>(`${API}/zones`, {
    driver: "cloudflare",
    headers: auth(ctx),
    query: { name: config.zone },
  });

  return result?.result[0];
}

/** Records this product needs: Resend verification plus the Vercel CNAME. */
function desiredRecords(
  ctx: Ctx,
): { type: string; name: string; content: string; priority?: number }[] {
  const wanted: { type: string; name: string; content: string; priority?: number }[] = [];

  const fromResend = ctx.state.environments[ctx.env]?.["resend"]?.["dnsRecords"];
  if (Array.isArray(fromResend)) {
    for (const record of fromResend as readonly DnsRecord[]) {
      wanted.push({
        type: record.type,
        name: record.name,
        content: record.value,
        ...(record.priority !== undefined ? { priority: record.priority } : {}),
      });
    }
  }

  if (ctx.manifest.domain !== undefined) {
    const host = ctx.env === "prod" ? ctx.manifest.domain : `${ctx.env}.${ctx.manifest.domain}`;
    wanted.push({ type: "CNAME", name: host, content: VERCEL_CNAME });
  }

  return wanted;
}

async function existingRecords(ctx: Ctx, zoneId: string): Promise<readonly Record_[]> {
  const result = await request<Envelope<readonly Record_[]>>(`${API}/zones/${zoneId}/dns_records`, {
    driver: "cloudflare",
    headers: auth(ctx),
    query: { per_page: 500 },
  });
  return result?.result ?? [];
}

export const cloudflareDriver: Driver = {
  id: "cloudflare",
  // Needs Resend's verification records, and knows where Vercel expects the CNAME.
  dependsOn: ["resend"],
  outputs: [],
  credentials: ["CLOUDFLARE_API_TOKEN"],

  resourceName: (ctx) => {
    const config = ctx.manifest.services.cloudflare;
    return config === false ? ctx.product : config.zone;
  },

  async plan(ctx): Promise<readonly PlanStep[]> {
    const config = ctx.manifest.services.cloudflare;
    if (config === false) return [];

    const zone = await findZone(ctx);
    if (!zone) return [{ action: "create", resource: `zone ${config.zone}`, detail: "NOT FOUND" }];

    const current = await existingRecords(ctx, zone.id);
    return desiredRecords(ctx).map((record) => {
      const match = current.find((r) => r.type === record.type && r.name === record.name);
      return {
        action: match ? (match.content === record.content ? "noop" : "update") : "create",
        resource: `${record.type} ${record.name}`,
        detail: record.content.slice(0, 60),
      };
    });
  },

  async apply(ctx) {
    const config = ctx.manifest.services.cloudflare;
    if (config === false) return {};
    if (ctx.dryRun) return {};

    const zone = await findZone(ctx);
    if (!zone) {
      // A missing zone is an operator problem, not something to create silently.
      return {
        manualSteps: [
          {
            id: "cloudflare-zone",
            title: `Add the zone ${config.zone} to Cloudflare`,
            url: "https://dash.cloudflare.com/",
            instructions: [
              `Add ${config.zone} as a zone in Cloudflare.`,
              "Point the registrar's nameservers at the ones Cloudflare assigns.",
              `Re-run \`pnpm factory apply ${ctx.product}\`.`,
            ],
            provides: [],
          },
        ],
      };
    }

    const current = await existingRecords(ctx, zone.id);
    const written: string[] = [];

    for (const record of desiredRecords(ctx)) {
      const match = current.find((r) => r.type === record.type && r.name === record.name);

      if (match !== undefined && match.content === record.content) {
        ctx.logger.debug(`${record.type} ${record.name} already correct`);
        continue;
      }

      const body = { ...record, ttl: 1, proxied: false };

      if (match !== undefined) {
        await requireJson(`${API}/zones/${zone.id}/dns_records/${match.id}`, {
          method: "PUT",
          driver: "cloudflare",
          headers: auth(ctx),
          body,
        });
      } else {
        await requireJson(`${API}/zones/${zone.id}/dns_records`, {
          method: "POST",
          driver: "cloudflare",
          headers: auth(ctx),
          body,
        });
      }

      written.push(`${record.type} ${record.name}`);
    }

    if (written.length > 0) ctx.logger.info(`  wrote ${written.length} DNS record(s)`);

    return { statePatch: { zoneId: zone.id, zoneName: zone.name, managedRecords: written } };
  },

  async verify(ctx): Promise<VerifyResult> {
    const config = ctx.manifest.services.cloudflare;
    if (config === false) return { ok: true, message: "cloudflare disabled" };

    const zone = await findZone(ctx);
    if (!zone) return { ok: false, message: `zone ${config.zone} not found` };

    const current = await existingRecords(ctx, zone.id);
    const missing = desiredRecords(ctx)
      .filter((d) => !current.some((r) => r.type === d.type && r.name === d.name))
      .map((d) => `${d.type} ${d.name}`);

    return missing.length === 0
      ? { ok: true, message: `zone ${zone.name}: all records present` }
      : { ok: false, message: `missing records: ${missing.join(", ")}` };
  },

  async destroy(ctx) {
    const zone = await findZone(ctx);
    if (!zone) return;

    const current = await existingRecords(ctx, zone.id);
    const managed = new Set(desiredRecords(ctx).map((d) => `${d.type} ${d.name}`));

    for (const record of current) {
      if (!managed.has(`${record.type} ${record.name}`)) continue;
      await request(`${API}/zones/${zone.id}/dns_records/${record.id}`, {
        method: "DELETE",
        driver: "cloudflare",
        headers: auth(ctx),
        allowStatus: [404],
      });
    }

    ctx.logger.info(`  removed managed DNS records from ${zone.name}`);
  },
};
