/**
 * Neon — a serverless Postgres project per product+environment.
 *
 * A project brings its own default branch, database and owner role, so unlike a
 * cluster-per-product provider there is nothing else to create: the interesting
 * work is reading back the two connection strings the app needs.
 *
 * Both are required and they are not interchangeable. `DATABASE_URL` points at the
 * pooled endpoint, which is what a serverless function should hold; PgBouncer
 * rejects some DDL, so migrations use the direct endpoint in
 * `DATABASE_URL_UNPOOLED`.
 */
import { request, requireJson } from "../http";
import type { Ctx, Driver } from "../driver";
import { FactoryError, type PlanStep, type VerifyResult } from "../types";

const API = "https://console.neon.tech/api/v2";

const projectName = (ctx: Ctx) => `${ctx.product}-${ctx.env}`;

const auth = (ctx: Ctx) => ({ authorization: `Bearer ${ctx.credentials["NEON_API_KEY"] ?? ""}` });

interface Project {
  readonly id: string;
  readonly name: string;
  readonly region_id?: string;
  readonly pg_version?: number;
}

interface Branch {
  readonly id: string;
  readonly name: string;
  readonly default?: boolean;
}

interface Database {
  readonly name: string;
  readonly owner_name: string;
}

/**
 * Find the project by name. Neon has no lookup-by-name endpoint, so this pages
 * through the list — an account holds tens of projects, not thousands.
 */
async function findProject(ctx: Ctx): Promise<Project | undefined> {
  const name = projectName(ctx);
  let cursor: string | undefined;

  for (;;) {
    const page = await request<{ projects: readonly Project[]; pagination?: { cursor?: string } }>(
      `${API}/projects`,
      {
        driver: "neon",
        headers: auth(ctx),
        query: { limit: 100, cursor },
        allowStatus: [404],
      },
    );
    if (!page) return undefined;

    const match = page.projects.find((project) => project.name === name);
    if (match) return match;

    const next = page.pagination?.cursor;
    // Neon echoes the cursor back on the final page, so stop on a short page too.
    if (next === undefined || next === cursor || page.projects.length === 0) return undefined;
    cursor = next;
  }
}

/** The default branch's database and its owning role — what the app connects as. */
async function defaultTarget(
  ctx: Ctx,
  projectId: string,
): Promise<{ branch: Branch; database: Database }> {
  const branches = await requireJson<{ branches: readonly Branch[] }>(
    `${API}/projects/${projectId}/branches`,
    { driver: "neon", headers: auth(ctx) },
  );

  const branch = branches.branches.find((b) => b.default) ?? branches.branches[0];
  if (!branch) {
    throw new FactoryError("provider", `Neon project ${projectId} has no branches`, {
      driver: "neon",
    });
  }

  const databases = await requireJson<{ databases: readonly Database[] }>(
    `${API}/projects/${projectId}/branches/${branch.id}/databases`,
    { driver: "neon", headers: auth(ctx) },
  );

  const database = databases.databases[0];
  if (!database) {
    throw new FactoryError("provider", `Neon branch ${branch.id} has no database`, {
      driver: "neon",
    });
  }

  return { branch, database };
}

/** Ask Neon to assemble a connection string, password included. */
async function connectionUri(
  ctx: Ctx,
  projectId: string,
  branch: Branch,
  database: Database,
  pooled: boolean,
): Promise<string> {
  const result = await requireJson<{ uri: string }>(`${API}/projects/${projectId}/connection_uri`, {
    driver: "neon",
    headers: auth(ctx),
    query: {
      branch_id: branch.id,
      database_name: database.name,
      role_name: database.owner_name,
      pooled,
    },
  });
  return result.uri;
}

export const neonDriver: Driver = {
  id: "neon",
  dependsOn: [],
  outputs: [
    { key: "DATABASE_URL", surfaces: ["api"] },
    { key: "DATABASE_URL_UNPOOLED", surfaces: ["api"] },
  ],
  credentials: ["NEON_API_KEY"],

  resourceName: (ctx) => projectName(ctx),

  async plan(ctx): Promise<readonly PlanStep[]> {
    const config = ctx.manifest.services.neon;
    if (config === false) return [];

    const project = await findProject(ctx);
    return [
      {
        action: project ? "noop" : "create",
        resource: `Neon project "${projectName(ctx)}"`,
        detail: `${config.region}, Postgres ${String(config.pgVersion)}`,
      },
      {
        action: "update",
        resource: "DATABASE_URL / DATABASE_URL_UNPOOLED",
        detail: "read back from the default branch on every apply",
      },
    ];
  },

  async apply(ctx) {
    const config = ctx.manifest.services.neon;
    if (config === false) return {};
    if (ctx.dryRun) return {};

    let project = await findProject(ctx);

    if (!project) {
      const created = await requireJson<{ project: Project }>(`${API}/projects`, {
        method: "POST",
        driver: "neon",
        headers: auth(ctx),
        body: {
          project: {
            name: projectName(ctx),
            region_id: config.region,
            pg_version: config.pgVersion,
          },
        },
      });
      project = created.project;
      ctx.logger.info(`  created Neon project ${project.name} (${project.id})`);
    }

    const { branch, database } = await defaultTarget(ctx, project.id);

    // Read both back rather than parsing the create response: this path also runs
    // for an existing project, so there is one code path and one source of truth.
    const pooled = await connectionUri(ctx, project.id, branch, database, true);
    const direct = await connectionUri(ctx, project.id, branch, database, false);

    return {
      statePatch: {
        projectId: project.id,
        projectName: project.name,
        branchId: branch.id,
        branchName: branch.name,
        databaseName: database.name,
        roleName: database.owner_name,
        regionId: config.region,
      },
      secrets: {
        DATABASE_URL: pooled,
        DATABASE_URL_UNPOOLED: direct,
      },
    };
  },

  async verify(ctx): Promise<VerifyResult> {
    const config = ctx.manifest.services.neon;
    if (config === false) return { ok: true, message: "neon disabled" };

    const project = await findProject(ctx);
    if (!project) return { ok: false, message: `Neon project "${projectName(ctx)}" not found` };

    const missing = ["DATABASE_URL", "DATABASE_URL_UNPOOLED"].filter(
      (key) => typeof ctx.outputs[key] !== "string",
    );
    if (missing.length > 0) {
      return { ok: false, message: "connection strings not provisioned yet", missing };
    }

    const { branch, database } = await defaultTarget(ctx, project.id);
    return {
      ok: true,
      message: `project ${project.name} ready (branch ${branch.name}, db ${database.name})`,
    };
  },

  async destroy(ctx) {
    const project = await findProject(ctx);
    if (!project) return;

    await request(`${API}/projects/${project.id}`, {
      method: "DELETE",
      driver: "neon",
      headers: auth(ctx),
      allowStatus: [404, 409],
    });
    ctx.logger.info(`  deleted Neon project ${project.name}`);
  },
};
