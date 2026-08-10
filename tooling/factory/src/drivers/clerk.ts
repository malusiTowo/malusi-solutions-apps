/**
 * Clerk — a real Clerk application per product, created through the Platform API.
 *
 * Driven through the `clerk` CLI rather than raw HTTP, for the same reason as the
 * Expo driver: the Platform API is beta, its response shapes are not publicly
 * documented, and the CLI already owns two things we would otherwise reimplement —
 * `CLERK_PLATFORM_API_KEY` auth, and key retrieval (`clerk env pull`), which has no
 * documented endpoint. The CLI emits JSON whenever stdout is not a TTY, which is
 * always the case here.
 *
 * Degrades gracefully: with no `CLERK_PLATFORM_API_KEY` the driver creates nothing
 * and emits the manual punch-list entry instead, so a workspace that has not enabled
 * the Platform API still provisions everything else.
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseDotenv } from "../credentials";
import { exec, requireCommand } from "../exec";
import { requireJson } from "../http";
import type { ApplyResult, Ctx, Driver } from "../driver";
import { FactoryError, type Env, type PlanStep, type VerifyResult } from "../types";

const BACKEND_API = "https://api.clerk.com/v1";

/**
 * A Clerk application has a development and a production instance. `preview` shares
 * the development instance — a separate Clerk app per preview would mean a separate
 * user pool, which is rarely what you want for a staging deploy.
 */
const CLERK_INSTANCE: Record<Env, "dev" | "prod"> = {
  dev: "dev",
  preview: "dev",
  prod: "prod",
};

/** One Clerk application per product; instances cover the environments. */
const appName = (ctx: Ctx) => `${ctx.manifest.displayName}`;

interface Application {
  readonly id: string;
  readonly name: string;
}

const hasPlatformKey = (ctx: Ctx) =>
  (ctx.credentials["CLERK_PLATFORM_API_KEY"] ?? "").trim() !== "";

function cliEnv(ctx: Ctx): Record<string, string> {
  return { CLERK_PLATFORM_API_KEY: ctx.credentials["CLERK_PLATFORM_API_KEY"] ?? "" };
}

/**
 * Call a Platform API endpoint through the CLI. `clerk api` returns the raw JSON
 * body, and reports its own errors as `{"error": {...}}` with a zero exit code in
 * some cases — so both paths are checked.
 */
