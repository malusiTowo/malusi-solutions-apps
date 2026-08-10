/**
 * Re-export of drizzle's Postgres schema builders (`pgTable`, `text`, `uuid`, …).
 *
 * Same single-copy rationale as `./orm`. This is the module a product's
 * `db/schema.ts` imports — and, because it pulls in `drizzle-orm/pg-core`, it must
 * never be reachable from a client-safe subpath that Metro bundles.
 */
export * from "drizzle-orm/pg-core";
