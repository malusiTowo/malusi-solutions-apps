/**
 * Vercel — the project that hosts the product's Next.js api app.
 *
 * Depends on `github` (a project is linked to a repo at creation) and on every driver
 * that produces a server-side secret, because those get pushed into the project's env
 * as part of this driver's apply. That ordering is what makes a `git push` deploy a
 * fully-configured app rather than one that boots with empty keys.
 */
import { GITHUB_ORG } from "./github";
import { pushToVercel } from "../secrets";
import { request, requireJson } from "../http";
import type { Ctx, Driver } from "../driver";
import type { PlanStep, VerifyResult } from "../types";

const API = "https://api.vercel.com";

/** One Vercel project per product+environment, so previews never share prod config. */
const projectName = (ctx: Ctx) => `${ctx.product}-${ctx.env}`;

interface Project {
  readonly id: string;
  readonly name: string;
  readonly link?: { readonly type?: string; readonly repo?: string };
}

interface DomainResponse {
  readonly name: string;
  readonly verified: boolean;
}

const auth = (ctx: Ctx) => ({ authorization: `Bearer ${ctx.credentials["VERCEL_TOKEN"]}` });
const team = (ctx: Ctx) => ctx.credentials["VERCEL_TEAM_ID"];

async function findProject(ctx: Ctx): Promise<Project | undefined> {
  return request<Project>(`${API}/v9/projects/${projectName(ctx)}`, {
    driver: "vercel",
    headers: auth(ctx),
    query: { teamId: team(ctx) },
    allowStatus: [404],
  });
}

/** Production hostname, falling back to Vercel's generated one. */
function productionUrl(ctx: Ctx): string {
  const domain = ctx.manifest.domain;
  if (domain !== undefined && ctx.env === "prod") return `https://${domain}`;
  if (domain !== undefined) return `https://${ctx.env}.${domain}`;
  return `https://${projectName(ctx)}.vercel.app`;
}

export const vercelDriver: Driver = {
  id: "vercel",
  // Everything that produces a server secret must land before the env push.
  dependsOn: ["github", "neon", "sentry", "posthog", "resend"],
  outputs: [
    { key: "NEXT_PUBLIC_APP_URL", surfaces: ["api"] },
    { key: "EXPO_PUBLIC_API_URL", surfaces: ["mobile"] },
  ],
  credentials: ["VERCEL_TOKEN"],

  resourceName: (ctx) => projectName(ctx),

  async plan(ctx): Promise<readonly PlanStep[]> {
    const existing = await findProject(ctx);
    const steps: PlanStep[] = [
      {
        action: existing ? "noop" : "create",
        resource: `Vercel project "${projectName(ctx)}"`,
        detail: `linked to ${GITHUB_ORG}/${ctx.product}`,
      },
      {
        action: "update",
        resource: `Vercel env vars for ${projectName(ctx)}`,
        detail: `${Object.keys(ctx.outputs).length} upstream values`,
      },
    ];

    if (ctx.manifest.domain !== undefined) {
      steps.push({
        action: "create",
        resource: `Vercel domain ${new URL(productionUrl(ctx)).host}`,
      });
    }

    return steps;
  },

  async apply(ctx) {
    const config = ctx.manifest.services.vercel;
    if (config === false) return {};
    if (ctx.dryRun) return {};

    let project = await findProject(ctx);

    if (!project) {
      project = await requireJson<Project>(`${API}/v11/projects`, {
        method: "POST",
        driver: "vercel",
        headers: auth(ctx),
        query: { teamId: team(ctx) },
        body: {
          name: projectName(ctx),
          framework: config.framework,
          // Monorepo: build only this product's api app.
          rootDirectory: config.rootDirectory ?? `apps/${ctx.product}/api`,
          gitRepository: { type: "github", repo: `${GITHUB_ORG}/${ctx.product}` },
          installCommand: "pnpm install --frozen-lockfile",
          buildCommand: `pnpm exec vp run --filter @${ctx.product}/api build`,
        },
      });
      ctx.logger.info(`  created Vercel project ${project.name} (${project.id})`);
    }

    const appUrl = productionUrl(ctx);

    // Push everything upstream drivers produced, plus this driver's own outputs, so a
    // deploy has the same configuration the local .env does.
    const envPayload = { ...ctx.outputs, NEXT_PUBLIC_APP_URL: appUrl };
    const pushed = await pushToVercel({
      token: ctx.credentials["VERCEL_TOKEN"] ?? "",
      teamId: team(ctx),
      projectId: project.id,
      environment: ctx.env,
      secrets: envPayload,
      logger: ctx.logger,
    });
    ctx.logger.info(`  pushed ${pushed} env vars to Vercel`);

    if (ctx.manifest.domain !== undefined) {
      const host = new URL(appUrl).host;
      await request(`${API}/v10/projects/${project.id}/domains`, {
        method: "POST",
        driver: "vercel",
        headers: auth(ctx),
        query: { teamId: team(ctx) },
        body: { name: host },
        allowStatus: [409],
      });
      ctx.logger.debug(`domain ${host} attached`);
    }

    return {
      statePatch: { projectId: project.id, projectName: project.name, productionUrl: appUrl },
      secrets: {
        NEXT_PUBLIC_APP_URL: appUrl,
        // The mobile app talks to this deployment.
        EXPO_PUBLIC_API_URL: appUrl,
      },
    };
  },

  async verify(ctx): Promise<VerifyResult> {
    const project = await findProject(ctx);
    if (!project) return { ok: false, message: `Vercel project "${projectName(ctx)}" not found` };

    const linked = project.link?.repo;
    if (linked === undefined) {
      return { ok: false, message: `project ${project.name} is not linked to a git repo` };
    }

    if (ctx.manifest.domain !== undefined) {
      const host = new URL(productionUrl(ctx)).host;
      const domain = await request<DomainResponse>(
        `${API}/v9/projects/${project.id}/domains/${host}`,
        {
          driver: "vercel",
          headers: auth(ctx),
          query: { teamId: team(ctx) },
          allowStatus: [404],
        },
      );
      if (domain !== undefined && !domain.verified) {
        return { ok: false, message: `domain ${host} attached but not verified (check DNS)` };
      }
    }

    return { ok: true, message: `project ${project.name} linked to ${linked}` };
  },

  async destroy(ctx) {
    const project = await findProject(ctx);
    if (!project) return;

    await request(`${API}/v9/projects/${project.id}`, {
      method: "DELETE",
      driver: "vercel",
      headers: auth(ctx),
      query: { teamId: team(ctx) },
      allowStatus: [404],
    });
    ctx.logger.info(`  deleted Vercel project ${project.name}`);
  },
};
