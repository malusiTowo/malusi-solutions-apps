import { migrate as runMigrations } from "drizzle-orm/neon-serverless/migrator";
import { Effect } from "effect";
import { DbError } from "./errors";
import type { DatabaseHandle } from "./handle";

/**
 * Applying a migration folder from application code.
 *
 * Kept on its own export subpath (`@repo/db/migrate`) so the migrator never lands
 * in a Next.js server bundle. The normal path for this monorepo is `drizzle-kit
 * migrate` from the product's `core` package; this exists for deployment targets
 * that would rather migrate at startup.
 *
 * Migrations run over the WebSocket pool because DDL needs a real session.
 */
export const migrate = <TSchema extends Record<string, unknown>>(
  handle: DatabaseHandle<TSchema>,
  migrationsFolder: string,
): Effect.Effect<void, DbError> =>
  Effect.tryPromise({
    try: () => runMigrations(handle.pool, { migrationsFolder }),
    catch: (cause) => new DbError({ operation: `migrate(${migrationsFolder})`, cause }),
  });
