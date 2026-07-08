import { createClerkClient } from "@clerk/backend";
import { Context, Data, Effect } from "effect";

/**
 * Generic auth primitives shared server-side. Product APIs build their tRPC
 * context from an `AuthContext`; this package resolves that context from an
 * incoming `Request` using Clerk, and exposes Effect helpers for guarding
 * protected operations. It contains no product-specific logic.
 */

export interface AuthContext {
  readonly userId: string | null;
  readonly sessionId: string | null;
}

export const anonymous: AuthContext = { userId: null, sessionId: null };

export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{
  readonly message: string;
}> {}

/** Effect service carrying the resolved auth context for the current request. */
export class CurrentUser extends Context.Tag("@repo/auth/CurrentUser")<
  CurrentUser,
  AuthContext
>() {}

/** Succeeds with the signed-in user id, or fails with `UnauthorizedError`. */
export const requireUserId: Effect.Effect<string, UnauthorizedError, CurrentUser> = Effect.flatMap(
  CurrentUser,
  (auth) =>
    auth.userId
      ? Effect.succeed(auth.userId)
      : Effect.fail(new UnauthorizedError({ message: "Not authenticated" })),
);

export interface ResolveOptions {
  readonly secretKey?: string;
  readonly publishableKey?: string;
}

/**
 * Resolve an `AuthContext` from a standard `Request` (used by API routes that
 * receive calls from mobile/web clients). Falls back to anonymous on failure.
 */
export async function resolveAuthFromRequest(
  request: Request,
  options: ResolveOptions = {},
): Promise<AuthContext> {
  const secretKey = options.secretKey ?? process.env.CLERK_SECRET_KEY;
  if (!secretKey) return anonymous;

  try {
    const clerk = createClerkClient({
      secretKey,
      publishableKey: options.publishableKey ?? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    });
    const requestState = await clerk.authenticateRequest(request);
    const auth = requestState.toAuth();
    return { userId: auth?.userId ?? null, sessionId: auth?.sessionId ?? null };
  } catch {
    return anonymous;
  }
}
