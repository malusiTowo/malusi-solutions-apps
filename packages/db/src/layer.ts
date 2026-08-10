import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePool } from "drizzle-orm/neon-serverless";
import { withReplicas } from "drizzle-orm/pg-core";
import { Config, type Context, Effect, Layer, type Scope } from "effect";
import ws from "ws";
import type { DatabaseHandle } from "./handle";

/**
 * Layer constructors for a product's `Database` service.
 *
 * The product owns the `Context.Tag` (so two products are never confusable in an
 * Effect environment) and passes it in; this package owns the connection logic and
 * knows nothing about any schema.
 */

export interface DatabaseConfig {
  /** Neon **pooled** connection string. Used by both drivers. */
  readonly url: string;
  /** Optional read-replica endpoints. Reads are routed round-robin across them. */
  readonly replicaUrls?: ReadonlyArray<string>;
  /** Max WebSocket pool connections. Serverless functions should stay small. */
  readonly poolMax?: number;
  /** Log every generated statement. Never enable in production. */
  readonly logger?: boolean;
}

const make = <TSchema extends Record<string, unknown>>(
  schema: TSchema,
  config: DatabaseConfig,
): Effect.Effect<DatabaseHandle<TSchema>, never, Scope.Scope> =>
  Effect.gen(function* () {
    // Node has no global WebSocket the Neon driver will pick up, so wire ws in once.
    neonConfig.webSocketConstructor = ws;

    const logger = config.logger ?? false;
    const http = neon(config.url);
    const db = drizzleHttp(http, { schema, logger });

    const replicas = (config.replicaUrls ?? []).map((url) =>
      drizzleHttp(neon(url), { schema, logger }),
    );
    // `withReplicas` needs a non-empty tuple; with none configured reads use the
    // primary, so callers can always go through `read` without branching.
    const [first, ...rest] = replicas;
    const read = first === undefined ? db : withReplicas(db, [first, ...rest]);

    // Constructed, not connected — the pool dials on its first query, so building
    // this layer opens no socket and a DB-free request path stays DB-free.
    const pool = yield* Effect.acquireRelease(
      Effect.sync(() => new Pool({ connectionString: config.url, max: config.poolMax ?? 10 })),
      (p) => Effect.promise(() => p.end()),
    );

    return {
      db,
      read,
      pool: drizzlePool(pool, { schema, logger }),
      client: { http, pool },
    };
  });

/** Build a database layer from an explicit config (useful in tests / scripts). */
export const layerFromConfig = <Self, TSchema extends Record<string, unknown>>(
  tag: Context.Tag<Self, DatabaseHandle<TSchema>>,
  schema: TSchema,
  config: DatabaseConfig,
): Layer.Layer<Self> => Layer.scoped(tag, make(schema, config));

/**
 * Default layer: reads `DATABASE_URL` and the optional comma-separated
 * `DATABASE_REPLICA_URLS` from the environment. The read happens during layer
 * *construction*, never at import time, so `next build` needs no database.
 */
export const layerConfig = <Self, TSchema extends Record<string, unknown>>(
  tag: Context.Tag<Self, DatabaseHandle<TSchema>>,
  schema: TSchema,
): Layer.Layer<Self> =>
  Layer.unwrapEffect(
    Effect.gen(function* () {
      const url = yield* Config.string("DATABASE_URL");
      const replicaUrls = yield* Config.array(Config.string(), "DATABASE_REPLICA_URLS").pipe(
        Config.withDefault<ReadonlyArray<string>>([]),
      );
      return layerFromConfig(tag, schema, { url, replicaUrls });
    }).pipe(Effect.orDie),
  );
