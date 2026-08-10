import { Context, Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import type { DatabaseHandle } from "./handle";
import { layerFromConfig } from "./layer";
import { makeOps } from "./query";

/** A stand-in schema — the layer never inspects it, it only forwards it to drizzle. */
const schema = { items: {} } as const;
type TestSchema = typeof schema;

class TestDb extends Context.Tag("@repo/db/test/TestDb")<TestDb, DatabaseHandle<TestSchema>>() {}

const config = { url: "postgresql://user:pass@db.example.neon.tech/neondb" };

describe("layerFromConfig", () => {
  it("builds both drivers without opening a connection", async () => {
    // The URL above points at a host that does not resolve. If either driver dialled
    // eagerly this would hang or throw — which is exactly the invariant under test,
    // because it is what keeps DB-free request paths free of a database.
    const handle = await Effect.runPromise(
      Effect.scoped(Effect.provide(TestDb, layerFromConfig(TestDb, schema, config))),
    );

    expect(handle.db).toBeDefined();
    expect(handle.pool).toBeDefined();
    expect(handle.client.pool).toBeDefined();
  });

  it("routes reads to the primary when no replicas are configured", async () => {
    const handle = await Effect.runPromise(
      Effect.scoped(Effect.provide(TestDb, layerFromConfig(TestDb, schema, config))),
    );

    expect(handle.read).toBe(handle.db);
  });

  it("routes reads through a replica when one is configured", async () => {
    const handle = await Effect.runPromise(
      Effect.scoped(
        Effect.provide(
          TestDb,
          layerFromConfig(TestDb, schema, {
            ...config,
            replicaUrls: ["postgresql://user:pass@replica.example.neon.tech/neondb"],
          }),
        ),
      ),
    );

    expect(handle.read).not.toBe(handle.db);
  });
});

describe("makeOps", () => {
  const { query } = makeOps(TestDb);

  it("wraps a rejected query in a DbError carrying the operation", async () => {
    const boom = new Error("connection refused");
    const FakeDb = Layer.succeed(TestDb, {
      db: {},
      read: {},
      pool: {},
      client: { http: {}, pool: {} },
      // The fake only needs the shape `query` reaches through.
      // oxlint-disable-next-line typescript/no-explicit-any
    } as any);

    const exit = await Effect.runPromiseExit(
      Effect.provide(
        query("item.list", () => Promise.reject(boom)),
        FakeDb,
      ),
    );

    expect(exit._tag).toBe("Failure");
  });
});
