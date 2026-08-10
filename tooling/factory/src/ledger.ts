/**
 * The manual-step ledger.
 *
 * Three things cannot be automated: creating a Clerk application, minting an
 * Anthropic API key, and (without a reviewed Stripe App) obtaining a Stripe account.
 * Rather than letting those become tribal knowledge, `apply` writes them to
 * `apps/<product>/.factory/manual-steps.md` as a deep-linked checklist and prints
 * them at the end of the run.
 *
 * The ledger never blocks: the rest of the graph provisions regardless.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stateDir } from "./state";
import type { Env, ManualStep } from "./types";

export function ledgerPath(repoRoot: string, product: string): string {
  return join(stateDir(repoRoot, product), "manual-steps.md");
}

export function renderLedger(
  product: string,
  env: Env,
  steps: readonly ManualStep[],
  done: Readonly<Record<string, "pending" | "done">>,
): string {
  const lines = [
    `# Manual steps — ${product} (${env})`,
    "",
    "These providers have no create API, so the factory cannot do them for you.",
    "Everything else has already been provisioned.",
    "",
    `After completing these, run \`pnpm factory verify ${product}\` to confirm the`,
    `credentials are live, then \`pnpm factory apply ${product}\` to fan them out.`,
    "",
  ];

  if (steps.length === 0) {
    lines.push("Nothing outstanding. ✅", "");
    return lines.join("\n");
  }

  for (const [index, step] of steps.entries()) {
    const checked = done[step.id] === "done" ? "x" : " ";
    lines.push(`## ${index + 1}. [${checked}] ${step.title}`, "", `<${step.url}>`, "");
    for (const instruction of step.instructions) lines.push(`- ${instruction}`);
    lines.push("");

    if (step.provides.length > 0) {
      lines.push("Provides:", "");
      for (const provided of step.provides) {
        lines.push(`- \`${provided.key}\` → ${provided.surfaces.join(", ")}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

export async function writeLedger(
  repoRoot: string,
  product: string,
  env: Env,
  steps: readonly ManualStep[],
  done: Readonly<Record<string, "pending" | "done">>,
): Promise<string> {
  const path = ledgerPath(repoRoot, product);
  await mkdir(stateDir(repoRoot, product), { recursive: true });
  await writeFile(path, renderLedger(product, env, steps, done), "utf8");
  return path;
}

/** Compact terminal rendering — the full detail lives in the markdown file. */
export function summariseLedger(steps: readonly ManualStep[]): string[] {
  if (steps.length === 0) return [];

  const lines = ["", `${steps.length} step(s) need you:`, ""];
  for (const [index, step] of steps.entries()) {
    lines.push(`  ${index + 1}. ${step.title}`);
    lines.push(`     ${step.url}`);
    const keys = step.provides.map((p) => p.key).join(", ");
    if (keys !== "") lines.push(`     provides ${keys}`);
  }
  return lines;
}
