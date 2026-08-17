import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import nodePlop from "node-plop";

/**
 * Thin CLI over the plopfile, run as `pnpm gen <generator> [answers...]`.
 *
 * Positional arguments after the generator name bypass the matching prompts
 * (plop's standard prompt bypass), which is how `pnpm factory new` scripts the
 * product generator: `pnpm gen product <name> <devPort>`.
 *
 * Runs under tsx (see the root "gen" script), so the plopfile and templates can
 * stay TypeScript without a build step — same trick as `tooling/factory`.
 */
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

const [name, ...bypass] = process.argv.slice(2);

const plop = await nodePlop(join(here, "plopfile.ts"), {
  destBasePath: repoRoot,
  force: false,
});

if (!name) {
  console.log("Usage: pnpm gen <generator> [answers...]\n");
  console.log("Available generators:");
  for (const g of plop.getGeneratorList()) {
    console.log(`  ${g.name}  ${g.description}`);
  }
  process.exit(1);
}

const generator = plop.getGenerator(name);
const answers = await generator.runPrompts(bypass);
const results = await generator.runActions(answers);

for (const change of results.changes) {
  console.log(`${change.type}: ${change.path}`);
}
for (const failure of results.failures) {
  console.error(`FAILED ${failure.type}: ${failure.path} — ${failure.error}`);
}
if (results.failures.length > 0) {
  process.exit(1);
}
