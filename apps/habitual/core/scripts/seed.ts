import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { Effect } from "effect";
import { createHabit, DatabaseLive, listHabits, query, users } from "../src/db";

/**
 * Development seed: one demo user and a few habits, idempotent so it can be re-run
 * against a Neon branch as often as you like.
 *
 *   pnpm --filter @habitual/core db:seed
 */
loadEnv({ path: fileURLToPath(new URL("../api/.env", import.meta.url)) });

const DEMO_CLERK_ID = "user_seed_demo";

const HABITS = [
  {
    name: "Morning run",
    color: "lime",
    repeatDays: [1, 3, 5],
    dailyGoal: "5 km",
    reminderAt: null,
  },
  {
    name: "Read",
    color: "purple",
    repeatDays: [0, 1, 2, 3, 4, 5, 6],
    dailyGoal: "20 pages",
    reminderAt: null,
  },
  {
    name: "Meditate",
    color: "blue",
    repeatDays: [1, 2, 3, 4, 5],
    dailyGoal: null,
    reminderAt: "7:00 AM",
  },
] as const;

const program = Effect.gen(function* () {
  yield* query("seed.user", ({ db }) =>
    db
      .insert(users)
      .values({ clerkId: DEMO_CLERK_ID, displayName: "Demo" })
      .onConflictDoNothing({ target: users.clerkId }),
  );

  // Habits have no natural key, so dedupe by name to keep re-runs a no-op.
  const existing = yield* listHabits(DEMO_CLERK_ID);
  const present = new Set(existing.map((habit) => habit.name));

  for (const habit of HABITS) {
    if (present.has(habit.name)) continue;
    yield* createHabit({
      userId: DEMO_CLERK_ID,
      name: habit.name,
      color: habit.color,
      repeatDays: [...habit.repeatDays],
      reminderAt: habit.reminderAt,
      dailyGoal: habit.dailyGoal,
    });
  }

  const all = yield* listHabits(DEMO_CLERK_ID);
  console.log(`seeded ${DEMO_CLERK_ID}: ${all.length} habits`);
});

const exit = await Effect.runPromiseExit(Effect.scoped(Effect.provide(program, DatabaseLive)));
if (exit._tag === "Failure") {
  console.error("seed failed:", exit.cause);
  process.exitCode = 1;
}
