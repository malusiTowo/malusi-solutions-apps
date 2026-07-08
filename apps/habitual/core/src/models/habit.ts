import { Schema } from "effect";

/** Habitual-specific domain models. This is where product logic lives — the
 *  generic `@repo/db` package holds no models. */

export const HabitColors = ["lime", "orange", "purple", "blue", "pink"] as const;
export type HabitColor = (typeof HabitColors)[number];

export const HABITS_COLLECTION = "habits";
export const USERS_COLLECTION = "users";

export class Habit extends Schema.Class<Habit>("Habit")({
  id: Schema.String,
  userId: Schema.String,
  name: Schema.String,
  color: Schema.Literal(...HabitColors),
  /** Days of week this habit repeats: 0 = Sunday … 6 = Saturday. */
  repeatDays: Schema.Array(Schema.Number),
  reminderAt: Schema.optional(Schema.String),
  dailyGoal: Schema.optional(Schema.String),
  streak: Schema.Number,
  createdAt: Schema.Number,
}) {}

export class User extends Schema.Class<User>("User")({
  id: Schema.String,
  clerkId: Schema.String,
  displayName: Schema.optional(Schema.String),
  level: Schema.Number,
  xp: Schema.Number,
  coins: Schema.Number,
  createdAt: Schema.Number,
}) {}

export const encodeHabit = Schema.encodeUnknown(Habit);
export const decodeHabit = Schema.decodeUnknown(Habit);
