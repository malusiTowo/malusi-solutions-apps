import { useDisableIntrospection } from "@graphql-yoga/plugin-disable-introspection";
import type { ManagedRuntime } from "effect";
import type { GraphQLSchema } from "graphql";
import { createYoga, type Plugin } from "graphql-yoga";
import type { GraphQLContext } from "./builder";
import { createGraphQLContext } from "./context";
import { useMaxDocumentSize, useTiming } from "./plugins";

export interface GraphQLHandlerOptions<R> {
  readonly schema: GraphQLSchema;
  readonly runtime: ManagedRuntime.ManagedRuntime<R, never>;
  /** Must match the route segment the handler is mounted at. */
  readonly graphqlEndpoint?: string;
  readonly isDev?: boolean;
  readonly plugins?: Plugin[];
}

/**
 * Build the fetch handler a product's `/api/graphql` route exports.
 *
 * Everything here is product-agnostic; the only thing a product supplies is its
 * schema and its `ManagedRuntime`.
 *
 * `healthCheckEndpoint` is deliberately left at its default: Yoga would serve a
 * readiness check at `/health`, but mounted under a Next route segment it never
 * receives a request at that path, so the option is inert. The liveness probe that
 * matters is the `health` field on the schema itself.
 */
export function createGraphQLHandler<R>(opts: GraphQLHandlerOptions<R>) {
  const isDev = opts.isDev ?? process.env.NODE_ENV !== "production";
  const graphqlEndpoint = opts.graphqlEndpoint ?? "/api/graphql";

  return createYoga<Record<string, unknown>, GraphQLContext<R>>({
    schema: opts.schema,
    graphqlEndpoint,
    // Yoga needs the runtime's own Response to produce a valid Next response.
    fetchAPI: { Response },
    context: ({ request }) => createGraphQLContext({ runtime: opts.runtime, request }),
    // Server-fault messages never reach the client. See `errors.ts` — an error
    // carrying `originalError` is what opts into this.
    maskedErrors: true,
    graphiql: isDev,
    landingPage: false,
    batching: false,
    logging: isDev,
    plugins: [
      useDisableIntrospection({ isDisabled: () => !isDev }),
      useTiming(),
      useMaxDocumentSize(),
      ...(opts.plugins ?? []),
    ],
  });
}
