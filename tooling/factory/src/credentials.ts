/**
 * Org-level tokens the factory itself authenticates with, loaded from `.env.factory`
 * at the monorepo root. These are *not* product secrets — they are the keys that let
 * the factory create product resources, and they never reach a product's `.env`.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FactoryError } from "./types";

export const FACTORY_ENV_FILE = ".env.factory";

/** Minimal dotenv parse: `KEY=value`, optional quotes, `#` comments, blank lines. */
export function parseDotenv(source: string): Record<string, string> {
  const out: Record<string, string> = {};

  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed
      .slice(0, eq)
      .trim()
      .replace(/^export\s+/, "");
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }

    if (key !== "") out[key] = value;
  }

  return out;
}

/**
 * Load `.env.factory`, letting the real environment win so CI can inject tokens
 * without a file on disk.
 */
export async function loadCredentials(repoRoot: string): Promise<Record<string, string>> {
  const path = join(repoRoot, FACTORY_ENV_FILE);
  let fromFile: Record<string, string> = {};

  try {
    fromFile = parseDotenv(await readFile(path, "utf8"));
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new FactoryError("config", `Could not read ${path}`, { cause });
    }
  }

  const merged: Record<string, string> = { ...fromFile };
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && value !== "") merged[key] = value;
  }
  return merged;
}

/**
 * Which of `required` are absent. Returned rather than thrown so the runner can mark
 * one driver unsatisfied and still run the rest of the graph.
 */
export function missingCredentials(
  credentials: Readonly<Record<string, string>>,
  required: readonly string[],
): string[] {
  return required.filter((key) => {
    const value = credentials[key];
    return value === undefined || value.trim() === "";
  });
}
