/**
 * `pnpm factory <command> <product>`
 *
 *   new      scaffold code (via `pnpm gen product`) then provision
 *   plan     show what would be created, touching nothing
 *   apply    provision, idempotently
 *   verify   health-check every credential
 *   sync     pull Infisical → per-app .env files
 *   destroy  tear down remote resources
 */
import { readFile } from "node:fs/promises";
import { loadCredentials, parseDotenv } from "./credentials";
import { ALL_DRIVERS } from "./drivers";
import { activeDrivers } from "./dag";
import { createLogger } from "./logger";
import { disabledServices } from "./manifest";
import { summariseLedger, writeLedger } from "./ledger";
import { newProduct } from "./scaffold";
import { findRepoRoot, loadManifest, listProducts } from "./repo";
import { runApply, runDestroy, runPlan, runVerify, type RunOptions } from "./runner";
import { clearEnvironment, readState, writeState } from "./state";
import {
  envFilePath,
  infisicalLogin,
  placementFrom,
  pullToEnvFile,
  pushSecrets,
  pushToGitHub,
  splitBySurface,
  writeEnvFile,
} from "./secrets";
import { ENVIRONMENTS, FactoryError, type Env, type Surface } from "./types";

interface Args {
  readonly command: string;
  readonly product: string | undefined;
  readonly env: Env;
  readonly dryRun: boolean;
  readonly verbose: boolean;
  readonly json: boolean;
  readonly yes: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  const positional = argv.filter((a) => !a.startsWith("-"));
  const flag = (name: string) => argv.includes(`--${name}`);

  const envFlag = argv.find((a) => a.startsWith("--env="))?.split("=")[1];
  if (envFlag !== undefined && !ENVIRONMENTS.includes(envFlag as Env)) {
    throw new FactoryError("config", `--env must be one of ${ENVIRONMENTS.join(", ")}`);
  }

  return {
    command: positional[0] ?? "help",
    product: positional[1],
    env: (envFlag as Env | undefined) ?? "dev",
    dryRun: flag("dry-run"),
    verbose: flag("verbose"),
    json: flag("json"),
    yes: flag("yes"),
  };
}

const USAGE = `
pnpm factory <command> [product] [options]

Commands
  new <product>       scaffold apps/<product> and provision everything
  plan <product>      show what would change; touches nothing
  apply <product>     provision, idempotently
  verify <product>    health-check every credential
  sync <product>      pull Infisical -> apps/<product>/{api,mobile}/.env
  destroy <product>   tear down this environment's remote resources
  list                products that have a manifest

Options
  --env=dev|preview|prod   target environment (default: dev)
  --dry-run                plan-like: drivers must not write
  --verbose                per-driver detail
  --json                   machine-readable output (plan, verify)
  --yes                    skip the destroy confirmation
`.trim();

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const logger = createLogger(args.verbose);
  const repoRoot = await findRepoRoot();

  if (args.command === "help" || args.command === "--help") {
    console.log(USAGE);
    return 0;
  }

  if (args.command === "list") {
    for (const product of await listProducts(repoRoot)) console.log(product);
    return 0;
  }

  if (args.product === undefined) {
    console.error(`\`${args.command}\` needs a product name.\n\n${USAGE}`);
    return 1;
  }

  // `new` scaffolds first, so there is a manifest to load below.
  if (args.command === "new") {
    await newProduct({ repoRoot, product: args.product, logger });
  }

  const manifest = await loadManifest(repoRoot, args.product);
  const credentials = await loadCredentials(repoRoot);
  const state = await readState(repoRoot, args.product);
  const drivers = activeDrivers(ALL_DRIVERS, disabledServices(manifest));

  // Secrets already in Infisical seed `ctx.outputs`, so a re-run sees the keys a
  // human pasted in after the previous run's manual steps.
  const seedOutputs = await seedFromInfisical(repoRoot, args, credentials, logger);

  const options: RunOptions = {
    drivers,
    product: args.product,
    env: args.env,
    manifest,
    repoRoot,
    state,
    credentials,
    seedOutputs,
    logger,
    dryRun: args.dryRun,
  };

  switch (args.command) {
    case "plan":
      return commandPlan(options, args);
    case "new":
    case "apply":
      return commandApply(options);
    case "verify":
      return commandVerify(options, args);
    case "sync":
      return commandSync(options);
    case "destroy":
      return commandDestroy(options, args);
    default:
      console.error(`Unknown command "${args.command}".\n\n${USAGE}`);
      return 1;
  }
}

