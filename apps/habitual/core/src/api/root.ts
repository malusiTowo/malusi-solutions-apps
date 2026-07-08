import { Effect } from "effect";
import { habitRouter } from "./habit";
import { publicProcedure, router, runEffect } from "./trpc";

export const appRouter = router({
  /** DB-free liveness probe — safe to call without a Mongo connection. */
  health: publicProcedure.query(({ ctx }) =>
    runEffect(ctx, Effect.succeed({ ok: true, service: "habitual", ts: Date.now() })),
  ),
  habit: habitRouter,
});

export type AppRouter = typeof appRouter;
