/**
 * PostHog — one project per product+environment.
 *
 * The project's `api_token` is the write key both the web and native SDKs use, so a
 * single created resource feeds two env vars.
 */
import { request, requireJson } from "../http";
import type { Ctx, Driver } from "../driver";
import type { PlanStep, VerifyResult } from "../types";

/** The management API lives on the app host, not the ingestion host. */
const API = "https://us.posthog.com";

const projectName = (ctx: Ctx) => `${ctx.manifest.displayName} (${ctx.env})`;

interface Project {
  readonly id: number;
  readonly name: string;
  readonly api_token: string;
}

interface Paginated<T> {
  readonly results: readonly T[];
}

const auth = (ctx: Ctx) => ({
  authorization: `Bearer ${ctx.credentials["POSTHOG_PERSONAL_API_KEY"]}`,
});

const orgId = (ctx: Ctx) => ctx.credentials["POSTHOG_ORG_ID"] ?? "@current";

/**
 * PostHog has no lookup-by-name endpoint, so list and match. Falls back to the id
 * recorded in state, which survives a rename.
 */
async function findProject(ctx: Ctx): Promise<Project | undefined> {
  const recordedId = ctx.state.environments[ctx.env]?.["posthog"]?.["projectId"];

  if (typeof recordedId === "number") {
    const byId = await request<Project>(`${API}/api/projects/${recordedId}/`, {
      driver: "posthog",
      headers: auth(ctx),
      allowStatus: [404],
    });
    if (byId) return byId;
  }

  const list = await request<Paginated<Project>>(
    `${API}/api/organizations/${orgId(ctx)}/projects/`,
    { driver: "posthog", headers: auth(ctx), allowStatus: [404] },
  );

  return list?.results.find((p) => p.name === projectName(ctx));
}

export const posthogDriver: Driver = {
  id: "posthog",
  dependsOn: [],
  outputs: [
    { key: "NEXT_PUBLIC_POSTHOG_KEY", surfaces: ["api"] },
    { key: "NEXT_PUBLIC_POSTHOG_HOST", surfaces: ["api"] },
    { key: "EXPO_PUBLIC_POSTHOG_KEY", surfaces: ["mobile"] },
    { key: "EXPO_PUBLIC_POSTHOG_HOST", surfaces: ["mobile"] },
  ],
  credentials: ["POSTHOG_PERSONAL_API_KEY"],

  resourceName: (ctx) => projectName(ctx),

  async plan(ctx): Promise<readonly PlanStep[]> {
    const existing = await findProject(ctx);
    return [
      {
        action: existing ? "noop" : "create",
        resource: `PostHog project "${projectName(ctx)}"`,
      },
    ];
  },

  async apply(ctx) {
    const config = ctx.manifest.services.posthog;
    if (config === false) return {};
    if (ctx.dryRun) return {};

    let project = await findProject(ctx);

    if (!project) {
      project = await requireJson<Project>(`${API}/api/organizations/${orgId(ctx)}/projects/`, {
        method: "POST",
        driver: "posthog",
        headers: auth(ctx),
        body: { name: projectName(ctx) },
      });
      ctx.logger.info(`  created PostHog project ${project.name} (${project.id})`);
    }

    return {
      statePatch: { projectId: project.id, projectName: project.name },
      secrets: {
        NEXT_PUBLIC_POSTHOG_KEY: project.api_token,
        NEXT_PUBLIC_POSTHOG_HOST: config.host,
        EXPO_PUBLIC_POSTHOG_KEY: project.api_token,
        EXPO_PUBLIC_POSTHOG_HOST: config.host,
      },
    };
  },

  async verify(ctx): Promise<VerifyResult> {
    const project = await findProject(ctx);
    return project
      ? { ok: true, message: `project ${project.name} (${project.id}) reachable` }
      : { ok: false, message: `PostHog project "${projectName(ctx)}" not found` };
  },

  async destroy(ctx) {
    const project = await findProject(ctx);
    if (!project) return;

    await request(`${API}/api/projects/${project.id}/`, {
      method: "DELETE",
      driver: "posthog",
      headers: auth(ctx),
      allowStatus: [404],
    });
    ctx.logger.info(`  deleted PostHog project ${project.name}`);
  },
};
