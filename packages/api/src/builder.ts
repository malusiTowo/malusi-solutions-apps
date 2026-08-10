import SchemaBuilder from "@pothos/core";
import ScopeAuthPlugin from "@pothos/plugin-scope-auth";
import { type AuthContext, CurrentUser } from "@repo/auth";
import { Cause, Effect, Exit, type ManagedRuntime } from "effect";
import { GraphQLError } from "graphql";
import { DateTimeISOResolver, JSONObjectResolver } from "graphql-scalars";
import { type ApiErrorOptions, toGraphQLError } from "./errors";

/**
 * Generic GraphQL factory. It knows nothing about any product's schema — it only
 * wires the scalars, auth-aware field builders, and the Effect bridge. A domain
 * package calls `createApi<R>()` with its own service environment `R` (the set of
 * Effect services provided by its `ManagedRuntime`) to get a typed builder.
 */

export interface GraphQLContext<R> {
  readonly auth: AuthContext;
  readonly runtime: ManagedRuntime.ManagedRuntime<R, never>;
}

/**
 * The `SchemaTypes` every product's builder is instantiated with.
 *
 * `DefaultFieldNullability: false` is not cosmetic. Pothos v4 defaults fields to
 * *nullable* (`defaultFieldNullability ?? options.defaults !== "v3"`), which would
 * make every field in every product's schema optional and push a wall of optional
 * chaining onto the clients. This restores the tRPC-era semantics: a field is
 * non-null unless it says otherwise.
 */
export interface ApiSchemaTypes<R> {
  Context: GraphQLContext<R>;
  AuthScopes: { authenticated: boolean };
  AuthContexts: {
    authenticated: GraphQLContext<R> & { auth: AuthContext & { userId: string } };
  };
  DefaultFieldNullability: false;
  DefaultInputFieldRequiredness: false;
  Scalars: {
    DateTime: { Input: Date; Output: Date };
    JSONObject: {
      Input: Readonly<Record<string, string>>;
      Output: Readonly<Record<string, unknown>>;
    };
  };
}

export function createApi<R>(options: ApiErrorOptions = {}) {
  const builder = new SchemaBuilder<ApiSchemaTypes<R>>({
    plugins: [ScopeAuthPlugin],
    defaultFieldNullability: false,
    scopeAuth: {
      authScopes: (ctx) => ({ authenticated: ctx.auth.userId !== null }),
      unauthorizedError: () =>
        new GraphQLError("Not authenticated", { extensions: { code: "UNAUTHENTICATED" } }),
    },
  });

  // superjson used to carry these across the wire; without it they need real scalars.
  // `DateTimeISO` rather than `DateTime` because the latter also accepts unix
  // timestamps on input, which nothing here wants.
  builder.addScalarType("DateTime", DateTimeISOResolver);
  builder.addScalarType("JSONObject", JSONObjectResolver);

  /**
   * Run an Effect program from inside a resolver. Provides `CurrentUser` from the
   * request auth, executes on the app runtime, and maps failures to `GraphQLError`.
   */
  const runEffect = async <A, E>(
    ctx: GraphQLContext<R>,
    effect: Effect.Effect<A, E, R | CurrentUser>,
  ): Promise<A> => {
    const exit = await ctx.runtime.runPromiseExit(
      Effect.provideService(effect, CurrentUser, ctx.auth),
    );
    if (Exit.isSuccess(exit)) return exit.value;
    throw toGraphQLError(Cause.squash(exit.cause), options);
  };

  return { builder, runEffect };
}

export type Api<R> = ReturnType<typeof createApi<R>>;
