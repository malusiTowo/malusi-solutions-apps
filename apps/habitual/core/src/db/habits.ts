import { DbError } from "@repo/db";
import { desc, eq, sql } from "@repo/db/orm";
import { Effect } from "effect";
import type { Habit } from "../models/habit";
import { type Database, query } from "./client";
import { toHabit } from "./mappers";
import { habits, type NewHabitRow } from "./schema";

/** Habit data access. One module per aggregate; routers stay transport-only. */

export const listHabits = (
  userId: string,
): Effect.Effect<ReadonlyArray<Habit>, DbError, Database> =>
  query("habit.list", ({ read }) =>
    read.select().from(habits).where(eq(habits.userId, userId)).orderBy(desc(habits.createdAt)),
  ).pipe(Effect.map((rows) => rows.map(toHabit)));

export const createHabit = (input: NewHabitRow): Effect.Effect<Habit, DbError, Database> =>
  query("habit.create", ({ db }) => db.insert(habits).values(input).returning()).pipe(
    Effect.flatMap((rows) => {
      const row = rows[0];
      // `noUncheckedIndexedAccess` makes this `Habit | undefined`. RETURNING always
      // yields the inserted row, so an empty result means the write did not happen.
      return row === undefined
        ? Effect.fail(new DbError({ operation: "habit.create", cause: "no row returned" }))
        : Effect.succeed(toHabit(row));
    }),
  );

/** Readiness probe. Cheapest possible statement that proves the HTTP driver works. */
export const ping = (): Effect.Effect<{ readonly ok: true }, DbError, Database> =>
  query("db.ping", ({ read }) => read.execute(sql`select 1`)).pipe(
    Effect.as({ ok: true } as const),
  );
