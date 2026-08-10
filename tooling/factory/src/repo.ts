/**
 * Locating the monorepo, its products, and their manifests.
 */
import { access, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { productManifestSchema, type ProductManifest } from "./manifest";
import { FactoryError } from "./types";

/** Lowest port the factory hands out. Habitual already owns 3000. */
export const FIRST_DEV_PORT = 3000;
export const LAST_DEV_PORT = 3999;

const exists = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

/** Walk up from this file looking for the workspace root. */
export async function findRepoRoot(from?: string): Promise<string> {
  let dir = from ?? dirname(fileURLToPath(import.meta.url));

  for (;;) {
    if (await exists(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new FactoryError("config", "Could not find the monorepo root (no pnpm-workspace.yaml)");
    }
    dir = parent;
  }
}

export function manifestPath(repoRoot: string, product: string): string {
  return join(repoRoot, "apps", product, "product.manifest.ts");
}

/** Every directory under `apps/` — whether or not it has a manifest yet. */
export async function listProducts(repoRoot: string): Promise<string[]> {
  try {
    const entries = await readdir(join(repoRoot, "apps"), { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .toSorted();
  } catch {
    return [];
  }
}

/**
 * Load and validate `apps/<product>/product.manifest.ts`.
 *
 * The manifest is TypeScript, so the CLI must run under a TS loader (`tsx`) — see the
 * root `factory` script.
 */
export async function loadManifest(repoRoot: string, product: string): Promise<ProductManifest> {
  const path = manifestPath(repoRoot, product);

  if (!(await exists(path))) {
    throw new FactoryError(
      "config",
      `No manifest at ${path}. Run \`pnpm factory new ${product}\` to scaffold one.`,
    );
  }

  let module: { default?: unknown };
  try {
    module = (await import(pathToFileURL(resolve(path)).href)) as { default?: unknown };
  } catch (cause) {
    // Surface the underlying reason — usually an unresolved import in the manifest.
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new FactoryError("config", `Could not import ${path}: ${reason}`, { cause });
  }

  const parsed = productManifestSchema.safeParse(module.default);
  if (!parsed.success) {
    throw new FactoryError("config", `${path} is not a valid manifest: ${parsed.error.message}`, {
      detail: parsed.error.issues,
    });
  }

  if (parsed.data.name !== product) {
    throw new FactoryError(
      "config",
      `${path} declares name "${parsed.data.name}" but lives in apps/${product}. They must match.`,
    );
  }

  return parsed.data;
}

/** Manifests that currently parse, keyed by product. Unparseable ones are skipped. */
export async function loadAllManifests(repoRoot: string): Promise<Map<string, ProductManifest>> {
  const found = new Map<string, ProductManifest>();

  for (const product of await listProducts(repoRoot)) {
    try {
      found.set(product, await loadManifest(repoRoot, product));
    } catch {
      // A product without a manifest is fine — it predates the factory.
    }
  }

  return found;
}

/**
 * Next free local dev port.
 *
 * Every generated api app previously hardcoded `--port 3000`, so two products could
 * never run side by side. Ports are allocated once at creation and then pinned in the
 * manifest, so they stay stable even if a sibling product is deleted.
 */
export async function allocateDevPort(repoRoot: string): Promise<number> {
  const taken = new Set<number>();
  for (const manifest of (await loadAllManifests(repoRoot)).values()) {
    taken.add(manifest.devPort);
  }

  // Habitual predates manifests and is hardcoded to 3000.
  taken.add(FIRST_DEV_PORT);

  for (let port = FIRST_DEV_PORT; port <= LAST_DEV_PORT; port++) {
    if (!taken.has(port)) return port;
  }

  throw new FactoryError("config", `No free dev port in ${FIRST_DEV_PORT}-${LAST_DEV_PORT}`);
}