async function platform<T>(
  ctx: Ctx,
  endpoint: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  await requireCommand("clerk", "clerk", "pnpm add -g clerk");

  const args = ["api", endpoint, "--platform"];
  if (options.method !== undefined) args.push("-X", options.method);
  if (options.body !== undefined) args.push("-d", JSON.stringify(options.body), "--yes");

  const { stdout } = await exec("clerk", args, {
    cwd: ctx.repoRoot,
    driver: "clerk",
    env: cliEnv(ctx),
    timeoutSeconds: 120,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch (cause) {
    throw new FactoryError("command", `clerk api ${endpoint} returned non-JSON`, {
      driver: "clerk",
      detail: stdout.slice(0, 400),
      cause,
    });
  }

  const asError = parsed as { error?: { message?: string; code?: string } };
  if (asError.error !== undefined) {
    throw new FactoryError(
      "provider",
      `clerk api ${endpoint}: ${asError.error.message ?? asError.error.code ?? "unknown error"}`,
      { driver: "clerk", detail: parsed },
    );
  }

  return parsed as T;
}

/** Applications are listed, not looked up by name, so match client-side. */
async function findApplication(ctx: Ctx): Promise<Application | undefined> {
  const recorded = ctx.state.environments[ctx.env]?.["clerk"]?.["applicationId"];

  // The beta API has returned both a bare array and a `{ data }` envelope; accept either.
  const response = await platform<{ data?: readonly Application[] }>(ctx, "/platform/applications");
  const applications: readonly Application[] = Array.isArray(response)
    ? (response as readonly Application[])
    : (response.data ?? []);

  if (typeof recorded === "string") {
    const byId = applications.find((a) => a.id === recorded);
    if (byId) return byId;
  }
  return applications.find((a) => a.name === appName(ctx));
}

/**
 * Retrieve an instance's keys.
 *
 * `clerk env pull` writes a dotenv file rather than printing the keys, so this pulls
 * into a temp file, reads it, and deletes it. The variable names it writes depend on
 * the detected framework, so match on suffix rather than an exact name.
 */
async function pullKeys(
  ctx: Ctx,
  applicationId: string,
): Promise<{ publishable?: string; secret?: string }> {
  const dir = await mkdtemp(join(tmpdir(), "factory-clerk-"));
  const file = join(dir, ".env");

  try {
    await exec(
      "clerk",
      [
        "env",
        "pull",
        "--app",
        applicationId,
        "--instance",
        CLERK_INSTANCE[ctx.env],
        "--file",
        file,
      ],
      { cwd: ctx.repoRoot, driver: "clerk", env: cliEnv(ctx), timeoutSeconds: 120 },
    );

    const values = parseDotenv(await readFile(file, "utf8"));
    const find = (suffix: string) =>
      Object.entries(values).find(([key]) => key.endsWith(suffix))?.[1];

    return { publishable: find("PUBLISHABLE_KEY"), secret: find("SECRET_KEY") };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Keys a human may already have pasted into Infisical. */
function suppliedKeys(ctx: Ctx): { secret?: string; publishable?: string } {
  return {
    secret: ctx.outputs["CLERK_SECRET_KEY"],
    publishable: ctx.outputs["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"],
  };
}

function manualStep(ctx: Ctx) {
  return {
    id: "clerk",
    title: `Create the Clerk application "${appName(ctx)}"`,
    url: "https://dashboard.clerk.com/apps/new",
    instructions: [
      "The factory can do this for you — add a Platform API key to .env.factory as",
      "CLERK_PLATFORM_API_KEY and re-run, and skip the rest of these steps.",
      `Otherwise: create an application named "${appName(ctx)}".`,
      "Enable the sign-in methods this product needs (email + Google is the default).",
      "Open API Keys and copy the secret key and the publishable key.",
      `Add them to Infisical under ${ctx.product} / ${ctx.env} / api as ` +
        `CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.`,
    ],
    provides: [
      { key: "CLERK_SECRET_KEY", surfaces: ["api"] as const },
      { key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", surfaces: ["api"] as const },
      { key: "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY", surfaces: ["mobile"] as const },
    ],
  };
}

export const clerkDriver: Driver = {
  id: "clerk",
  dependsOn: [],
  outputs: [
    { key: "CLERK_SECRET_KEY", surfaces: ["api"] },
    { key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", surfaces: ["api"] },
    { key: "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY", surfaces: ["mobile"] },
  ],
  // Not declared as required: the driver falls back to the manual ledger without it,
  // rather than being skipped and blocking nothing useful.
  credentials: [],

  resourceName: (ctx) => appName(ctx),

  async plan(ctx): Promise<readonly PlanStep[]> {
    if (!hasPlatformKey(ctx)) {
      return [
        {
          action: suppliedKeys(ctx).secret === undefined ? "create" : "noop",
          resource: `Clerk application "${appName(ctx)}"`,
          detail: "MANUAL — set CLERK_PLATFORM_API_KEY to automate this",
        },
      ];
    }

    const existing = await findApplication(ctx);
    return [
      {
        action: existing ? "noop" : "create",
        resource: `Clerk application "${appName(ctx)}"`,
        detail: existing ? existing.id : `instance: ${CLERK_INSTANCE[ctx.env]}`,
      },
    ];
  },

  async apply(ctx): Promise<ApplyResult> {
    const supplied = suppliedKeys(ctx);

    if (!hasPlatformKey(ctx)) {
      // Nothing to automate. If a human already pasted the keys, mirror the
      // publishable one to mobile so both surfaces share the instance.
      if (supplied.secret !== undefined && supplied.publishable !== undefined) {
        return {
          statePatch: { configured: true, managedBy: "manual" },
          secrets: { EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: supplied.publishable },
        };
      }
      return { statePatch: { configured: false }, manualSteps: [manualStep(ctx)] };
    }

    if (ctx.dryRun) return {};

    let application = await findApplication(ctx);

    if (!application) {
      const created = await platform<{ data?: Application } & Partial<Application>>(
        ctx,
        "/platform/applications",
        { method: "POST", body: { name: appName(ctx) } },
      );
      application = created.data ?? (created as Application);
      ctx.logger.info(`  created Clerk application ${application.name} (${application.id})`);
    }

    // Point the production instance at the product's domain, if it has one.
    if (ctx.env === "prod" && ctx.manifest.domain !== undefined) {
      try {
        await platform(ctx, `/platform/applications/${application.id}/domain`, {
          method: "PATCH",
          body: { name: ctx.manifest.domain },
        });
        ctx.logger.debug(`set Clerk production domain to ${ctx.manifest.domain}`);
      } catch (error) {
        // Not fatal — the app still works on Clerk's own domain.
        ctx.logger.warn(`could not set Clerk domain: ${(error as Error).message}`);
      }
    }

    const keys = await pullKeys(ctx, application.id);
    if (keys.secret === undefined || keys.publishable === undefined) {
      throw new FactoryError(
        "provider",
        `Clerk application ${application.id} exists but \`clerk env pull\` returned no ` +
          `${keys.secret === undefined ? "secret" : "publishable"} key for the ` +
          `${CLERK_INSTANCE[ctx.env]} instance.`,
        { driver: "clerk" },
      );
    }

    return {
      statePatch: {
        applicationId: application.id,
        applicationName: application.name,
        instance: CLERK_INSTANCE[ctx.env],
        configured: true,
        managedBy: "platform-api",
      },
      secrets: {
        CLERK_SECRET_KEY: keys.secret,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: keys.publishable,
        // Both surfaces share one Clerk instance, so sessions are portable.
        EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: keys.publishable,
      },
    };
  },

  async verify(ctx): Promise<VerifyResult> {
    const secret = ctx.outputs["CLERK_SECRET_KEY"];
    const publishable = ctx.outputs["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

    const missing: string[] = [];
    if (secret === undefined) missing.push("CLERK_SECRET_KEY");
    if (publishable === undefined) missing.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");

    if (missing.length > 0) {
      const hint = hasPlatformKey(ctx)
        ? "run `pnpm factory apply`"
        : "awaiting manual step (or set CLERK_PLATFORM_API_KEY)";
      return { ok: false, message: `${hint}; missing ${missing.join(", ")}`, missing };
    }

    // Prove the key authenticates rather than just that a string is present.
    await requireJson(`${BACKEND_API}/instance`, {
      driver: "clerk",
      headers: { authorization: `Bearer ${secret}` },
    });

    return { ok: true, message: "Clerk secret key authenticates" };
  },

  async destroy(ctx) {
    const recorded = ctx.state.environments[ctx.env]?.["clerk"]?.["applicationId"];

    if (typeof recorded !== "string" || !hasPlatformKey(ctx)) {
      ctx.logger.warn(
        `Clerk application "${appName(ctx)}" must be deleted manually at https://dashboard.clerk.com/`,
      );
      return;
    }

    await platform(ctx, `/platform/applications/${recorded}`, { method: "DELETE" });
    ctx.logger.info(`  deleted Clerk application ${recorded}`);
  },
};
