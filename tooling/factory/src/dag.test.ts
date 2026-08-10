import { describe, expect, it } from "vitest";
import { activeDrivers, assertNoOutputCollisions, blockedBy, resolveLevels } from "./dag";
import { createFakeDriver } from "./testing";
import { FactoryError } from "./types";

const fake = (id: string, dependsOn: string[] = [], outputs: string[] = []) =>
  createFakeDriver({
    id,
    dependsOn,
    outputs: outputs.map((key) => ({ key, surfaces: ["api"] as const })),
  }).driver;

describe("resolveLevels", () => {
  it("groups independent drivers into one level", () => {
    const levels = resolveLevels([fake("a"), fake("b"), fake("c")]);
    expect(levels).toHaveLength(1);
    expect(levels[0]?.map((d) => d.id)).toEqual(["a", "b", "c"]);
  });

  it("places a driver after everything it depends on", () => {
    // vercel needs neon + github; stripe needs vercel's deployment URL.
    const levels = resolveLevels([
      fake("stripe", ["vercel"]),
      fake("vercel", ["neon", "github"]),
      fake("neon"),
      fake("github"),
    ]);

    expect(levels.map((l) => l.map((d) => d.id))).toEqual([
      ["github", "neon"],
      ["vercel"],
      ["stripe"],
    ]);
  });

  it("sorts within a level so plan output is stable across runs", () => {
    const levels = resolveLevels([fake("zeta"), fake("alpha"), fake("mid")]);
    expect(levels[0]?.map((d) => d.id)).toEqual(["alpha", "mid", "zeta"]);
  });

  it("rejects a cycle rather than looping", () => {
    expect(() => resolveLevels([fake("a", ["b"]), fake("b", ["a"])])).toThrow(FactoryError);
    expect(() => resolveLevels([fake("a", ["b"]), fake("b", ["a"])])).toThrow(/cycle/i);
  });

  it("rejects a dependency on a driver that is not in the set", () => {
    expect(() => resolveLevels([fake("vercel", ["neon"])])).toThrow(/not in the active driver set/);
  });
});

describe("blockedBy", () => {
  it("propagates transitively", () => {
    const drivers = [fake("neon"), fake("vercel", ["neon"]), fake("stripe", ["vercel"])];
    expect([...blockedBy(drivers, new Set(["neon"]))].toSorted()).toEqual(["stripe", "vercel"]);
  });

  it("leaves unrelated branches free", () => {
    const drivers = [fake("neon"), fake("vercel", ["neon"]), fake("sentry"), fake("posthog")];
    const blocked = blockedBy(drivers, new Set(["neon"]));
    expect(blocked.has("vercel")).toBe(true);
    expect(blocked.has("sentry")).toBe(false);
    expect(blocked.has("posthog")).toBe(false);
  });

  it("does not include the failed drivers themselves", () => {
    const drivers = [fake("neon"), fake("vercel", ["neon"])];
    expect(blockedBy(drivers, new Set(["neon"])).has("neon")).toBe(false);
  });
});

describe("assertNoOutputCollisions", () => {
  it("accepts disjoint outputs", () => {
    expect(() =>
      assertNoOutputCollisions([
        fake("neon", [], ["DATABASE_URL"]),
        fake("sentry", [], ["SENTRY_DSN"]),
      ]),
    ).not.toThrow();
  });

  it("rejects two drivers claiming the same env var", () => {
    expect(() =>
      assertNoOutputCollisions([
        fake("neon", [], ["DATABASE_URL"]),
        fake("rogue", [], ["DATABASE_URL"]),
      ]),
    ).toThrow(/claimed by both "neon" and "rogue"/);
  });
});

describe("activeDrivers", () => {
  it("drops disabled drivers", () => {
    const active = activeDrivers([fake("neon"), fake("stripe")], new Set(["stripe"]));
    expect(active.map((d) => d.id)).toEqual(["neon"]);
  });

  it("preserves a pruned driver's methods and outputs", () => {
    // Pruning rebuilds the driver object, so its methods have to survive the copy —
    // otherwise a disabled dependency would silently break an unrelated driver.
    const original = fake("vercel", ["resend"], ["NEXT_PUBLIC_APP_URL"]);
    const pruned = activeDrivers([original, fake("resend")], new Set(["resend"]))[0];

    expect(pruned?.dependsOn).toEqual([]);
    expect(pruned?.outputs).toEqual([{ key: "NEXT_PUBLIC_APP_URL", surfaces: ["api"] }]);
    for (const method of ["resourceName", "plan", "apply", "verify", "destroy"] as const) {
      expect(typeof pruned?.[method], method).toBe("function");
    }
  });

  it("prunes edges pointing at a disabled driver so the graph still resolves", () => {
    // Disabling cloudflare must not strand resend, which merely feeds it DNS records.
    const active = activeDrivers(
      [fake("resend"), fake("cloudflare", ["resend"]), fake("vercel", ["cloudflare"])],
      new Set(["cloudflare"]),
    );

    expect(active.find((d) => d.id === "vercel")?.dependsOn).toEqual([]);
    expect(() => resolveLevels(active)).not.toThrow();
  });
});
