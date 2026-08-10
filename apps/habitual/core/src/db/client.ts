import { type DatabaseHandle, layerConfig, makeOps } from "@repo/db";
import { Context, type Layer } from "effect";
import * as schema from "./schema";

/**
 * Habitual's database service.
 *
 * The tag lives here rather than in `@repo/db` so it is nominally distinct from
 * every other product's, and so the handle is typed by *this* schema. The generic
 * package supplies the connection logic and knows none of it.
 */

export type HabitualSchema = typeof schema;

export class Database extends Context.Tag("@habitual/core/Database")<
  Database,
  DatabaseHandle<HabitualSchema>
>() {}

/** Reads `DATABASE_URL` at layer-construction time — never at import time. */
export const DatabaseLive: Layer.Layer<Database> = layerConfig(Database, schema);

/** Query helpers bound to this product's tag, so call sites never pass it. */
export const { query, transaction, transactionPromise } = makeOps(Database);
