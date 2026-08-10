import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assertValidSchema, printSchema } from "graphql";
import { schema } from "../src/api/schema";

/**
 * Emit `schema.graphql` from the Pothos schema.
 *
 * The artifact is committed: it is what makes an API change visible in review, and
 * what the mobile app's codegen reads. `builder.toSchema` already sorts the schema,
 * so the output is stable across runs.
 *
 * This deliberately reaches `src/api/schema.ts` and nothing under `src/api/runtime.ts`,
 * so it runs on a box with no `.env` at all — no database URL, no provider keys.
 */
const target = fileURLToPath(new URL("../schema.graphql", import.meta.url));

// Fail here rather than at the first request. Pothos will happily build a schema
// graphql-js rejects — an empty `Mutation` (declared but with no fields registered)
// is the easy way to get one.
assertValidSchema(schema);

writeFileSync(target, `${printSchema(schema)}\n`);

console.log(`[codegen] wrote ${target}`);
