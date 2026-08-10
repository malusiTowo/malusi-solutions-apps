/**
 * Sentry — one project per surface, because a crash in the Expo app and a 500 in the
 * Next route deserve separate issue streams and release tracking.
 *
 * The DSN is not returned by project creation; it lives on the project's client keys,
 * which is a second call.
 */
import { request, requireJson } from "../http";
import type { Ctx, Driver } from "../driver";
import type { PlanStep, Surface, VerifyResult } from "../types";

const API = "https://sentry.io/api/0";

export const SENTRY_ORG = "malusi-solutions";

/** Sentry project slugs are global within an org, so they carry the environment. */
const slug = (ctx: Ctx, surface: "web" | "mobile") => `${ctx.product}-${surface}-${ctx.env}`;

interface Project {
  readonly id: string;
  readonly slug: string;
}

interface ClientKey {
  readonly dsn: { readonly public: string };
}

const auth = (ctx: Ctx) => ({ authorization: `Bearer ${ctx.credentials["SENTRY_AUTH_TOKEN"]}` });

async function findProject(ctx: Ctx, surface: "web" | "mobile"): Promise<Project | undefined> {
  return request<Project>(`${API}/projects/${SENTRY_ORG}/${slug(ctx, surface)}/`, {
    driver: "sentry",
    headers: auth(ctx),
    allowStatus: [404],
  });
}

/** First client key's public DSN — the value apps put in `SENTRY_DSN`. */
async function dsnFor(ctx: Ctx, surface: "web" | "mobile"): Promise<string | undefined> {
  const keys = await request<readonly ClientKey[]>(
    `${API}/projects/${SENTRY_ORG}/${slug(ctx, surface)}/keys/`,
    { driver: "sentry", headers: auth(ctx), allowStatus: [404] },
  );
  return keys?.[0]?.dsn.public;
}

/** Which Sentry projects this product wants, honouring the mobile surface toggle. */
function wanted(ctx: Ctx): ("web" | "mobile")[] {
  const config = ctx.manifest.services.sentry;
  if (config === false) return [];
  return config.projects.filter((p) => p !== "mobile" || ctx.manifest.surfaces.mobile);
}

export const sentryDriver: Driver = {
  id: "sentry",
  dependsOn: [],
  outputs: [
    { key: "SENTRY_DSN", surfaces: ["api"] },
    { key: "NEXT_PUBLIC_SENTRY_DSN", surfaces: ["api"] },
    { key: "EXPO_PUBLIC_SENTRY_DSN", surfaces: ["mobile"] },
    { key: "SENTRY_ORG", surfaces: ["api"] },
    { key: "SENTRY_PROJECT", surfaces: ["api"] },
  ],
  credentials: ["SENTRY_AUTH_TOKEN"],

  resourceName: (ctx) => slug(ctx, "web"),

  async plan(ctx): Promise<readonly PlanStep[]> {
    const steps: PlanStep[] = [];
    for (const surface of wanted(ctx)) {
      const existing = await findProject(ctx, surface);
      steps.push({
        action: existing ? "noop" : "create",
        resource: `Sentry project "${slug(ctx, surface)}"`,
      });
    }
    return steps;
  },

  async apply(ctx) {
    const config = ctx.manifest.services.sentry;
    if (config === false) return {};
    if (ctx.dryRun) return {};

    const secrets: Record<string, string> = {};
    const statePatch: Record<string, unknown> = { org: SENTRY_ORG };

    for (const surface of wanted(ctx)) {
      let project = await findProject(ctx, surface);

      if (!project) {
        project = await requireJson<Project>(
          `${API}/teams/${SENTRY_ORG}/${config.team}/projects/`,
          {
            method: "POST",
            driver: "sentry",
            headers: auth(ctx),
            body: {
              name: `${ctx.manifest.displayName} ${surface} (${ctx.env})`,
              slug: slug(ctx, surface),
              platform: surface === "web" ? "javascript-nextjs" : "react-native",
            },
          },
        );
        ctx.logger.info(`  created Sentry project ${project.slug}`);
      }

      const dsn = await dsnFor(ctx, surface);
      if (dsn === undefined) {
        ctx.logger.warn(`Sentry project ${project.slug} has no client key yet`);
        continue;
      }

      if (surface === "web") {
        // Server, edge and browser all point at the same web project.
        secrets["SENTRY_DSN"] = dsn;
        secrets["NEXT_PUBLIC_SENTRY_DSN"] = dsn;
        // Consumed by withSentryConfig for source-map upload.
        secrets["SENTRY_ORG"] = SENTRY_ORG;
        secrets["SENTRY_PROJECT"] = project.slug;
        statePatch["web"] = project.slug;
      } else {
        secrets["EXPO_PUBLIC_SENTRY_DSN"] = dsn;
        statePatch["mobile"] = project.slug;
      }
    }

    return { statePatch, secrets };
  },

  async verify(ctx): Promise<VerifyResult> {
    const missing: string[] = [];

    for (const surface of wanted(ctx)) {
      const project = await findProject(ctx, surface);
      if (!project) {
        missing.push(slug(ctx, surface));
        continue;
      }
      if ((await dsnFor(ctx, surface)) === undefined) missing.push(`${project.slug} (no DSN)`);
    }

    return missing.length === 0
      ? { ok: true, message: `${wanted(ctx).length} Sentry project(s) reachable` }
      : { ok: false, message: `missing: ${missing.join(", ")}` };
  },

  async destroy(ctx) {
    for (const surface of wanted(ctx)) {
      await request(`${API}/projects/${SENTRY_ORG}/${slug(ctx, surface)}/`, {
        method: "DELETE",
        driver: "sentry",
        headers: auth(ctx),
        allowStatus: [404],
      });
      ctx.logger.info(`  deleted Sentry project ${slug(ctx, surface)}`);
    }
  },
};

/** Exported for the Expo app.config template, which needs the org/project at build time. */
export function sentryMobileSlug(product: string, env: string): string {
  return `${product}-mobile-${env}`;
}

export type { Surface };
