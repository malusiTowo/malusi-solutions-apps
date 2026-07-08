import { Config, Context, Effect, Layer } from "effect";
import { type Collection, type Db, type Document, MongoClient } from "mongodb";

/**
 * The Mongo service holds a connected client + database handle. It is generic:
 * it knows nothing about any product's collections. Domain packages layer their
 * own typed collection accessors on top of `collection`.
 */
export class Mongo extends Context.Tag("@repo/db/Mongo")<
  Mongo,
  {
    readonly client: MongoClient;
    readonly db: Db;
    readonly collection: <T extends Document = Document>(name: string) => Collection<T>;
  }
>() {}

export interface MongoConfig {
  readonly uri: string;
  readonly dbName: string;
}

/** Build a Mongo layer from an explicit config (useful in tests / scripts). */
export const layerFromConfig = (config: MongoConfig): Layer.Layer<Mongo> =>
  Layer.scoped(
    Mongo,
    Effect.gen(function* () {
      // Construct only — the driver connects lazily on the first operation, so
      // building this layer never opens a socket (health checks stay DB-free).
      const client = yield* Effect.acquireRelease(
        Effect.sync(() => new MongoClient(config.uri)),
        (c) => Effect.promise(() => c.close()),
      );
      const db = client.db(config.dbName);
      return {
        client,
        db,
        collection: <T extends Document = Document>(name: string) => db.collection<T>(name),
      };
    }),
  );

/** Default layer: reads `MONGODB_URI` and `MONGODB_DB_NAME` from the environment. */
export const MongoLive: Layer.Layer<Mongo, never> = Layer.unwrapEffect(
  Effect.gen(function* () {
    const uri = yield* Config.string("MONGODB_URI");
    const dbName = yield* Config.string("MONGODB_DB_NAME");
    return layerFromConfig({ uri, dbName });
  }).pipe(Effect.orDie),
);
