/**
 * Dependency resolution for the driver graph.
 *
 * Drivers are grouped into *levels*: every driver in a level has all its dependencies
 * satisfied by earlier levels, so a level can run concurrently. A driver that fails
 * blocks its transitive dependents but leaves unrelated branches free to continue —
 * one `apply` should make as much progress as it can.
 */
import { type Driver, outputKeys } from "./driver";
import { FactoryError } from "./types";

/** Drivers grouped so that each group can run in parallel, groups run in order. */
export type Levels = readonly (readonly Driver[])[];

/**
 * Topologically sort into parallel levels.
 *
 * Throws on a cycle or a dependency on a driver that isn't in the set — both are
 * authoring bugs, so they fail loudly at load rather than halfway through a run.
 */
export function resolveLevels(drivers: readonly Driver[]): Levels {
  const byId = new Map(drivers.map((d) => [d.id, d]));

  for (const driver of drivers) {
    for (const dep of driver.dependsOn) {
      if (!byId.has(dep)) {
        throw new FactoryError(
          "config",
          `Driver "${driver.id}" depends on "${dep}", which is not in the active driver set. ` +
            `Either the manifest disabled it or the id is a typo.`,
          { driver: driver.id },
        );
      }
    }
  }

  const levels: Driver[][] = [];
  const placed = new Set<string>();
  let remaining = [...drivers];

  while (remaining.length > 0) {
    const ready = remaining.filter((d) => d.dependsOn.every((dep) => placed.has(dep)));

    if (ready.length === 0) {
      const stuck = remaining
        .map((d) => d.id)
        .toSorted()
        .join(", ");
      throw new FactoryError("config", `Dependency cycle among drivers: ${stuck}`);
    }

    // Sort for deterministic output — plan diffs should not churn between runs.
    levels.push(ready.toSorted((a, b) => a.id.localeCompare(b.id)));
    for (const d of ready) placed.add(d.id);
    remaining = remaining.filter((d) => !placed.has(d.id));
  }

  return levels;
}

/**
 * Every driver that transitively depends on `failed`, and so cannot run.
 * Excludes the failed drivers themselves.
 */
export function blockedBy(drivers: readonly Driver[], failed: ReadonlySet<string>): Set<string> {
  const blocked = new Set<string>();
  let changed = true;

  while (changed) {
    changed = false;
    for (const driver of drivers) {
      if (failed.has(driver.id) || blocked.has(driver.id)) continue;
      const upstreamBroken = driver.dependsOn.some((d) => failed.has(d) || blocked.has(d));
      if (upstreamBroken) {
        blocked.add(driver.id);
        changed = true;
      }
    }
  }

  return blocked;
}

/**
 * Reject two drivers claiming the same env var. Without this the fan-out order would
 * silently decide which value wins, and the loser would be a very confusing bug.
 */
export function assertNoOutputCollisions(drivers: readonly Driver[]): void {
  const owner = new Map<string, string>();

  for (const driver of drivers) {
    for (const key of outputKeys(driver)) {
      const existing = owner.get(key);
      if (existing !== undefined) {
        throw new FactoryError(
          "config",
          `Env var "${key}" is claimed by both "${existing}" and "${driver.id}". ` +
            `Exactly one driver must own each output.`,
        );
      }
      owner.set(key, driver.id);
    }
  }
}

/** Prune disabled services, then drop dependencies pointing at the pruned ones. */
export function activeDrivers(drivers: readonly Driver[], disabled: ReadonlySet<string>): Driver[] {
  const kept = drivers.filter((d) => !disabled.has(d.id));
  const keptIds = new Set(kept.map((d) => d.id));

  return kept.map((driver) => {
    const deps = driver.dependsOn.filter((d) => keptIds.has(d));
    return deps.length === driver.dependsOn.length
      ? driver
      : ({ ...driver, dependsOn: deps } as Driver);
  });
}
