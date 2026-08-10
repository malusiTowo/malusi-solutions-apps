export { defineProduct, disabledServices, productManifestSchema } from "./manifest";
export type { ProductManifest, ProductManifestInput } from "./manifest";

export type { ApplyResult, Ctx, Driver, OutputSpec } from "./driver";
export { outputKeys, standardName } from "./driver";

export { ALL_DRIVERS } from "./drivers";
export { activeDrivers, assertNoOutputCollisions, blockedBy, resolveLevels } from "./dag";
export { runApply, runDestroy, runPlan, runVerify } from "./runner";
export type { DriverOutcome, DriverStatus, RunOptions, RunResult } from "./runner";

export { emptyState, readState, writeState } from "./state";
export type { ProductState } from "./state";

export { allocateDevPort, findRepoRoot, listProducts, loadManifest } from "./repo";
export { newProduct } from "./scaffold";
export { renderLedger, writeLedger } from "./ledger";

export { createLogger, silentLogger } from "./logger";
export { ENVIRONMENTS, FactoryError } from "./types";
export type { Env, Logger, ManualStep, PlanStep, Surface, VerifyResult } from "./types";
