/**
 * Expo / EAS — the mobile project, plus the env vars its builds need.
 *
 * Driven through `eas-cli` rather than HTTP: Expo's provisioning surface is a private
 * GraphQL API with no stability guarantee, while the CLI is the supported path and
 * handles `app.config.ts` rewriting for us.
 *
 * Depends on `vercel` so `EXPO_PUBLIC_API_URL` points at a real deployment, and on
 * `sentry`/`posthog` so their `EXPO_PUBLIC_*` keys are available to push.
 */
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { exec, requireCommand } from "../exec";
import { pushToEas } from "../secrets";
import type { Ctx, Driver } from "../driver";
import type { PlanStep, VerifyResult } from "../types";

const mobileDir = (ctx: Ctx) => join(ctx.repoRoot, "apps", ctx.product, "mobile");

/** EAS slugs are per-account and not per-environment; one project serves all three. */
const slug = (ctx: Ctx) => ctx.product;

interface EasProjectInfo {
  readonly id?: string;
}

/** `eas project:info --json` is the read path; absent project exits non-zero. */
async function findProject(ctx: Ctx): Promise<string | undefined> {
  try {
    const { stdout } = await exec("eas", ["project:info", "--json", "--non-interactive"], {
      cwd: mobileDir(ctx),
      driver: "expo",
      env: { EXPO_TOKEN: ctx.credentials["EXPO_TOKEN"] ?? "" },
      timeoutSeconds: 60,
    });
    const parsed = JSON.parse(stdout) as EasProjectInfo;
    return parsed.id;
  } catch {
    return undefined;
  }
}

/** The projectId the generated `app.config.ts` reads from `extra.eas`. */
async function configuredProjectId(ctx: Ctx): Promise<string | undefined> {
  try {
    const source = await readFile(join(mobileDir(ctx), "app.config.ts"), "utf8");
    return /projectId:\s*"([^"]+)"/.exec(source)?.[1];
  } catch {
    return undefined;
  }
}

/** EXPO_PUBLIC_* are the only vars a mobile build can read. */
function mobileSecrets(ctx: Ctx): Record<string, string> {
  return Object.fromEntries(
    Object.entries(ctx.outputs).filter(([key]) => key.startsWith("EXPO_PUBLIC_")),
  );
}

export const expoDriver: Driver = {
  id: "expo",
  dependsOn: ["vercel", "sentry", "posthog"],
  outputs: [],
  credentials: ["EXPO_TOKEN"],

  resourceName: (ctx) => slug(ctx),

  async plan(ctx): Promise<readonly PlanStep[]> {
    if (!ctx.manifest.surfaces.mobile) return [];

    const existing = (await configuredProjectId(ctx)) ?? (await findProject(ctx));
    return [
      {
        action: existing ? "noop" : "create",
        resource: `EAS project "${slug(ctx)}"`,
        detail: existing ?? "eas init",
      },
      {
        action: "update",
        resource: `EAS env vars (${ctx.env})`,
        detail: `${Object.keys(mobileSecrets(ctx)).length} EXPO_PUBLIC_* values`,
      },
    ];
  },

  async apply(ctx) {
    if (!ctx.manifest.surfaces.mobile) return {};
    if (ctx.dryRun) return {};

    await requireCommand("eas", "expo", "pnpm add -g eas-cli");
    const env = { EXPO_TOKEN: ctx.credentials["EXPO_TOKEN"] ?? "" };

    let projectId = (await configuredProjectId(ctx)) ?? (await findProject(ctx));

    if (projectId === undefined) {
      // `eas init` writes extra.eas.projectId into app.config.ts as a side effect.
      await exec("eas", ["init", "--id", "--non-interactive", "--force"], {
        cwd: mobileDir(ctx),
        driver: "expo",
        env,
        timeoutSeconds: 180,
      });
      projectId = (await configuredProjectId(ctx)) ?? (await findProject(ctx));
      ctx.logger.info(`  initialised EAS project ${slug(ctx)} (${projectId ?? "id unknown"})`);
    }

    const secrets = mobileSecrets(ctx);
    if (Object.keys(secrets).length > 0) {
      const count = await pushToEas({
        projectDir: mobileDir(ctx),
        environment: ctx.env,
        secrets,
        token: env.EXPO_TOKEN,
        logger: ctx.logger,
      });
      ctx.logger.info(`  pushed ${count} env vars to EAS`);
    }

    return {
      statePatch: {
        slug: slug(ctx),
        ...(projectId !== undefined ? { projectId } : {}),
      },
    };
  },

  async verify(ctx): Promise<VerifyResult> {
    if (!ctx.manifest.surfaces.mobile) return { ok: true, message: "no mobile surface" };

    const configured = await configuredProjectId(ctx);
    if (configured === undefined) {
      return {
        ok: false,
        message: "app.config.ts has no extra.eas.projectId — run `pnpm factory apply`",
      };
    }

    const remote = await findProject(ctx);
    return remote === configured
      ? { ok: true, message: `EAS project ${configured} reachable` }
      : {
          ok: false,
          message: `app.config.ts says ${configured} but EAS reports ${remote ?? "nothing"}`,
        };
  },

  async destroy(ctx) {
    // EAS has no non-interactive project delete; deleting is a dashboard action.
    ctx.logger.warn(
      `EAS project "${slug(ctx)}" must be deleted manually at ` +
        `https://expo.dev/accounts/_/projects/${slug(ctx)}/settings`,
    );
  },
};
