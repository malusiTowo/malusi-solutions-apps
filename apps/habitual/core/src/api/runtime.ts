import { SentLive, type SmsProvider } from "@repo/sms";
import { Layer, ManagedRuntime } from "effect";
import { type Database, DatabaseLive } from "../db";

/**
 * Habitual's service environment. `AppEnv` is the set of Effect services the app
 * runtime provides. Add services here (e.g. the AI engine) as features land, and
 * every resolver gets them for free.
 *
 * This module is deliberately separate from `./builder` and `./schema`: building the
 * schema must never construct a runtime, so that `scripts/schema.ts` can emit
 * `schema.graphql` on a box with no environment at all.
 */
export type AppEnv = Database | SmsProvider;

// `mergeAll` builds every branch the first time the runtime is used, so each
// layer must be constructible without its credentials — `SentLive` defers a
// missing key to the first send rather than failing here and taking down the
// resolvers that never touch messaging.
export const AppLive: Layer.Layer<AppEnv> = Layer.mergeAll(DatabaseLive, SentLive);

/** Singleton runtime reused across serverless invocations. */
export const runtime = ManagedRuntime.make(AppLive);
