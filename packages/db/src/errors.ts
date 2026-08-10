import { Data } from "effect";

/** Raised when any database operation fails. Generic — carries no domain meaning. */
export class DbError extends Data.TaggedError("DbError")<{
  readonly operation: string;
  readonly cause: unknown;
}> {}
