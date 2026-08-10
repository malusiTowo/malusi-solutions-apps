import { describe, expect, it } from "vitest";
import { defineProduct } from "./manifest";
import { silentLogger } from "./logger";
import { runApply, runPlan, type RunOptions } from "./runner";
import { emptyState } from "./state";
import { createFakeDriver, type FakeDriverOptions } from "./testing";
import type { Driver } from "./driver";

const manifest = defineProduct({ name: "acme", displayName: "Acme", devPort: 3001 });

function options(drivers: Driver[], overrides: Partial<RunOptions> = {}): RunOptions {
  return {
    drivers,
    product: "acme",
    env: "dev",
    manifest,
    repoRoot: "/nonexistent",
    state: emptyState("acme"),
    credentials: {},
    logger: silentLogger,
    dryRun: true,
    // Never touch disk in unit tests.
    persist: false,
    ...overrides,
  };
}

const fake = (o: FakeDriverOptions) => createFakeDriver(o).driver;

describe("runApply", () => {
  it("accumulates secrets from every driver that succeeds", async () => {
    const result = await runApply(
      options([
        fake({ id: "neon", secrets: { DATABASE_URL: "postgresql://x" } }),
        fake({ id: "sentry", secrets: { SENTRY_DSN: "https://dsn" } }),
      ]),
    );

    expect(result.ok).toBe(true);
    expect(result.secrets).toEqual({
      DATABASE_URL: "postgresql://x",
      SENTRY_DSN: "https://dsn",
    });
  });

  it("feeds an upstream driver's secrets into a downstream driver's outputs", async () => {
    let seen: Record<string, string> = {};
    const neon = fake({ id: "neon", secrets: { DATABASE_URL: "postgresql://x" } });
    const vercel: Driver = {
      ...fake({ id: "vercel", dependsOn: ["neon"] }),
      apply: async (ctx) => {
        seen = { ...ctx.outputs };
        return {};
      },
    };

    await runApply(options([neon, vercel]));
    expect(seen["DATABASE_URL"]).toBe("postgresql://x");
  });

  it("blocks dependents of a failed driver but keeps unrelated branches running", async () => {
    const result = await runApply(
      options([
        fake({ id: "neon", failWith: "Neon 401" }),
        fake({ id: "vercel", dependsOn: ["neon"] }),
        fake({ id: "sentry", secrets: { SENTRY_DSN: "https://dsn" } }),
      ]),
    );

    const status = (id: string) => result.outcomes.find((o) => o.driver === id)?.status;
    expect(status("neon")).toBe("failed");
    expect(status("vercel")).toBe("blocked");
    expect(status("sentry")).toBe("applied");
    // The unrelated branch still produced its output.
    expect(result.secrets["SENTRY_DSN"]).toBe("https://dsn");
    expect(result.ok).toBe(false);
  });

  it("skips a driver whose org-level credential is absent, without failing the run hard", async () => {
    const result = await runApply(options([fake({ id: "neon", credentials: ["NEON_API_KEY"] })]));

    const outcome = result.outcomes[0];
    expect(outcome?.status).toBe("skipped");
    expect(outcome?.reason).toMatch(/NEON_API_KEY/);
  });

  it("runs a driver once its credential is present", async () => {
    const result = await runApply(
      options([fake({ id: "neon", credentials: ["NEON_API_KEY"] })], {
        credentials: { NEON_API_KEY: "sa-1" },
      }),
    );

    expect(result.outcomes[0]?.status).toBe("applied");
  });

  it("treats a driver skipped for credentials as blocking its dependents", async () => {
    const result = await runApply(
      options([
        fake({ id: "github", credentials: ["GITHUB_TOKEN"] }),
        fake({ id: "vercel", dependsOn: ["github"] }),
      ]),
    );

    expect(result.outcomes.find((o) => o.driver === "vercel")?.status).toBe("blocked");
  });

  it("collects manual steps without blocking the run", async () => {
    const clerk: Driver = {
      ...fake({ id: "clerk" }),
      apply: async () => ({
        manualSteps: [
          {
            id: "clerk",
            title: "Create the Clerk application",
            url: "https://dashboard.clerk.com/apps/new",
            instructions: ["Name it acme-dev"],
            provides: [{ key: "CLERK_SECRET_KEY", surfaces: ["api"] as const }],
          },
        ],
      }),
    };

    const result = await runApply(options([clerk, fake({ id: "neon" })]));
    expect(result.manualSteps.map((s) => s.id)).toEqual(["clerk"]);
    expect(result.ok).toBe(true);
  });

  it("does not mutate the state passed in", async () => {
    const state = emptyState("acme");
    await runApply(
      options([fake({ id: "neon", statePatch: { groupId: "665" } })], {
        state,
        dryRun: false,
      }),
    );

    expect(state.environments).toEqual({});
  });

  it("records resource ids into state under the right environment and driver", async () => {
    const result = await runApply(
      options([fake({ id: "neon", statePatch: { groupId: "665" } })], { dryRun: false }),
    );

    expect(result.state.environments["dev"]?.["neon"]).toEqual({ groupId: "665" });
  });

  it("refuses to write a secret-shaped value into committed state", async () => {
    const result = await runApply(
      options([fake({ id: "rogue", statePatch: { token: "sk_live_abc123" } })], {
        dryRun: false,
      }),
    );

    expect(result.outcomes[0]?.status).toBe("failed");
    expect(result.outcomes[0]?.reason).toMatch(/secret-shaped/);
  });
});

describe("runPlan", () => {
  it("reports a step per driver and never calls apply", async () => {
    const { driver, recording } = createFakeDriver({ id: "neon" });
    const plan = await runPlan(options([driver]));

    expect(plan).toEqual([
      { driver: "neon", steps: [{ action: "create", resource: "acme-dev-neon" }] },
    ]);
    expect(recording.calls).toEqual(["plan:neon"]);
  });

  it("reports missing credentials rather than throwing", async () => {
    const plan = await runPlan(options([fake({ id: "neon", credentials: ["NEON_KEY"] })]));
    expect(plan[0]?.reason).toMatch(/missing credentials: NEON_KEY/);
  });
});
