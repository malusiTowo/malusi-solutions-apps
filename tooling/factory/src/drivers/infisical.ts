/**
 * Infisical — the per-product secret project every other driver writes into.
 *
 * One Infisical project per product, with the standard `dev`/`preview`/`prod`
 * environments and a folder per surface (`/api`, `/mobile`). That shape is what lets
 * two products keep identically-named variables — `DATABASE_URL` means one thing
 * inside `acme` and another inside `habitual` — which in turn is why nothing in
 * `packages/*` needs to know a product exists.
 *
 * Runs first: it produces no secrets of its own, but every other driver's output is
 * pushed into the project it creates.
 */
import { infisicalLogin, INFISICAL_HOST, SURFACE_PATH } from "../secrets";
import { request, requireJson } from "../http";
import type { Ctx, Driver } from "../driver";
import type { PlanStep, VerifyResult } from "../types";

interface Project {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

async function bearer(ctx: Ctx): Promise<string> {
  return infisicalLogin(
    ctx.credentials["INFISICAL_CLIENT_ID"] ?? "",
    ctx.credentials["INFISICAL_CLIENT_SECRET"] ?? "",
  );
}

async function findProject(ctx: Ctx, token: string): Promise<Project | undefined> {
  const orgId = ctx.credentials["INFISICAL_ORG_ID"];
  const headers = { authorization: `Bearer ${token}` };

  const list = await request<{ workspaces?: readonly Project[]; projects?: readonly Project[] }>(
    `${INFISICAL_HOST}/api/v2/organizations/${orgId}/workspaces`,
    { driver: "infisical", headers, allowStatus: [404] },
  );

  const projects = list?.workspaces ?? list?.projects ?? [];
  return projects.find((p) => p.slug === ctx.product || p.name === ctx.product);
}

/** Create `/api` and `/mobile` so drivers can write into them immediately. */
async function ensureFolders(ctx: Ctx, token: string, projectId: string): Promise<void> {
  const headers = { authorization: `Bearer ${token}` };

  for (const path of Object.values(SURFACE_PATH)) {
    await request(`${INFISICAL_HOST}/api/v1/folders`, {
      method: "POST",
      driver: "infisical",
      headers,
      body: {
        workspaceId: projectId,
        environment: ctx.env,
        name: path.replace("/", ""),
        path: "/",
      },
      // Already-exists is the normal case on re-apply.
      allowStatus: [400, 409],
    });
  }
}

export const infisicalDriver: Driver = {
  id: "infisical",
  dependsOn: [],
  outputs: [],
  credentials: ["INFISICAL_CLIENT_ID", "INFISICAL_CLIENT_SECRET", "INFISICAL_ORG_ID"],

  resourceName: (ctx) => ctx.product,

  async plan(ctx): Promise<readonly PlanStep[]> {
    const token = await bearer(ctx);
    const existing = await findProject(ctx, token);

    return [
      {
        action: existing ? "noop" : "create",
        resource: `Infisical project "${ctx.product}"`,
        detail: existing ? existing.id : "environments dev/preview/prod",
      },
      {
        action: "update",
        resource: `Infisical folders ${Object.values(SURFACE_PATH).join(", ")} (${ctx.env})`,
      },
    ];
  },

  async apply(ctx) {
    if (ctx.dryRun) return {};

    const token = await bearer(ctx);
    let project = await findProject(ctx, token);

    if (!project) {
      const created = await requireJson<{ project: Project }>(`${INFISICAL_HOST}/api/v1/projects`, {
        method: "POST",
        driver: "infisical",
        headers: { authorization: `Bearer ${token}` },
        body: {
          projectName: ctx.product,
          slug: ctx.product,
          projectDescription: `Secrets for ${ctx.manifest.displayName}`,
          organizationId: ctx.credentials["INFISICAL_ORG_ID"],
          shouldCreateDefaultEnvs: true,
        },
      });
      project = created.project;
      ctx.logger.info(`  created Infisical project ${project.slug} (${project.id})`);
    }

    await ensureFolders(ctx, token, project.id);

    return { statePatch: { projectId: project.id, slug: project.slug } };
  },

  async verify(ctx): Promise<VerifyResult> {
    const token = await bearer(ctx);
    const project = await findProject(ctx, token);

    return project
      ? { ok: true, message: `project ${project.slug} (${project.id}) reachable` }
      : { ok: false, message: `Infisical project "${ctx.product}" not found` };
  },

  async destroy(ctx) {
    const token = await bearer(ctx);
    const project = await findProject(ctx, token);
    if (!project) return;

    await request(`${INFISICAL_HOST}/api/v1/projects/${project.id}`, {
      method: "DELETE",
      driver: "infisical",
      headers: { authorization: `Bearer ${token}` },
      allowStatus: [404],
    });
    ctx.logger.info(`  deleted Infisical project ${project.slug}`);
  },
};
