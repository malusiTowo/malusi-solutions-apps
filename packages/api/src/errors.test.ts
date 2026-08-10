import { UnauthorizedError } from "@repo/auth";
import { Data } from "effect";
import { GraphQLError } from "graphql";
import { describe, expect, it } from "vitest";
import { toGraphQLError } from "./errors";

/** Stand-ins for `@repo/sms`/`@repo/ai` errors — this package must not import them. */
class FakeSmsError extends Data.TaggedError("SmsError")<{
  readonly reason: string;
  readonly message: string;
}> {}

class FakeDbError extends Data.TaggedError("DbError")<{
  readonly operation: string;
  readonly cause: unknown;
}> {}

describe("toGraphQLError", () => {
  it("passes a GraphQLError through untouched", () => {
    const error = new GraphQLError("nope", { extensions: { code: "CONFLICT" } });
    expect(toGraphQLError(error)).toBe(error);
  });

  it("maps UnauthorizedError to UNAUTHENTICATED", () => {
    expect(
      toGraphQLError(new UnauthorizedError({ message: "Not authenticated" })).extensions.code,
    ).toBe("UNAUTHENTICATED");
  });

  it("maps a rate_limited reason to TOO_MANY_REQUESTS", () => {
    const error = new FakeSmsError({ reason: "rate_limited", message: "slow down" });
    expect(toGraphQLError(error).extensions.code).toBe("TOO_MANY_REQUESTS");
  });

  it("maps client-fault reasons to BAD_USER_INPUT", () => {
    for (const reason of ["invalid_request", "decode", "unprocessable"]) {
      expect(toGraphQLError(new FakeSmsError({ reason, message: "bad" })).extensions.code).toBe(
        "BAD_USER_INPUT",
      );
    }
  });

  it("leaves an unrecognised reason as a server error", () => {
    const error = new FakeSmsError({ reason: "provider", message: "upstream exploded" });
    expect(toGraphQLError(error).extensions.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("leaves an error with no reason as a server error", () => {
    // A failed query is not the caller's fault, so DbError must stay a server error.
    const error = new FakeDbError({ operation: "habit.list", cause: "connection reset" });
    expect(toGraphQLError(error).extensions.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("maps an unknown thrown value to a server error", () => {
    expect(toGraphQLError("something").extensions.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("lets a product mapError hook win", () => {
    const error = new FakeSmsError({ reason: "rate_limited", message: "slow down" });
    const mapped = toGraphQLError(error, {
      mapError: () => new GraphQLError("custom", { extensions: { code: "PAYLOAD_TOO_LARGE" } }),
    });
    expect(mapped.extensions.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("falls through to the defaults when the hook returns undefined", () => {
    const error = new FakeSmsError({ reason: "not_found", message: "gone" });
    expect(toGraphQLError(error, { mapError: () => undefined }).extensions.code).toBe("NOT_FOUND");
  });

  /**
   * The masking contract, asserted from both sides. Yoga masks exactly when it can
   * reach a non-`GraphQLError` via `originalError`, so getting this backwards either
   * leaks a DbError's SQL or turns every client error into "Unexpected error."
   */
  it("attaches originalError to server faults and withholds it from client faults", () => {
    const serverFault = new FakeDbError({ operation: "habit.list", cause: "connection reset" });
    expect(toGraphQLError(serverFault).originalError).toBeDefined();

    const clientFault = new FakeSmsError({ reason: "not_found", message: "gone" });
    expect(toGraphQLError(clientFault).originalError).toBeUndefined();
    // ...and the client-fault message survives, because nothing will mask it.
    expect(toGraphQLError(clientFault).message).toBe("gone");
  });
});
