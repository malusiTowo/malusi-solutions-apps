/**
 * `apps/<product>/.factory/state.json` — the record of what has been provisioned.
 *
 * Committed to git, and **secret-free by construction**: it holds resource ids only,
 * so re-runs can look up rather than re-create, and `destroy` knows what to delete.
 * Secrets live in Infisical; see `secrets.ts`.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { ENVIRONMENTS, FactoryError, type Env } from "./types";

export const SCHEMA_VERSION = 1;

/** Anything a driver chooses to remember. Values are ids/names, never credentials. */
const resourceRecord = z.record(z.string(), z.unknown());

export const productStateSchema = z.object({
  product: z.string(),
  schemaVersion: z.literal(SCHEMA_VERSION),
  /**
   * Per-environment, per-driver resource ids. `partialRecord` because a product is
   * usually provisioned into `dev` long before `preview` or `prod` exist.
   */
  environments: z
    .partialRecord(z.enum(ENVIRONMENTS), z.record(z.string(), resourceRecord))
    .default({}),
  /** Completion tracking for steps the factory cannot automate. */
  manualSteps: z.record(z.string(), z.enum(["pending", "done"])).default({}),
});

export type ProductState = z.infer<typeof productStateSchema>;

/**
 * Values that look like credentials must never reach `state.json`. Drivers return
 * secrets separately (`ApplyResult.secrets`); this catches mistakes at write time
 * rather than after they land in a commit.
 */
const SECRET_SHAPED = [
  /^sk[-_]/i,
  /^rk_/i,
  /^pk_/i,
  /^whsec_/i,
  /^re_/i,
  /^phc_/i,
  /^ey[A-Za-z0-9_-]{10,}\./, // JWT
  /postgres(?:ql)?:\/\/[^:]+:[^@]+@/i, // URI with inline password
];

export function assertNoSecrets(driver: string, patch: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value !== "string") continue;
    if (SECRET_SHAPED.some((re) => re.test(value))) {
      throw new FactoryError(
        "config",
        `Driver "${driver}" tried to write a secret-shaped value to state.json under "${key}". ` +
          `Return it via ApplyResult.secrets instead — state.json is committed.`,
        { driver },
      );
    }
  }
}

export function stateDir(repoRoot: string, product: string): string {
  return join(repoRoot, "apps", product, ".factory");
}

export function statePath(repoRoot: string, product: string): string {
  return join(stateDir(repoRoot, product), "state.json");
}

export function emptyState(product: string): ProductState {
  return { product, schemaVersion: SCHEMA_VERSION, environments: {}, manualSteps: {} };
}

export async function readState(repoRoot: string, product: string): Promise<ProductState> {
  const path = statePath(repoRoot, product);
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return emptyState(product);
    throw new FactoryError("config", `Could not read ${path}`, { cause });
  }

  const parsed = productStateSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new FactoryError("config", `${path} is malformed: ${parsed.error.message}`, {
      detail: parsed.error.issues,
    });
  }
  return parsed.data;
}

export async function writeState(
  repoRoot: string,
  product: string,
  state: ProductState,
): Promise<void> {
  const path = statePath(repoRoot, product);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

/** What a driver previously recorded for this environment, or `{}` on first run. */
export function driverState(
  state: ProductState,
  env: Env,
  driver: string,
): Record<string, unknown> {
  return state.environments[env]?.[driver] ?? {};
}

/**
 * Fold a driver's `statePatch` into the state tree. Returns a new object — the runner
 * persists after every driver so a crash resumes rather than restarts.
 */
export function mergeDriverState(
  state: ProductState,
  env: Env,
  driver: string,
  patch: Record<string, unknown>,
): ProductState {
  assertNoSecrets(driver, patch);
  const forEnv = state.environments[env] ?? {};
  return {
    ...state,
    environments: {
      ...state.environments,
      [env]: { ...forEnv, [driver]: { ...forEnv[driver], ...patch } },
    },
  };
}

export function clearEnvironment(state: ProductState, env: Env): ProductState {
  const rest = { ...state.environments };
  delete rest[env];
  return { ...state, environments: rest };
}
