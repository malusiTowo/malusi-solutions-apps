/**
 * A recording fake driver. Backs both `--dry-run` verification and the unit tests, so
 * the DAG machinery can be exercised without a single live credential.
 */
import type { ApplyResult, Ctx, Driver, OutputSpec } from "./driver";
import type { PlanStep, VerifyResult } from "./types";

export interface FakeDriverOptions {
  readonly id: string;
  readonly dependsOn?: readonly string[];
  readonly outputs?: readonly OutputSpec[];
  readonly credentials?: readonly string[];
  /** Reject `apply` with this message, to exercise blocked-dependent propagation. */
  readonly failWith?: string;
  readonly secrets?: Record<string, string>;
  readonly statePatch?: Record<string, unknown>;
}

export interface Recording {
  readonly calls: string[];
}

export function createFakeDriver(
  options: FakeDriverOptions,
  recording: Recording = { calls: [] },
): { driver: Driver; recording: Recording } {
  const driver: Driver = {
    id: options.id,
    dependsOn: options.dependsOn ?? [],
    outputs: options.outputs ?? [],
    credentials: options.credentials ?? [],
    resourceName: (ctx: Ctx) => `${ctx.product}-${ctx.env}-${options.id}`,
    plan: async (ctx: Ctx): Promise<readonly PlanStep[]> => {
      recording.calls.push(`plan:${options.id}`);
      return [{ action: "create", resource: driver.resourceName(ctx) }];
    },
    apply: async (): Promise<ApplyResult> => {
      recording.calls.push(`apply:${options.id}`);
      if (options.failWith !== undefined) throw new Error(options.failWith);
      return {
        ...(options.statePatch ? { statePatch: options.statePatch } : {}),
        ...(options.secrets ? { secrets: options.secrets } : {}),
      };
    },
    verify: async (): Promise<VerifyResult> => {
      recording.calls.push(`verify:${options.id}`);
      return { ok: options.failWith === undefined, message: options.failWith ?? "ok" };
    },
    destroy: async (): Promise<void> => {
      recording.calls.push(`destroy:${options.id}`);
    },
  };

  return { driver, recording };
}
