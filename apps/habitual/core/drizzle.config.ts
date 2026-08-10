import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit config for Habitual.
 *
 * It lives beside the schema it describes rather than in `api/`, because `core`
 * owns the domain and `api` is only one of the product's deployables. The database
 * URL is an `api`-surface secret, so that is the `.env` this reads — drizzle-kit
 * loads none on its own.
 */
loadEnv({ path: fileURLToPath(new URL("../api/.env", import.meta.url)) });

export default defineConfig({
  // A relative path, not the `@habitual/core/db` subpath: drizzle-kit bundles this
  // file with esbuild and would not resolve the workspace exports map.
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // DDL goes over the direct endpoint; the pooler rejects some schema statements.
  dbCredentials: { url: process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"] ?? "" },
  strict: true,
  verbose: true,
  // No `casing` setting on purpose: every column names itself explicitly in the
  // schema, so drizzle-kit and the runtime can never disagree about a column name.
});
