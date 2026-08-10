/**
 * Anthropic — a Workspace per product, created through the Admin API.
 *
 * The workspace is automatable; the **API key is not**. Anthropic's Admin API can
 * create and list workspaces, but keys can only be minted in the Console. So this
 * driver creates the workspace to keep usage and limits separated per product, then
 * asks for a key scoped to it.
 *
 * `ANTHROPIC_ADMIN_KEY` is optional: without it the driver still emits the manual
 * step, it just cannot pre-create the workspace.
 */
import { request, requireJson } from "../http";
import type { Ctx, Driver } from "../driver";
import type { ManualStep, PlanStep, VerifyResult } from "../types";

const API = "https://api.anthropic.com/v1";
const ADMIN_VERSION = "2023-06-01";

const workspaceName = (ctx: Ctx) => `${ctx.manifest.displayName} (${ctx.env})`;

interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly archived_at: string | null;
}

function adminHeaders(ctx: Ctx): Record<string, string> {
  return {
    "x-api-key": ctx.credentials["ANTHROPIC_ADMIN_KEY"] ?? "",
    "anthropic-version": ADMIN_VERSION,
  };
}

const hasAdminKey = (ctx: Ctx) => (ctx.credentials["ANTHROPIC_ADMIN_KEY"] ?? "").trim() !== "";

async function findWorkspace(ctx: Ctx): Promise<Workspace | undefined> {
  if (!hasAdminKey(ctx)) return undefined;

  const list = await request<{ data: readonly Workspace[] }>(`${API}/organizations/workspaces`, {
    driver: "anthropic",
    headers: adminHeaders(ctx),
    query: { limit: 100 },
    allowStatus: [401, 403, 404],
  });

  return list?.data.find((w) => w.name === workspaceName(ctx) && w.archived_at === null);
}

function keyStep(ctx: Ctx, workspaceId?: string): ManualStep {
  const url =
    workspaceId === undefined
      ? "https://console.anthropic.com/settings/keys"
      : `https://console.anthropic.com/settings/workspaces/${workspaceId}/keys`;

  return {
    id: "anthropic-key",
    title: `Create an Anthropic API key for "${workspaceName(ctx)}"`,
    url,
    instructions: [
      "Anthropic API keys cannot be created through the API — only in the Console.",
      workspaceId === undefined
        ? `Create a workspace named "${workspaceName(ctx)}" first.`
        : `Open the workspace "${workspaceName(ctx)}" (already created by the factory).`,
      "Create a key scoped to that workspace so its spend is tracked separately.",
      `Add it to Infisical under ${ctx.product} / ${ctx.env} / api as ANTHROPIC_API_KEY.`,
    ],
    provides: [{ key: "ANTHROPIC_API_KEY", surfaces: ["api"] }],
  };
}

export const anthropicDriver: Driver = {
  id: "anthropic",
  dependsOn: [],
  outputs: [{ key: "ANTHROPIC_API_KEY", surfaces: ["api"] }],
  // Optional by design — see the module comment.
  credentials: [],

  resourceName: (ctx) => workspaceName(ctx),

  async plan(ctx): Promise<readonly PlanStep[]> {
    if (!hasAdminKey(ctx)) {
      return [
        {
          action: "create",
          resource: `Anthropic workspace "${workspaceName(ctx)}"`,
          detail: "MANUAL — no ANTHROPIC_ADMIN_KEY in .env.factory",
        },
      ];
    }

    const existing = await findWorkspace(ctx);
    return [
      {
        action: existing ? "noop" : "create",
        resource: `Anthropic workspace "${workspaceName(ctx)}"`,
      },
      {
        action: ctx.outputs["ANTHROPIC_API_KEY"] === undefined ? "create" : "noop",
        resource: "Anthropic API key",
        detail: "MANUAL — console only",
      },
    ];
  },

  async apply(ctx) {
    const alreadyKeyed = ctx.outputs["ANTHROPIC_API_KEY"] !== undefined;

    if (!hasAdminKey(ctx)) {
      return alreadyKeyed ? {} : { manualSteps: [keyStep(ctx)] };
    }
    if (ctx.dryRun) return {};

    let workspace = await findWorkspace(ctx);

    if (!workspace) {
      workspace = await requireJson<Workspace>(`${API}/organizations/workspaces`, {
        method: "POST",
        driver: "anthropic",
        headers: adminHeaders(ctx),
        body: { name: workspaceName(ctx) },
      });
      ctx.logger.info(`  created Anthropic workspace ${workspace.name} (${workspace.id})`);
    }

    return {
      statePatch: { workspaceId: workspace.id, workspaceName: workspace.name },
      ...(alreadyKeyed ? {} : { manualSteps: [keyStep(ctx, workspace.id)] }),
    };
  },

  async verify(ctx): Promise<VerifyResult> {
    const key = ctx.outputs["ANTHROPIC_API_KEY"];
    if (key === undefined) {
      return {
        ok: false,
        message: "awaiting manual step; ANTHROPIC_API_KEY not set",
        missing: ["ANTHROPIC_API_KEY"],
      };
    }

    // Cheapest authenticated call that proves the key is live.
    await requireJson(`${API}/models`, {
      driver: "anthropic",
      headers: { "x-api-key": key, "anthropic-version": ADMIN_VERSION },
      query: { limit: 1 },
    });

    return { ok: true, message: "Anthropic API key authenticates" };
  },

  async destroy(ctx) {
    const recorded = ctx.state.environments[ctx.env]?.["anthropic"]?.["workspaceId"];
    if (typeof recorded !== "string" || !hasAdminKey(ctx)) return;

    // Workspaces archive rather than delete.
    await request(`${API}/organizations/workspaces/${recorded}/archive`, {
      method: "POST",
      driver: "anthropic",
      headers: adminHeaders(ctx),
      allowStatus: [404, 409],
    });
    ctx.logger.info(`  archived Anthropic workspace ${recorded}`);
  },
};
