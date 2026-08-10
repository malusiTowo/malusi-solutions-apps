/**
 * Executes the driver DAG.
 *
 * Design goals, in priority order:
 *  1. **Maximum progress per invocation.** A failing driver blocks only its transitive
 *     dependents; unrelated branches keep going.
 *  2. **Resumable.** State is persisted after every driver, so a crash costs at most
 *     the driver that was in flight — never the whole run.
 *  3. **Never block on a human.** Manual steps are collected and reported at the end;
 *     `apply` does not wait for them.
 */
import { missingCredentials } from "./credentials";
import { type ApplyResult, type Ctx, type Driver } from "./driver";
import { assertNoOutputCollisions, blockedBy, resolveLevels } from "./dag";
import { driverState, mergeDriverState, writeState, type ProductState } from "./state";
import { FactoryError, type Env, type Logger, type ManualStep, type PlanStep } from "./types";
import type { ProductManifest } from "./manifest";

export type DriverStatus = "applied" | "skipped" | "failed" | "blocked";

export interface DriverOutcome {
  readonly driver: string;
  readonly status: DriverStatus;
  /** Present when `failed`, or the reason when `skipped`. */
  readonly reason?: string;
  readonly secrets?: Record<string, string>;
  readonly manualSteps?: readonly ManualStep[];
}

export interface RunResult {
  readonly outcomes: readonly DriverOutcome[];
  /** Accumulated env vars from every driver that succeeded. */
  readonly secrets: Record<string, string>;
  readonly manualSteps: readonly ManualStep[];
  readonly state: ProductState;
  readonly ok: boolean;
}

export interface RunOptions {
  readonly drivers: readonly Driver[];
  readonly product: string;
  readonly env: Env;
  readonly manifest: ProductManifest;
  readonly repoRoot: string;
  readonly state: ProductState;
  readonly credentials: Readonly<Record<string, string>>;
  /** Secrets already known, e.g. pulled from Infisical or pasted manual keys. */
  readonly seedOutputs?: Readonly<Record<string, string>>;
  readonly logger: Logger;
  readonly dryRun: boolean;
  /** When false, state is not written to disk. Used by `plan`. */
  readonly persist?: boolean;
}

function buildCtx(
  options: RunOptions,
  driver: Driver,
  state: ProductState,
  outputs: Record<string, string>,
): Ctx {
  return {
    product: options.product,
    env: options.env,
    manifest: options.manifest,
    repoRoot: options.repoRoot,
    state,
    outputs,
    credentials: options.credentials,
    logger: options.logger,
    dryRun: options.dryRun,
  };
}

