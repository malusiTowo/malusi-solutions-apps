import { requireUserId } from "@repo/api";
import { Repository } from "@repo/db";
import { Effect, Schema } from "effect";
import { HABITS_COLLECTION, HabitColors } from "../models/habit";
import { protectedProcedure, router, runEffect } from "./trpc";

/** Input validators (Effect Schema, used as tRPC custom parsers). */
const CreateHabitInput = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  color: Schema.Literal(...HabitColors),
  repeatDays: Schema.Array(Schema.Number),
  reminderAt: Schema.optional(Schema.String),
  dailyGoal: Schema.optional(Schema.String),
});

const parseCreateHabit = Schema.decodeUnknownSync(CreateHabitInput);

export interface HabitDoc {
  id: string;
  userId: string;
  name: string;
  color: (typeof HabitColors)[number];
  repeatDays: readonly number[];
  reminderAt?: string;
  dailyGoal?: string;
  streak: number;
  createdAt: number;
}

/**
 * Habit router — skeleton procedures. `list`/`create` exercise the full stack
 * (auth → Effect → Mongo) but the streak/XP engine is a follow-up.
 */
export const habitRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    runEffect(
      ctx,
      Effect.gen(function* () {
        const userId = yield* requireUserId;
        return yield* Repository.findMany<HabitDoc>(HABITS_COLLECTION, { userId });
      }),
    ),
  ),

  create: protectedProcedure
    .input((raw: unknown) => parseCreateHabit(raw))
    .mutation(({ ctx, input }) =>
      runEffect(
        ctx,
        Effect.gen(function* () {
          const userId = yield* requireUserId;
          const doc: HabitDoc = {
            id: crypto.randomUUID(),
            userId,
            name: input.name,
            color: input.color,
            repeatDays: input.repeatDays,
            reminderAt: input.reminderAt,
            dailyGoal: input.dailyGoal,
            streak: 0,
            createdAt: Date.now(),
          };
          yield* Repository.insertOne<HabitDoc>(HABITS_COLLECTION, doc);
          return doc;
        }),
      ),
    ),
});