/** Pull whatever is already in Infisical so re-runs see previously-pasted keys. */
async function seedFromInfisical(
  repoRoot: string,
  args: Args,
  credentials: Readonly<Record<string, string>>,
  logger: ReturnType<typeof createLogger>,
): Promise<Record<string, string>> {
  const product = args.product;
  if (product === undefined) return {};

  const state = await readState(repoRoot, product);
  const projectId = state.environments[args.env]?.["infisical"]?.["projectId"];
  if (typeof projectId !== "string") return {};

  const clientId = credentials["INFISICAL_CLIENT_ID"];
  const clientSecret = credentials["INFISICAL_CLIENT_SECRET"];
  if (clientId === undefined || clientSecret === undefined) return {};

  try {
    const token = await infisicalLogin(clientId, clientSecret);
    const collected: Record<string, string> = {};

    for (const surface of ["api", "mobile"] as const) {
      const path = await pullToEnvFile({
        projectId,
        environment: args.env,
        surface,
        repoRoot,
        product,
        token,
        logger,
      });
      // Read back what Infisical had, so keys a human pasted after the last run
      // (Clerk, the Anthropic key) are visible to every driver in this one.
      Object.assign(collected, parseDotenv(await readFile(path, "utf8")));
      logger.debug(`seeded ${Object.keys(collected).length} value(s) from ${path}`);
    }

    return collected;
  } catch (error) {
    logger.debug(`could not seed from Infisical: ${(error as Error).message}`);
    return {};
  }
}

async function commandPlan(options: RunOptions, args: Args): Promise<number> {
  const results = await runPlan(options);

  if (args.json) {
    console.log(JSON.stringify(results, null, 2));
    return 0;
  }

  console.log(`\nPlan for ${options.product} (${options.env})\n`);

  for (const result of results) {
    if (result.reason !== undefined) {
      console.log(`  ${result.driver.padEnd(12)} skipped — ${result.reason}`);
      continue;
    }
    for (const step of result.steps) {
      const mark = step.action === "create" ? "+" : step.action === "update" ? "~" : "=";
      const detail = step.detail === undefined ? "" : `  (${step.detail})`;
      console.log(`  ${mark} ${result.driver.padEnd(12)} ${step.resource}${detail}`);
    }
  }

  console.log("\n  + create   ~ update   = no change\n");
  return 0;
}

async function commandApply(options: RunOptions): Promise<number> {
  console.log(`\nProvisioning ${options.product} (${options.env})\n`);
  const result = await runApply(options);

  await fanOut(options, result.secrets);

  // --dry-run must touch nothing, the ledger file included.
  const ledger = options.dryRun
    ? undefined
    : await writeLedger(
        options.repoRoot,
        options.product,
        options.env,
        result.manualSteps,
        result.state.manualSteps,
      );

  const MARK: Record<string, string> = {
    applied: "✓",
    skipped: "-",
    blocked: "·",
    failed: "✗",
  };

  console.log("");
  for (const outcome of result.outcomes) {
    const reason = outcome.reason === undefined ? "" : ` — ${outcome.reason}`;
    const mark = MARK[outcome.status] ?? "?";
    console.log(`  ${mark} ${outcome.driver.padEnd(12)} ${outcome.status}${reason}`);
  }
  console.log("\n  ✓ applied   - skipped   · blocked   ✗ failed");

  for (const line of summariseLedger(result.manualSteps)) console.log(line);
  if (ledger !== undefined && result.manualSteps.length > 0) {
    console.log(`\n  Full checklist: ${ledger}`);
  }

  console.log("");
  return result.ok ? 0 : 1;
}

/**
 * Write the run's secrets everywhere an app reads from: Infisical first (source of
 * truth), then the local `.env` files and GitHub Actions. Vercel and EAS are pushed
 * by their own drivers, which own the project ids.
 */