/** Read-only pass: what `apply` would do, without touching anything. */
export async function runPlan(
  options: RunOptions,
): Promise<readonly { driver: string; steps: readonly PlanStep[]; reason?: string }[]> {
  assertNoOutputCollisions(options.drivers);
  const levels = resolveLevels(options.drivers);
  const outputs = { ...options.seedOutputs };
  const results: { driver: string; steps: readonly PlanStep[]; reason?: string }[] = [];

  for (const level of levels) {
    const planned = await Promise.all(
      level.map(async (driver) => {
        const missing = missingCredentials(options.credentials, driver.credentials);
        if (missing.length > 0) {
          return {
            driver: driver.id,
            steps: [] as readonly PlanStep[],
            reason: `missing credentials: ${missing.join(", ")}`,
          };
        }
        try {
          const ctx = buildCtx(options, driver, options.state, outputs);
          return { driver: driver.id, steps: await driver.plan(ctx) };
        } catch (error) {
          return {
            driver: driver.id,
            steps: [] as readonly PlanStep[],
            reason: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );
    results.push(...planned);
  }

  return results;
}

/** Provision. Idempotent: re-running against applied state should report no changes. */
export async function runApply(options: RunOptions): Promise<RunResult> {
  assertNoOutputCollisions(options.drivers);
  const levels = resolveLevels(options.drivers);
  const persist = options.persist ?? true;

  let state = options.state;
  const outputs: Record<string, string> = { ...options.seedOutputs };
  const secrets: Record<string, string> = {};
  const manualSteps: ManualStep[] = [];
  const outcomes: DriverOutcome[] = [];
  const unavailable = new Set<string>();

  for (const level of levels) {
    const runnable = level.filter((d) => {
      const blocked = d.dependsOn.some((dep) => unavailable.has(dep));
      if (blocked) {
        unavailable.add(d.id);
        const upstream = d.dependsOn.filter((dep) => unavailable.has(dep)).join(", ");
        outcomes.push({
          driver: d.id,
          status: "blocked",
          reason: `depends on ${upstream}, which did not complete`,
        });
        options.logger.warn(`${d.id}: blocked by ${upstream}`);
      }
      return !blocked;
    });

    /** Either the driver was skipped for credentials, or it applied and returned this. */
    type LevelResult =
      | { readonly kind: "skipped"; readonly reason: string }
      | { readonly kind: "applied"; readonly result: ApplyResult };

    // Each driver in a level is independent, so failures must not cancel siblings.
    const settled = await Promise.allSettled(
      runnable.map(async (driver): Promise<LevelResult> => {
        const missing = missingCredentials(options.credentials, driver.credentials);
        if (missing.length > 0) {
          return {
            kind: "skipped",
            reason: `missing credentials in .env.factory: ${missing.join(", ")}`,
          };
        }

        const ctx = buildCtx(options, driver, state, outputs);
        options.logger.info(`${driver.id} → ${driver.resourceName(ctx)}`);
        return { kind: "applied", result: await driver.apply(ctx) };
      }),
    );

    // Fold serially: state merging and output accumulation must be ordered, and a
    // rejected state write has to be attributed to its driver rather than escaping.
    for (const [index, entry] of settled.entries()) {
      const driver = runnable[index];
      if (driver === undefined) continue;

      const fail = (reason: string) => {
        unavailable.add(driver.id);
        outcomes.push({ driver: driver.id, status: "failed", reason });
        options.logger.error(`${driver.id}: ${reason}`);
      };

      if (entry.status === "rejected") {
        fail(entry.reason instanceof Error ? entry.reason.message : String(entry.reason));
        continue;
      }

      if (entry.value.kind === "skipped") {
        unavailable.add(driver.id);
        outcomes.push({ driver: driver.id, status: "skipped", reason: entry.value.reason });
        options.logger.warn(`${driver.id}: ${entry.value.reason}`);
        continue;
      }

      const { result } = entry.value;

      if (result.statePatch !== undefined && !options.dryRun) {
        try {
          // Throws if the driver tried to smuggle a credential into committed state.
          state = mergeDriverState(state, options.env, driver.id, result.statePatch);
        } catch (error) {
          fail(error instanceof Error ? error.message : String(error));
          continue;
        }
        if (persist) await writeState(options.repoRoot, options.product, state);
      }

      Object.assign(outputs, result.secrets ?? {});
      Object.assign(secrets, result.secrets ?? {});
      if (result.manualSteps) manualSteps.push(...result.manualSteps);

      outcomes.push({
        driver: driver.id,
        status: "applied",
        ...(result.secrets ? { secrets: result.secrets } : {}),
        ...(result.manualSteps ? { manualSteps: result.manualSteps } : {}),
      });
    }
  }

  // Sanity check: the blocked set the runner computed should match the graph's.
  const failedIds = new Set(
    outcomes.filter((o) => o.status === "failed" || o.status === "skipped").map((o) => o.driver),
  );
  const expectedBlocked = blockedBy(options.drivers, failedIds);
  for (const id of expectedBlocked) {
    if (!outcomes.some((o) => o.driver === id)) {
      outcomes.push({ driver: id, status: "blocked", reason: "upstream did not complete" });
    }
  }

  if (persist && !options.dryRun) {
    const withLedger: ProductState = {
      ...state,
      manualSteps: {
        ...state.manualSteps,
        ...Object.fromEntries(
          manualSteps.map((s) => [s.id, state.manualSteps[s.id] ?? ("pending" as const)]),
        ),
      },
    };
    state = withLedger;
    await writeState(options.repoRoot, options.product, state);
  }

  return {
    outcomes,
    secrets,
    manualSteps,
    state,
    ok: outcomes.every((o) => o.status === "applied"),
  };
}

/** Health-check every driver's credential. Independent, so all run concurrently. */
export async function runVerify(options: RunOptions) {
  const results = await Promise.all(
    options.drivers.map(async (driver) => {
      const missing = missingCredentials(options.credentials, driver.credentials);
      if (missing.length > 0) {
        return {
          driver: driver.id,
          ok: false,
          message: `missing credentials: ${missing.join(", ")}`,
        };
      }
      const ctx = buildCtx(options, driver, options.state, options.seedOutputs ?? {});
      try {
        const result = await driver.verify(ctx);
        return { driver: driver.id, ok: result.ok, message: result.message };
      } catch (error) {
        return {
          driver: driver.id,
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
  return results;
}

/** Tear down in reverse dependency order, so dependents go before their dependencies. */
export async function runDestroy(options: RunOptions): Promise<readonly DriverOutcome[]> {
  const levels = resolveLevels(options.drivers).toReversed();
  const outcomes: DriverOutcome[] = [];

  for (const level of levels) {
    const settled = await Promise.allSettled(
      level.map(async (driver) => {
        const recorded = driverState(options.state, options.env, driver.id);
        if (Object.keys(recorded).length === 0) {
          throw new FactoryError("config", "nothing recorded in state", { driver: driver.id });
        }
        const ctx = buildCtx(options, driver, options.state, options.seedOutputs ?? {});
        await driver.destroy(ctx);
        return driver.id;
      }),
    );

    for (const [index, entry] of settled.entries()) {
      const driver = level[index];
      if (driver === undefined) continue;
      outcomes.push(
        entry.status === "fulfilled"
          ? { driver: driver.id, status: "applied" }
          : {
              driver: driver.id,
              status: "failed",
              reason: entry.reason instanceof Error ? entry.reason.message : String(entry.reason),
            },
      );
    }
  }

  return outcomes;
}
