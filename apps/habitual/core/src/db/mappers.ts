import { Habit, type HabitColor, User } from "../models/habit";
import type { HabitRow, UserRow } from "./schema";

/**
 * Row → domain translation.
 *
 * The two shapes are kept separate on purpose: `HabitRow` is what Postgres stores
 * (nullable columns, snake_case origins), `Habit` is the wire contract the mobile
 * app consumes. Mapping here is the one place that has to know both, and it lives
 * under `db/` because it names drizzle row types.
 */

export const toHabit = (row: HabitRow): Habit =>
  new Habit({
    id: row.id,
    userId: row.userId,
    name: row.name,
    // The column is a pgEnum built from `HabitColors`, so the widening is exact.
    color: row.color as HabitColor,
    repeatDays: row.repeatDays,
    reminderAt: row.reminderAt,
    dailyGoal: row.dailyGoal,
    streak: row.streak,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

export const toUser = (row: UserRow): User =>
  new User({
    id: row.id,
    clerkId: row.clerkId,
    displayName: row.displayName,
    level: row.level,
    xp: row.xp,
    coins: row.coins,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
