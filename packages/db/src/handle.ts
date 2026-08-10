import type { NeonQueryFunction, Pool } from "@neondatabase/serverless";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";

/**
 * The connected Neon handle a product's `Database` service carries. It is generic:
 * `TSchema` is the product's drizzle schema module (`typeof import("./schema")`), so
 * this package never names a table.
 *
 * Both Neon drivers are built at once because neither opens a socket on
 * construction — `neon()` returns a tagged-template function and `new Pool()`
 * connects lazily on its first query.
 */
export interface DatabaseHandle<TSchema extends Record<string, unknown>> {
  /** Primary, over Neon's HTTP endpoint. One round-trip per statement, no session. */
  readonly db: NeonHttpDatabase<TSchema>;
  /**
   * Read-routed handle. Identical API to `db`; falls back to the primary when no
   * replicas are configured. Never write through this — replicas lag.
   */
  readonly read: NeonHttpDatabase<TSchema>;
  /**
   * WebSocket pool. The only handle that supports interactive transactions —
   * `db.transaction` on the HTTP driver silently degrades to a non-interactive
   * batch, so it is deliberately not exposed.
   */
  readonly pool: NeonDatabase<TSchema>;
  /** Escape hatch to the underlying clients, for raw SQL and pool introspection. */
  readonly client: {
    readonly http: NeonQuery;
    readonly pool: Pool;
  };
}

/** The tagged-template query function `neon()` returns with its default options. */
export type NeonQuery = NeonQueryFunction<false, false>;

/**
 * The exact transaction handle drizzle passes to a `transaction` callback. Derived
 * from the driver's own signature rather than re-declared, so it cannot drift.
 */
export type Transaction<TSchema extends Record<string, unknown>> = Parameters<
  Parameters<NeonDatabase<TSchema>["transaction"]>[0]
>[0];
