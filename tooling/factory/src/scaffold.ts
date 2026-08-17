/**
 * `factory new` — scaffold the code, then let the caller provision.
 *
 * This **wraps** the existing plop generator rather than replacing it, so
 * `tooling/generators/templates` stays the single source of truth for what a product's
 * files look like, and `pnpm gen product` keeps working standalone for offline use.
 *
 * The factory adds the two things plop cannot: a dev port that does not collide with
 * a sibling product, and a manifest describing which services the product wants.
 */
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { exec } from "./exec";
import { allocateDevPort, manifestPath } from "./repo";
import { FactoryError, type Logger } from "./types";

export interface NewProductOptions {
  readonly repoRoot: string;
  readonly product: string;
  readonly logger: Logger;
}

const exists = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

function renderManifest(product: string, displayName: string, devPort: number): string {
  return `import { defineProduct } from "@tooling/factory/manifest";

/**
 * What ${displayName} needs from the outside world.
 *
 * \`pnpm factory apply ${product}\` reads this and provisions a real project in each
 * service. Resource ids land in .factory/state.json; secrets go to Infisical and are
 * materialised into api/.env and mobile/.env.
 */
export default defineProduct({
  name: "${product}",
  displayName: "${displayName}",
  // Uncomment once the domain exists in Cloudflare, then re-apply.
  // domain: "${product}.malusi.solutions",
  devPort: ${devPort},
  surfaces: { api: true, mobile: true },
  services: {
    neon: { region: "aws-eu-west-1", pgVersion: 17 },
    vercel: { framework: "nextjs" },
    sentry: { projects: ["web", "mobile"], team: "malusi-solutions" },
    posthog: { host: "https://us.i.posthog.com" },
    // Needs \`domain\` set and a Cloudflare zone.
    // resend: { from: "hello@${product}.malusi.solutions" },
    // cloudflare: { zone: "malusi.solutions" },
    // stripe: { mode: "shared-account", monthlyPriceMinor: 900, currency: "gbp" },
    // Needs \`domain\` set and SENT_DM_API_KEY in .env.factory.
    // sent: { webhookPath: "/api/webhooks/sent" },
    github: true,
    infisical: true,
    expo: true,
    clerk: true,
    anthropic: true,
  },
});
`;
}

const titleCase = (value: string) =>
  value.replace(/(^|[-_ ])(\w)/g, (_m, _s, c: string) => c.toUpperCase()).replace(/-/g, " ");

/**
 * Scaffold `apps/<product>` and write its manifest.
 *
 * Safe to re-run: an existing product directory is left alone, so `factory new` on an
 * already-scaffolded product degrades to "just provision it".
 */
export async function newProduct(options: NewProductOptions): Promise<{ devPort: number }> {
  const { repoRoot, product, logger } = options;

  if (!/^[a-z][a-z0-9-]*$/.test(product)) {
    throw new FactoryError("config", `"${product}" must be lowercase kebab-case (e.g. my-app)`);
  }

  const appDir = join(repoRoot, "apps", product);
  const devPort = await allocateDevPort(repoRoot);

  if (await exists(appDir)) {
    logger.info(`apps/${product} already exists — skipping scaffold`);
  } else {
    logger.info(`Scaffolding apps/${product} on port ${devPort}`);
    // plop reads `name` and `devPort` from the prompt bypass arguments.
    await exec("pnpm", ["gen", "product", product, String(devPort)], {
      cwd: repoRoot,
      driver: "scaffold",
      timeoutSeconds: 300,
    });
  }

  const manifest = manifestPath(repoRoot, product);
  if (await exists(manifest)) {
    logger.info(`${manifest} already exists — leaving it alone`);
  } else {
    await mkdir(appDir, { recursive: true });
    await writeFile(manifest, renderManifest(product, titleCase(product), devPort), "utf8");
    logger.info(`Wrote apps/${product}/product.manifest.ts`);
  }

  // The new workspace has to be linked before anything can typecheck or run.
  logger.info("Linking the new workspace (pnpm install)…");
  await exec("pnpm", ["install", "--silent"], {
    cwd: repoRoot,
    driver: "scaffold",
    timeoutSeconds: 600,
  });

  return { devPort };
}
