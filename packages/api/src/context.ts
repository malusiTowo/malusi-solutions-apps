import { anonymous, type AuthContext, resolveAuthFromRequest } from "@repo/auth";
import type { ManagedRuntime } from "effect";
import type { TRPCContext } from "./trpc";

/**
 * Build a tRPC context from an incoming request + an app runtime. Products call
 * this from their Next.js `/api/trpc` handler, passing the `ManagedRuntime`
 * built from their own service layers.
 */
export async function createTRPCContext<R>(opts: {
  readonly runtime: ManagedRuntime.ManagedRuntime<R, never>;
  readonly headers?: Headers;
  readonly request?: Request;
  readonly auth?: AuthContext;
}): Promise<TRPCContext<R>> {
  const auth = opts.auth ?? (opts.request ? await resolveAuthFromRequest(opts.request) : anonymous);
  return { auth, runtime: opts.runtime };
}
