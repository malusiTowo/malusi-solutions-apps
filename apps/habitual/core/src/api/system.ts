import { ping } from "../db";
import { builder, runEffect } from "./builder";
import { HealthType, PingType } from "./types";

/**
 * Liveness probe. Deliberately does *not* go through `runEffect`, so it needs
 * neither `DATABASE_URL` nor a built runtime and answers on a cold, unconfigured
 * box. Use `dbPing` when you want to know whether the database is reachable.
 */
builder.queryField("health", (t) =>
  t.field({
    type: HealthType,
    resolve: () => ({ ok: true as const, service: "habitual", ts: Date.now() }),
  }),
);

/** Readiness probe — actually touches Postgres. */
builder.queryField("dbPing", (t) =>
  t.field({
    type: PingType,
    resolve: (_parent, _args, ctx) => runEffect(ctx, ping()),
  }),
);
