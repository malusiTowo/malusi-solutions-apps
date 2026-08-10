import { anonymous, type AuthContext, resolveAuthFromRequest } from "@repo/auth";
import type { ManagedRuntime } from "effect";
import type { GraphQLContext } from "./builder";

/**
 * Build a GraphQL context from an incoming request + an app runtime. Products reach
 * this through `createGraphQLHandler`, passing the `ManagedRuntime` built from their
 * own service layers.
 */
export async function createGraphQLContext<R>(opts: {
  readonly runtime: ManagedRuntime.ManagedRuntime<R, never>;
  readonly headers?: Headers;
  readonly request?: Request;
  readonly auth?: AuthContext;
}): Promise<GraphQLContext<R>> {
  const auth = opts.auth ?? (opts.request ? await resolveAuthFromRequest(opts.request) : anonymous);
  return { auth, runtime: opts.runtime };
}
