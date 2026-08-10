/**
 * The contract every provider driver implements.
 *
 * Invariants, enforced by the runner and by `state.ts`:
 *  - `apply` is **lookup-then-create** keyed on `resourceName(ctx)`. Re-running an
 *    already-applied driver must be a no-op, not a duplicate resource.
 *  - `plan` never writes.
 *  - `statePatch` carries resource ids only; secrets go in `secrets`.
 *  - `outputs` is the complete set of env var names the driver can produce, declared
 *    up front so the runner can detect two drivers claiming the same variable.
 */
import type { ProductManifest } from "./manifest";
import type { ProductState } from "./state";
import type { Env, Logger, ManualStep, PlanStep, Surface, VerifyResult } from "./types";

export interface Ctx {
  /** Product slug, e.g. `acme`. */
  readonly product: string;
  readonly env: Env;
  readonly manifest: ProductManifest;
  /** Absolute path to the monorepo root. */
  readonly repoRoot: string;
  /** Read-only view of `.factory/state.json`; mutate via the returned `statePatch`. */
  readonly state: ProductState;
  /** Env vars produced by drivers this one `dependsOn`, plus any already in Infisical. */
  readonly outputs: Readonly<Record<string, string>>;
  /** Org-level tokens loaded from `.env.factory`. */
  readonly credentials: Readonly<Record<string, string>>;
  readonly logger: Logger;
  /** When true, no driver may perform a write of any kind. */
  readonly dryRun: boolean;
}

export interface ApplyResult {
  /** Resource ids to remember. Validated secret-free before it is persisted. */
  readonly statePatch?: Record<string, unknown>;
  /** Env var name -> value. Written to Infisical, then fanned out to the sinks. */
  readonly secrets?: Record<string, string>;
  /** Steps a human must complete because the provider has no create API. */
  readonly manualSteps?: readonly ManualStep[];
}

/** Declares which per-app `.env` an output belongs in. */
export interface OutputSpec {
  readonly key: string;
  readonly surfaces: readonly Surface[];
}

export interface Driver {
  readonly id: string;
  /** Driver ids that must succeed first. Cycles are rejected at load time. */
  readonly dependsOn: readonly string[];
  /** Every env var this driver can produce, and where each is consumed. */
  readonly outputs: readonly OutputSpec[];
  /** Names of `.env.factory` keys this driver needs. Checked before `apply` runs. */
  readonly credentials: readonly string[];

  /** Deterministic remote name, so lookup-then-create is stable across runs. */
  resourceName(ctx: Ctx): string;
  plan(ctx: Ctx): Promise<readonly PlanStep[]>;
  apply(ctx: Ctx): Promise<ApplyResult>;
  verify(ctx: Ctx): Promise<VerifyResult>;
  destroy(ctx: Ctx): Promise<void>;
}

/** The env var names a driver declares, flattened. */
export function outputKeys(driver: Driver): string[] {
  return driver.outputs.map((o) => o.key);
}

/** Convention for every remote resource the factory creates. */
export function standardName(ctx: Ctx, suffix?: string): string {
  const base = `${ctx.product}-${ctx.env}`;
  return suffix ? `${base}-${suffix}` : base;
}
