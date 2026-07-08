import { createApi } from "@repo/api";
import { type Mongo, MongoLive } from "@repo/db";
import { ManagedRuntime } from "effect";

/**
 * Habitual's tRPC instance. `AppEnv` is the set of Effect services the app
 * runtime provides — currently just Mongo. Add services here (e.g. the AI
 * engine) as features land, and every procedure gets them for free.
 */
export type AppEnv = Mongo;

export const AppLive = MongoLive;

/** Singleton runtime reused across serverless invocations. */
export const runtime = ManagedRuntime.make(AppLive);

const api = createApi<AppEnv>();

export const router = api.router;
export const publicProcedure = api.publicProcedure;
export const protectedProcedure = api.protectedProcedure;
export const createCallerFactory = api.createCallerFactory;
export const runEffect = api.runEffect;
