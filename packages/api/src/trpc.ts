import { type AuthContext, CurrentUser, UnauthorizedError } from "@repo/auth";
import { initTRPC, TRPCError } from "@trpc/server";
import { Cause, Effect, Exit, type ManagedRuntime } from "effect";
import superjson from "superjson";

/**
 * Generic tRPC factory. It knows nothing about any product's routers — it only
 * wires the transformer, auth-aware procedures, and the Effect bridge. A domain
 * package calls `createApi<R>()` with its own service environment `R` (the set
 * of Effect services provided by its `ManagedRuntime`) to get typed builders.
 */

export interface TRPCContext<R> {
  readonly auth: AuthContext;
  readonly runtime: ManagedRuntime.ManagedRuntime<R, never>;
}

const toTRPCError = (error: unknown): TRPCError => {
  if (error instanceof TRPCError) return error;
  if (error instanceof UnauthorizedError) {
    return new TRPCError({ code: "UNAUTHORIZED", message: error.message });
  }
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: error instanceof Error ? error.message : "Internal server error",
    cause: error,
  });
};

export function createApi<R>() {
  const t = initTRPC.context<TRPCContext<R>>().create({
    transformer: superjson,
    errorFormatter: ({ shape, error }) => ({
      ...shape,
      data: {
        ...shape.data,
        cause: error.cause instanceof Error ? error.cause.name : undefined,
      },
    }),
  });

  /**
   * Run an Effect program from inside a procedure. Provides `CurrentUser` from
   * the request auth, executes on the app runtime, and maps failures to
   * `TRPCError`.
   */
  const runEffect = async <A, E>(
    ctx: TRPCContext<R>,
    effect: Effect.Effect<A, E, R | CurrentUser>,
  ): Promise<A> => {
    const exit = await ctx.runtime.runPromiseExit(
      Effect.provideService(effect, CurrentUser, ctx.auth),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw toTRPCError(Cause.squash(exit.cause));
  };

  const timingMiddleware = t.middleware(async ({ next, path }) => {
    const start = Date.now();
    const result = await next();
    const durationMs = Date.now() - start;
    if (process.env.NODE_ENV === "development") {
      console.log(`[trpc] ${path} took ${durationMs}ms`);
    }
    return result;
  });

  const publicProcedure = t.procedure.use(timingMiddleware);

  const protectedProcedure = t.procedure.use(timingMiddleware).use(({ ctx, next }) => {
    if (!ctx.auth.userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
    }
    return next({ ctx: { ...ctx, auth: { ...ctx.auth, userId: ctx.auth.userId } } });
  });

  return {
    router: t.router,
    createCallerFactory: t.createCallerFactory,
    middleware: t.middleware,
    publicProcedure,
    protectedProcedure,
    runEffect,
  };
}

export type Api<R> = ReturnType<typeof createApi<R>>;
