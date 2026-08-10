import { Schema } from "effect";

/** Habitual-specific domain models. This is where product logic lives — the
 *  generic `@repo/db` package holds no models.
 *
 *  Client-safe by contract: this module is imported by the mobile app through
 *  `@habitual/core/models`, so it must never reach a server dependency. The
 *  Postgres tables that mirror these types live in `../db/schema.ts`, which
 *  imports *from* here and is never imported back. */

export const HabitColors = ["lime", "orange", "purple", "blue", "pink"] as const;
export type HabitColor = (typeof HabitColors)[number];

export class Habit extends Schema.Class<Habit>("Habit")({
  id: Schema.String,
  userId: Schema.String,
  name: Schema.String,
  color: Schema.Literal(...HabitColors),
  /** Days of week this habit repeats: 0 = Sunday … 6 = Saturday. */
  repeatDays: Schema.Array(Schema.Number),
  // Nullable rather than optional: these mirror nullable columns, and `null` is
  // what a nullable GraphQL field resolves to — an absent key would not round-trip.
  reminderAt: Schema.NullOr(Schema.String),
  dailyGoal: Schema.NullOr(Schema.String),
  streak: Schema.Number,
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf,
}) {}

export class User extends Schema.Class<User>("User")({
  id: Schema.String,
  clerkId: Schema.String,
  displayName: Schema.NullOr(Schema.String),
  level: Schema.Number,
  xp: Schema.Number,
  coins: Schema.Number,
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf,
}) {}

export const encodeHabit = Schema.encodeUnknown(Habit);
export const decodeHabit = Schema.decodeUnknown(Habit);
