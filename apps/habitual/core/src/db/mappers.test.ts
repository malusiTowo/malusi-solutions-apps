import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { Habit, User } from "../models/habit";
import { toHabit, toUser } from "./mappers";
import type { HabitRow, UserRow } from "./schema";

/**
 * Drift guard. The persistence shape (`*Row`) and the wire shape (`Habit`/`User`)
 * are maintained separately on purpose, so this asserts a mapped row still decodes
 * against the domain schema — the failure a type-only check would miss when a
 * column becomes nullable.
 */

const habitRow: HabitRow = {
  id: "0f9c4f7e-2d1a-4b6c-8f6e-2a5b7c9d0e1f",
  userId: "user_2abc",
  name: "Morning run",
  color: "lime",
  repeatDays: [1, 3, 5],
  reminderAt: null,
  dailyGoal: "5 km",
  streak: 3,
  createdAt: new Date("2026-01-01T08:00:00.000Z"),
  updatedAt: new Date("2026-01-02T08:00:00.000Z"),
};

const userRow: UserRow = {
  id: "8a2b1c3d-4e5f-4a6b-9c8d-7e6f5a4b3c2d",
  clerkId: "user_2abc",
  displayName: null,
  level: 1,
  xp: 0,
  coins: 0,
  createdAt: new Date("2026-01-01T08:00:00.000Z"),
  updatedAt: new Date("2026-01-01T08:00:00.000Z"),
};

describe("mappers", () => {
  it("maps a habit row into a decodable Habit", () => {
    expect(() => Schema.decodeUnknownSync(Habit)(toHabit(habitRow))).not.toThrow();
  });

  it("carries nullable columns through as null, not undefined", () => {
    const habit = toHabit(habitRow);
    expect(habit.reminderAt).toBeNull();
    expect(habit.dailyGoal).toBe("5 km");
  });

  it("maps a user row into a decodable User", () => {
    expect(() => Schema.decodeUnknownSync(User)(toUser(userRow))).not.toThrow();
  });

  it("keeps timestamps as Dates, which is what the DateTime scalar serializes", () => {
    expect(toHabit(habitRow).createdAt).toBeInstanceOf(Date);
  });
});
