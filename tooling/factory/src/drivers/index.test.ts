/**
 * Integrity checks on the real driver set. These need no credentials — they catch
 * authoring mistakes (a cycle, two drivers owning one env var, a typo'd dependency)
 * that would otherwise only surface halfway through a live provisioning run.
 */
import { describe, expect, it } from "vitest";
import { ALL_DRIVERS } from "./index";
import { activeDrivers, assertNoOutputCollisions, resolveLevels } from "../dag";
import { defineProduct, disabledServices } from "../manifest";
import { outputKeys } from "../driver";

describe("the real driver graph", () => {
  it("resolves without a cycle", () => {
    expect(() => resolveLevels(ALL_DRIVERS)).not.toThrow();
  });

  it("has no two drivers claiming the same env var", () => {
    expect(() => assertNoOutputCollisions(ALL_DRIVERS)).not.toThrow();
  });

  it("only depends on drivers that exist", () => {
    const ids = new Set(ALL_DRIVERS.map((d) => d.id));
    for (const driver of ALL_DRIVERS) {
      for (const dep of driver.dependsOn) {
        expect(ids, `${driver.id} depends on ${dep}`).toContain(dep);
      }
    }
  });

  it("orders vercel after everything that produces a server secret", () => {
    const levels = resolveLevels(ALL_DRIVERS);
    const levelOf = (id: string) => levels.findIndex((l) => l.some((d) => d.id === id));

    for (const upstream of ["github", "neon", "sentry", "posthog", "resend"]) {
      expect(levelOf(upstream), `${upstream} must precede vercel`).toBeLessThan(levelOf("vercel"));
    }
  });

  it("orders stripe and expo after vercel, since both need the deployment URL", () => {
    const levels = resolveLevels(ALL_DRIVERS);
    const levelOf = (id: string) => levels.findIndex((l) => l.some((d) => d.id === id));

    expect(levelOf("vercel")).toBeLessThan(levelOf("stripe"));
    expect(levelOf("vercel")).toBeLessThan(levelOf("expo"));
  });

  it("declares an owner for every variable the app templates read", () => {
    const owned = new Set(ALL_DRIVERS.flatMap(outputKeys));

    // The full set a generated product's api and mobile apps consume.
    const required = [
      "DATABASE_URL",
      "DATABASE_URL_UNPOOLED",
      "CLERK_SECRET_KEY",
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "RESEND_API_KEY",
      "ANTHROPIC_API_KEY",
      "NEXT_PUBLIC_POSTHOG_KEY",
      "NEXT_PUBLIC_POSTHOG_HOST",
      "EXPO_PUBLIC_POSTHOG_KEY",
      "EXPO_PUBLIC_POSTHOG_HOST",
      "SENTRY_DSN",
      "NEXT_PUBLIC_SENTRY_DSN",
      "EXPO_PUBLIC_SENTRY_DSN",
      "EXPO_PUBLIC_API_URL",
    ];

    expect([...required].filter((key) => !owned.has(key))).toEqual([]);
  });

  it("lets clerk and anthropic degrade rather than block the graph", () => {
    // Both automate when an optional token is present and emit a ManualStep when it
    // isn't. Declaring the token in `credentials` would make the runner skip them
    // instead, which loses the punch-list entry that tells you what to go and do.
    for (const id of ["clerk", "anthropic"]) {
      const driver = ALL_DRIVERS.find((d) => d.id === id);
      expect(driver?.credentials, `${id} must not declare required credentials`).toEqual([]);
    }
  });

  it("gives clerk ownership of both the web and mobile publishable keys", () => {
    // One Clerk application serves both surfaces, so sessions are portable between
    // them. If these ever split across drivers, the collision check would catch it.
    const clerk = ALL_DRIVERS.find((d) => d.id === "clerk");
    expect(outputKeys(clerk!).toSorted()).toEqual([
      "CLERK_SECRET_KEY",
      "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    ]);
  });

  it("routes every output to at least one surface", () => {
    for (const driver of ALL_DRIVERS) {
      for (const output of driver.outputs) {
        expect(output.surfaces.length, `${driver.id}.${output.key}`).toBeGreaterThan(0);
      }
    }
  });

  it("still resolves for an api-only product with optional services off", () => {
    const manifest = defineProduct({
      name: "acme",
      displayName: "Acme",
      devPort: 3001,
      surfaces: { api: true, mobile: false },
    });

    const active = activeDrivers(ALL_DRIVERS, disabledServices(manifest));

    // resend/cloudflare/stripe default off, and mobile off removes expo.
    expect(active.map((d) => d.id)).not.toContain("expo");
    expect(active.map((d) => d.id)).not.toContain("stripe");
    expect(() => resolveLevels(active)).not.toThrow();
  });

  it("keeps vercel runnable when the drivers it depends on are disabled", () => {
    const manifest = defineProduct({
      name: "acme",
      displayName: "Acme",
      devPort: 3001,
      services: { neon: false, sentry: false, posthog: false },
    });

    const active = activeDrivers(ALL_DRIVERS, disabledServices(manifest));
    const vercel = active.find((d) => d.id === "vercel");

    expect(vercel?.dependsOn).toEqual(["github"]);
    expect(() => resolveLevels(active)).not.toThrow();
  });
});
