import { requireUserId } from "@repo/api";
import { Effect, Schema } from "effect";
import { createHabit, listHabits } from "../db";
import { HabitColors } from "../models/habit";
import { builder, decodeInput, runEffect } from "./builder";
import { HabitColorEnum, HabitType } from "./types";

/** The wire contract. */
const CreateHabitInput = builder.inputType("CreateHabitInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    color: t.field({ type: HabitColorEnum, required: true }),
    repeatDays: t.intList({ required: true }),
    reminderAt: t.string(),
    dailyGoal: t.string(),
  }),
});

/**
 * The refinements GraphQL cannot express — here, a non-empty name.
 *
 * The two declarations are bound by the assignability check below, so adding a
 * field to one and not the other is a `pnpm typecheck` failure rather than a
 * runtime surprise.
 */
const CreateHabitSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  color: Schema.Literal(...HabitColors),
  repeatDays: Schema.Array(Schema.Number),
  reminderAt: Schema.optional(Schema.NullOr(Schema.String)),
  dailyGoal: Schema.optional(Schema.NullOr(Schema.String)),
});

type CreateHabitPayload = typeof CreateHabitSchema.Type;
const _createHabitShapesAgree: (
  input: typeof CreateHabitInput.$inferInput,
) => CreateHabitPayload = (input) => input;

const parseCreateHabit = decodeInput(CreateHabitSchema);

builder.queryField("habits", (t) =>
  t.withAuth({ authenticated: true }).field({
    type: [HabitType],
    resolve: (_parent, _args, ctx) => runEffect(ctx, Effect.flatMap(requireUserId, listHabits)),
  }),
);

builder.mutationField("createHabit", (t) =>
  t.withAuth({ authenticated: true }).field({
    type: HabitType,
    args: { input: t.arg({ type: CreateHabitInput, required: true }) },
    resolve: (_parent, args, ctx) => {
      const input = parseCreateHabit(args.input);
      return runEffect(
        ctx,
        Effect.flatMap(requireUserId, (userId) =>
          createHabit({
            userId,
            name: input.name,
            color: input.color,
            repeatDays: [...input.repeatDays],
            // The columns are nullable; the wire input is optional.
            reminderAt: input.reminderAt ?? null,
            dailyGoal: input.dailyGoal ?? null,
          }),
        ),
      );
    },
  }),
);
