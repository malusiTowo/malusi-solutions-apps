import { type Context, Effect, Exit, Runtime } from "effect";
import { DbError } from "./errors";
import type { DatabaseHandle, Transaction } from "./handle";

/**
 * Generic, product-agnostic query helpers, bound once to a product's `Database` tag
 * so call sites never pass it. Every helper wraps a drizzle promise in an Effect
 * that fails with `DbError`.
 *
 * There is deliberately no `findOne`/`insertOne`-style repository layer: with a
 * typed schema the query builder *is* the API, and wrapping it would only erase
 * types. Compose drizzle queries inside `query` instead:
 *
 *   query("habit.list", ({ read }) => read.select().from(habits))
 *
 * `db.batch` needs no wrapper either — its per-element result inference does not
 * survive a generic signature, so use it through `query` as well:
 *
 *   query("habit.createWithLog", ({ db }) => db.batch([first, second]))
 */

/** Carries a failed `Exit` out through drizzle's throw-to-rollback contract. */
class RollbackSignal {
  constructor(readonly exit: Exit.Exit<unknown, unknown>) {}
}

export interface DatabaseOps<Self, TSchema extends Record<string, unknown>> {
  /** Run any drizzle query against the handle, tagging failures with `operation`. */
  readonly query: <A>(
    operation: string,
    f: (handle: DatabaseHandle<TSchema>) => Promise<A>,
  ) => Effect.Effect<A, DbError, Self>;

  /** Interactive transaction over the WebSocket pool, for a plain async body. */
  readonly transactionPromise: <A>(
    operation: string,
    f: (tx: Transaction<TSchema>) => Promise<A>,
  ) => Effect.Effect<A, DbError, Self>;

  /**
   * Interactive transaction whose body is itself an Effect, so it can use other
   * services. A typed failure rolls the transaction back and is re-raised intact.
   */
  readonly transaction: <A, E, R>(
    operation: string,
    f: (tx: Transaction<TSchema>) => Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E | DbError, Self | R>;
}

/** Bind the helpers above to one product's `Database` tag. */
export const makeOps = <Self, TSchema extends Record<string, unknown>>(
  tag: Context.Tag<Self, DatabaseHandle<TSchema>>,
): DatabaseOps<Self, TSchema> => {
  const query = <A>(operation: string, f: (handle: DatabaseHandle<TSchema>) => Promise<A>) =>
    Effect.flatMap(tag, (handle) =>
      Effect.tryPromise({
        try: () => f(handle),
        catch: (cause) => new DbError({ operation, cause }),
      }),
    );

  const transactionPromise = <A>(operation: string, f: (tx: Transaction<TSchema>) => Promise<A>) =>
    query(operation, (handle) => handle.pool.transaction(f));

  const transaction = <A, E, R>(
    operation: string,
    f: (tx: Transaction<TSchema>) => Effect.Effect<A, E, R>,
  ): Effect.Effect<A, E | DbError, Self | R> =>
    Effect.gen(function* () {
      const handle = yield* tag;
      const runtime = yield* Effect.runtime<R>();
      const runExit = Runtime.runPromiseExit(runtime);

      const exit = yield* Effect.tryPromise({
        try: () =>
          handle.pool.transaction(async (tx) => {
            const inner = await runExit(f(tx));
            // Throwing is the only way to make drizzle issue a ROLLBACK; the Exit
            // rides on the thrown value so the caller's typed failure survives.
            if (Exit.isFailure(inner)) throw new RollbackSignal(inner);
            return inner;
          }),
        catch: (cause) =>
          cause instanceof RollbackSignal
            ? (cause.exit as Exit.Exit<A, E>)
            : new DbError({ operation, cause }),
      }).pipe(
        // A rolled-back body is not a database failure — recover its Exit and let
        // the `yield*` below re-raise the caller's own error type.
        Effect.catchAll((error) =>
          error instanceof DbError ? Effect.fail(error) : Effect.succeed(error),
        ),
      );

      return yield* exit;
    });

  return { query, transactionPromise, transaction };
};
