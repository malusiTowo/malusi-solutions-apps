/**
 * Shared vocabulary for the project factory.
 *
 * The factory is a build-time CLI, not app runtime, so it deliberately uses plain
 * async/Promise rather than Effect: there is no service graph to compose and no
 * runtime injection to model. Failures are carried by {@link FactoryError}.
 */

/** Deployment environments a product can be provisioned into. */
export const ENVIRONMENTS = ["dev", "preview", "prod"] as const;
export type Env = (typeof ENVIRONMENTS)[number];

/** Where a secret is consumed. Drives which per-app `.env` file it lands in. */
export type Surface = "api" | "mobile";

export type FactoryErrorKind =
  /** An org-level token in `.env.factory` is missing or empty. */
  | "missing-credential"
  /** A provider returned a non-2xx response. */
  | "provider"
  /** A shelled-out CLI (gh, eas, infisical) exited non-zero. */
  | "command"
  /** The manifest or state file is malformed. */
  | "config"
  /** A driver could not run because one it depends on failed. */
  | "blocked";

/**
 * The single error type every driver rejects with. Carries enough context for the
 * CLI to print an actionable message without the driver formatting one itself.
 */
export class FactoryError extends Error {
  readonly kind: FactoryErrorKind;
  readonly driver: string | undefined;
  readonly detail: unknown;

  constructor(
    kind: FactoryErrorKind,
    message: string,
    options?: { driver?: string; detail?: unknown; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "FactoryError";
    this.kind = kind;
    this.driver = options?.driver;
    this.detail = options?.detail;
  }
}

/** One line of a `factory plan` diff. */
export interface PlanStep {
  /** `create` when the resource is absent remotely, `noop` when it already matches. */
  readonly action: "create" | "update" | "noop";
  /** Human-readable resource description, e.g. `Neon project "acme-dev"`. */
  readonly resource: string;
  /** Optional extra context, e.g. the region or tier that would be used. */
  readonly detail?: string;
}

/** Result of a single driver's health check. */
export interface VerifyResult {
  readonly ok: boolean;
  /** Why it failed, or what was confirmed when it passed. */
  readonly message: string;
  /** Env vars this driver owns that are still absent. */
  readonly missing?: readonly string[];
}

/**
 * A step the factory cannot automate because the provider has no create API.
 * Rendered into `apps/<product>/.factory/manual-steps.md`.
 */
export interface ManualStep {
  /** Stable id used to track completion in state, e.g. `clerk`. */
  readonly id: string;
  readonly title: string;
  /** Deep link into the provider's dashboard, as specific as possible. */
  readonly url: string;
  /** Ordered instructions. Keep each one a single concrete action. */
  readonly instructions: readonly string[];
  /** Env vars the operator must paste back, and which surface consumes each. */
  readonly provides: readonly { readonly key: string; readonly surfaces: readonly Surface[] }[];
}

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  /** Indented detail under the most recent `info`. Suppressed unless verbose. */
  debug(message: string): void;
}
