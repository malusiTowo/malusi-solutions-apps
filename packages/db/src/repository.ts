import { Effect } from "effect";
import type {
  Document,
  Filter,
  FindOptions,
  OptionalUnlessRequiredId,
  UpdateFilter,
} from "mongodb";
import { Mongo } from "./client";
import { DbError } from "./errors";

/**
 * Generic, product-agnostic repository helpers. Each wraps a MongoDB operation
 * in an Effect that fails with `DbError`. Domain packages compose these into
 * typed data access for their own collections.
 */

const run = <A>(operation: string, f: () => Promise<A>) =>
  Effect.flatMap(Mongo, () =>
    Effect.tryPromise({ try: f, catch: (cause) => new DbError({ operation, cause }) }),
  );

export const findOne = <T extends Document>(
  collection: string,
  filter: Filter<T>,
  options?: FindOptions,
) =>
  Effect.flatMap(Mongo, ({ collection: c }) =>
    Effect.tryPromise({
      try: () => c<T>(collection).findOne(filter, options),
      catch: (cause) => new DbError({ operation: `findOne(${collection})`, cause }),
    }),
  );

export const findMany = <T extends Document>(
  collection: string,
  filter: Filter<T> = {} as Filter<T>,
  options?: FindOptions,
) =>
  Effect.flatMap(Mongo, ({ collection: c }) =>
    Effect.tryPromise({
      try: () => c<T>(collection).find(filter, options).toArray(),
      catch: (cause) => new DbError({ operation: `findMany(${collection})`, cause }),
    }),
  );

export const insertOne = <T extends Document>(
  collection: string,
  doc: OptionalUnlessRequiredId<T>,
) =>
  Effect.flatMap(Mongo, ({ collection: c }) =>
    Effect.tryPromise({
      try: () => c<T>(collection).insertOne(doc),
      catch: (cause) => new DbError({ operation: `insertOne(${collection})`, cause }),
    }),
  );

export const updateOne = <T extends Document>(
  collection: string,
  filter: Filter<T>,
  update: UpdateFilter<T>,
) =>
  Effect.flatMap(Mongo, ({ collection: c }) =>
    Effect.tryPromise({
      try: () => c<T>(collection).updateOne(filter, update),
      catch: (cause) => new DbError({ operation: `updateOne(${collection})`, cause }),
    }),
  );

export const deleteOne = <T extends Document>(collection: string, filter: Filter<T>) =>
  Effect.flatMap(Mongo, ({ collection: c }) =>
    Effect.tryPromise({
      try: () => c<T>(collection).deleteOne(filter),
      catch: (cause) => new DbError({ operation: `deleteOne(${collection})`, cause }),
    }),
  );

export const countDocuments = <T extends Document>(
  collection: string,
  filter: Filter<T> = {} as Filter<T>,
) =>
  Effect.flatMap(Mongo, ({ collection: c }) =>
    Effect.tryPromise({
      try: () => c<T>(collection).countDocuments(filter),
      catch: (cause) => new DbError({ operation: `countDocuments(${collection})`, cause }),
    }),
  );

export { run };
