import { UnauthorizedError } from "@repo/auth";
import { GraphQLError } from "graphql";

/**
 * Repo convention: a tagged error may carry a `reason` string naming *why* it
 * failed, and these names have agreed transport semantics (`AiError`, `SmsError`).
 *
 * The lookup is duck-typed on purpose. `@repo/api` must not depend on `@repo/ai`,
 * `@repo/sms`, or any product package, so it recognises the shape rather than the
 * type. An error with no `reason` — `DbError`, for instance — stays an internal
 * error, which is correct: a failed query is not the caller's fault.
 */
const REASON_CODES: Readonly<Record<string, string>> = {
  invalid_request: "BAD_USER_INPUT",
  decode: "BAD_USER_INPUT",
  unprocessable: "BAD_USER_INPUT",
  unauthenticated: "UNAUTHENTICATED",
  forbidden: "FORBIDDEN",
  not_found: "NOT_FOUND",
  conflict: "CONFLICT",
  rate_limited: "TOO_MANY_REQUESTS",
  connection: "TIMEOUT",
};

const reasonOf = (error: unknown): string | undefined =>
  typeof error === "object" && error !== null && "reason" in error
    ? typeof error.reason === "string"
      ? error.reason
      : undefined
    : undefined;

const asError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

/**
 * Whether Yoga masks an error is decided entirely by `originalError`: it walks the
 * chain and masks as soon as it finds something that is not itself a `GraphQLError`.
 * That makes the presence of `originalError` here load-bearing rather than
 * incidental — a classified, client-fault error is built *without* one and reaches
 * the caller verbatim, while anything we could not classify carries the original and
 * is replaced with a generic message before it leaves the process.
 *
 * This is a deliberate change from the tRPC behaviour, which shipped a `DbError`'s
 * message — sometimes quoting SQL — straight to the client.
 *
 * Note we never set `extensions.http.status`: a non-2xx response is a *protocol*
 * error to a GraphQL client, not a field error. Failures belong in `errors[]` on a
 * 200, which is the GraphQL-over-HTTP norm.
 */
const defaultToGraphQLError = (error: unknown): GraphQLError => {
  if (error instanceof GraphQLError) return error;
  if (error instanceof UnauthorizedError) {
    return new GraphQLError(error.message, { extensions: { code: "UNAUTHENTICATED" } });
  }

  const reason = reasonOf(error);
  const code = reason === undefined ? undefined : REASON_CODES[reason];

  if (code !== undefined) {
    const message = error instanceof Error ? error.message : "Request failed";
    return new GraphQLError(message, { extensions: { code } });
  }

  return new GraphQLError("Internal server error", {
    extensions: { code: "INTERNAL_SERVER_ERROR" },
    originalError: asError(error),
  });
};

export interface ApiErrorOptions {
  /**
   * Product hook for errors this package cannot classify. Tried before the
   * defaults; return `undefined` to fall through to them.
   */
  readonly mapError?: (error: unknown) => GraphQLError | undefined;
}

/** Exported for testing the mapping without standing up a schema. */
export const toGraphQLError = (error: unknown, options: ApiErrorOptions = {}): GraphQLError =>
  options.mapError?.(error) ?? defaultToGraphQLError(error);