async function fanOut(options: RunOptions, secrets: Record<string, string>): Promise<void> {
  if (options.dryRun || Object.keys(secrets).length === 0) return;

  const placement = placementFrom(options.drivers.flatMap((d) => [...d.outputs]));
  const projectId = options.state.environments[options.env]?.["infisical"]?.["projectId"];
  const clientId = options.credentials["INFISICAL_CLIENT_ID"];
  const clientSecret = options.credentials["INFISICAL_CLIENT_SECRET"];

  if (typeof projectId === "string" && clientId !== undefined && clientSecret !== undefined) {
    const token = await infisicalLogin(clientId, clientSecret);
    const written = await pushSecrets(token, {
      projectId,
      environment: options.env,
      secrets,
      placement,
      logger: options.logger,
    });
    options.logger.info(`  stored ${written} secret(s) in Infisical`);
  } else {
    options.logger.warn("Infisical not configured — secrets written to local .env files only");
  }

  const bySurface = splitBySurface(secrets, placement);
  for (const surface of ["api", "mobile"] as Surface[]) {
    const forSurface = bySurface[surface];
    if (Object.keys(forSurface).length === 0) continue;
    if (surface === "mobile" && !options.manifest.surfaces.mobile) continue;

    const path = envFilePath(options.repoRoot, options.product, surface);
    const { written, preserved } = await writeEnvFile(path, forSurface);
    options.logger.info(
      `  wrote ${written} var(s) to apps/${options.product}/${surface}/.env` +
        (preserved > 0 ? ` (${preserved} local override(s) preserved)` : ""),
    );
  }

  const repo = options.state.environments[options.env]?.["github"]?.["repo"];
  const ghToken = options.credentials["GITHUB_TOKEN"];
  if (typeof repo === "string" && ghToken !== undefined) {
    // CI needs the server-side keys only; EXPO_PUBLIC_* are build-time for EAS.
    const forCi = Object.fromEntries(
      Object.entries(secrets).filter(([key]) => !key.startsWith("EXPO_PUBLIC_")),
    );
    const count = await pushToGitHub({
      repo,
      secrets: forCi,
      token: ghToken,
      logger: options.logger,
    });
    options.logger.info(`  stored ${count} GitHub Actions secret(s)`);
  }
}

async function commandVerify(options: RunOptions, args: Args): Promise<number> {
  const results = await runVerify(options);

  if (args.json) {
    console.log(JSON.stringify(results, null, 2));
    return results.every((r) => r.ok) ? 0 : 1;
  }

  console.log(`\nVerifying ${options.product} (${options.env})\n`);
  for (const result of results) {
    console.log(`  ${result.ok ? "✓" : "✗"} ${result.driver.padEnd(12)} ${result.message}`);
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(failed === 0 ? "\nAll good.\n" : `\n${failed} of ${results.length} not ready.\n`);
  return failed === 0 ? 0 : 1;
}

async function commandSync(options: RunOptions): Promise<number> {
  const projectId = options.state.environments[options.env]?.["infisical"]?.["projectId"];
  if (typeof projectId !== "string") {
    throw new FactoryError(
      "config",
      `No Infisical project recorded for ${options.product}/${options.env}. Run \`pnpm factory apply\` first.`,
    );
  }

  const token = await infisicalLogin(
    options.credentials["INFISICAL_CLIENT_ID"] ?? "",
    options.credentials["INFISICAL_CLIENT_SECRET"] ?? "",
  );

  const surfaces: Surface[] = options.manifest.surfaces.mobile ? ["api", "mobile"] : ["api"];
  for (const surface of surfaces) {
    const path = await pullToEnvFile({
      projectId,
      environment: options.env,
      surface,
      repoRoot: options.repoRoot,
      product: options.product,
      token,
      logger: options.logger,
    });
    console.log(`  wrote ${path}`);
  }

  return 0;
}

async function commandDestroy(options: RunOptions, args: Args): Promise<number> {
  if (!args.yes) {
    console.error(
      `Refusing to destroy ${options.product} (${options.env}) without --yes.\n` +
        `This deletes remote resources including the Neon project and its data.`,
    );
    return 1;
  }

  console.log(`\nDestroying ${options.product} (${options.env})\n`);
  const outcomes = await runDestroy(options);

  for (const outcome of outcomes) {
    const mark = outcome.status === "applied" ? "✓" : "✗";
    const reason = outcome.reason === undefined ? "" : ` — ${outcome.reason}`;
    console.log(`  ${mark} ${outcome.driver.padEnd(12)} ${outcome.status}${reason}`);
  }

  await writeState(options.repoRoot, options.product, clearEnvironment(options.state, options.env));

  console.log("");
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    if (error instanceof FactoryError) {
      const where = error.driver === undefined ? "" : ` [${error.driver}]`;
      console.error(`\nerror${where}: ${error.message}\n`);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  });
