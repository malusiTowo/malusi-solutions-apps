# CLAUDE.md — conventions for this monorepo

## Architecture

- **pnpm workspaces + Vite+ (`vp`).** Workspaces: `apps/*/*`, `packages/*`, `tooling/*`.
  The `vite-plus` root devDependency pins the toolchain version; the global `vp` shim
  defers to it. Task graph, lint, format, and test config all live in `vite.config.ts`
  files (root + one per deployable). Use `vp run <name>`, never bare `vp dev`/`vp build` —
  built-ins can't be overridden and always launch Vite's own server, which no app here uses.
- **Products** live at `apps/<product>/` and contain multiple deployables plus a domain
  package: `core/` (logic), `api/` (Next.js), `mobile/` (Expo).
- **Packages** (`packages/*`) are generic **logic bricks**. Hard rule:
  - `packages/*` may depend on other `packages/*` and **never** on `apps/*`.
  - No product-specific naming or logic in `packages/*`. If it says "habit", it belongs
    in `apps/habitual/core`.
- Packages ship **raw TypeScript** via their `exports` map (no build step). Apps transpile
  them (`transpilePackages` in Next; Metro watches the workspace).

## Where things go

- **Domain models, GraphQL schema, AI modules, analytics event maps** → the product's
  `core` package (e.g. `@habitual/core`). The schema is assembled in `core/src/api/`,
  one module per feature, each registering fields on the shared Pothos builder.
- **The GraphQL transport, Pothos builder factory, Yoga handler, Effect runtime
  bridge** → `@repo/api` (generic, no schema).
- **Database connection + Effect query helpers** → `@repo/db` (generic, no tables).
  A product declares its own `Database` tag and drizzle schema in `core/src/db/`.
- **SMS/WhatsApp/RCS transport** → `@repo/sms` (generic, no templates or numbers).
- **Design tokens** → `@repo/design`; they feed the Unistyles theme (native) and the
  Tailwind preset (web). Do not hardcode colors in apps.

## Effect

- Business logic is written as Effect programs. Services are `Context.Tag`s provided by
  `Layer`s; apps build a `ManagedRuntime` from their layers (see `core/src/api/runtime.ts`).
- Resolvers call `runEffect(ctx, program)` from `@repo/api`, which provides
  `CurrentUser` from the request auth and maps failures to `GraphQLError`.
- Layers read config at **construction** time, never at import time, so `next build`
  needs no credentials. Neither Neon driver dials on construction either, so building
  the database layer opens no socket.
- `health` deliberately bypasses `runEffect` so it answers on an unconfigured box;
  `dbPing` is the probe that actually touches Postgres.
- `core/src/api/runtime.ts` is kept out of the schema's import graph on purpose, so
  `pnpm codegen` can emit the SDL without constructing a runtime or reading any env.

## GraphQL (`@repo/api` + `core/src/api`)

- Pothos (code-first) + GraphQL Yoga, served from one route per product at
  `/api/graphql`. Root fields are **flat** — no namespace object types.
- **Two generated artifacts, both committed**: `core/schema.graphql` (emitted from the
  Pothos schema) and `mobile/src/gql/` (graphql-codegen client preset). `typecheck`
  and `build` depend on the `codegen` task; CI fails if either is stale. They are
  committed so a fresh clone can `pnpm dev` without running codegen first.
- `defaultFieldNullability: false` is set in `@repo/api`. Pothos v4 defaults fields to
  _nullable_; without this every field in every product's schema becomes optional.
- Enums read their members from the tuple the domain already declares (`HabitColors`,
  `SmsStatuses`, `SmsChannels`, `SmsDirections`) — never restate the strings.
- Expose helpers (`t.exposeIntList`) reject a `ReadonlyArray`. Use
  `t.field({ type: ["Int"], resolve })`, which is checked covariantly, rather than
  copying the array.
- **Error masking is driven by `originalError`.** A classified client fault is built
  without one and reaches the caller verbatim; anything unclassified carries the
  original and Yoga replaces it with a generic message. Getting this backwards either
  leaks a `DbError`'s SQL or turns every validation failure into "Unexpected error."
  `errors.test.ts` guards both directions.
- GraphQL cannot express refinements like an E.164 pattern, so inputs are decoded a
  second time with Effect Schema. Route those through `decodeInput` (not
  `Schema.decodeUnknownSync` directly) — `runEffect`'s error mapping only sees
  failures that travel through an Effect. Bind each input's two declarations with an
  `$inferInput` → `Schema.Type` assignability check so drift is a typecheck failure.
- **Query depth/cost limiting is deliberately deferred.** The schema currently has no
  object-to-object edges, so it cannot be nested into. The first relation field
  (`Habit.user`, a per-habit list, anything resolving by id inside a list) inherits
  both a DataLoader task and a depth-limiting task.

## Database (`@repo/db` + `core/src/db`)

- Neon Postgres via Drizzle. `@repo/db` is product-agnostic: it exports
  `layerConfig(tag, schema)` and `makeOps(tag)`, and the **product** owns the
  `Context.Tag` so two products are never confusable in an Effect environment.
- One handle, three paths: `db` (HTTP, writes), `read` (HTTP, replica-routed),
  `pool` (WebSocket, the only one that supports interactive transactions). The HTTP
  driver's own `.transaction()` silently degrades to a batch — do not expose it.
- Import drizzle through `@repo/db/orm` and `@repo/db/pg`, not directly, so the
  workspace provably shares one copy of the types.
- **The Metro boundary is load-bearing.** `db/schema.ts` pulls in
  `drizzle-orm/pg-core`, so nothing under `src/db/` may be reachable from
  `core/models` or the root barrel's value exports. The arrow is
  `db/schema.ts -> models/`, never back.
- Migrations are committed under `core/drizzle/` and applied by the manually
  dispatched `migrate.yml` workflow. Never run them in CI.

## Messaging (`@repo/sms`)

- Sent.dm adapter behind an `SmsProvider` tag, mirroring `@repo/ai`'s provider
  pattern. `@repo/sms/webhook` is dependency-free on purpose so a route can verify
  a signature without bundling the SDK.
- A message body is a discriminated union — text XOR template — because the
  provider rejects a request carrying both.
- `SentLive` uses `Layer.sync` with an env fallback rather than a strict `Config`
  read: it is merged into `AppLive`, which builds every branch on first use, so a
  missing key must not take down unrelated procedures.
- Delivery webhooks are unordered. Status is advanced only by a rank-guarded upsert
  (`SmsStatusRank`), so a late `sent` can never overwrite a `delivered`.

## AI engine (`@repo/ai`)

- Generic engine + module registry. Products define modules (`defineModule`) in their
  `core` package and register them with `registryLayer([...])`.
- `engine.run(name, input)` dispatches directly; `engine.route({ text })` uses a
  deterministic keyword classifier. Providers are adapters — Anthropic is the default.
- Default model id: `claude-opus-4-8` (`DEFAULT_MODEL`).

## Tooling

- **oxlint** and **oxfmt** via `vp lint` / `vp fmt`, configured in the root
  `vite.config.ts` `lint`/`fmt` blocks (no rc files — Vite+ recommends against them).
  Run `pnpm format:fix` before committing.
- **Vitest** via `vp test`, driven entirely by the root `vite.config.ts`
  `test.projects` globs. Packages define **no** test script and no vitest dependency —
  any workspace package with `*.test.ts` files is picked up automatically, so new
  packages are covered from birth.
- **Task running** is `vp run` (Vite Task). Tasks needing `dependsOn`, env cache keys,
  or output restoration are defined in a deployable's `vite.config.ts` `run.tasks`
  (and removed from `package.json` — a name cannot exist in both). Plain scripts
  (`dev`, `clean`, `db:*`) stay in `package.json`, uncached, with a full environment.
  Inputs are fingerprinted automatically (actual file reads, across workspace
  packages), so there is no `^topo`-style synthetic task and no manual `inputs` globs.
  Cached tasks run with a **filtered environment** — see Environment below.
- TypeScript configs are in `tooling/typescript`. `declaration` is off (packages are
  consumed as source, never emitted).

## Environment

- **One `.env` per deployable**, not one per repo: `apps/<product>/api/.env` and
  `apps/<product>/mobile/.env`. Both are gitignored and generated — edit values in
  Infisical, then `pnpm factory sync <product>`.
- Variable **names are identical across products** (`MONGODB_URI`, never
  `ACME_MONGODB_URI`). Isolation comes from _which file_ an app loads, which is why
  nothing in `packages/*` needs to know a product exists. Don't add product prefixes.
- Each app's `build` task declares its vars in its `vite.config.ts`
  (`run.tasks.build.env`). Cached tasks run with a **filtered environment**: only
  listed vars (fingerprinted into the cache key) plus vp's common set (`CI`,
  `NEXT_*`, `PATH`, …) reach the task. Add a new var to the list or the cache will
  span changes to it — and the build won't see it at all. `.env` files need no
  declaration; they're read from disk and fingerprinted as file inputs.
- Env vars are validated with `@t3-oss/env`. Never read `process.env` directly in app
  code — import from `~/env`.
- The root `.env.factory` is different in kind: org-level tokens the **factory**
  authenticates with to create resources. Never copy one into an app's `.env`.

## The project factory (`tooling/factory`)

- `pnpm factory new <product>` scaffolds the code (by calling `pnpm gen product`) and
  then provisions a real project in each third-party service, wiring the credentials
  back into the app. `plan` / `apply` / `verify` / `sync` / `destroy` are the rest.
- One **driver** per service in `src/drivers/`, all implementing the `Driver` contract
  in `src/driver.ts`. Drivers are plain async — the factory is build-time tooling with
  no service graph, so the Effect rule above does not apply to it.
- Rules a new driver must hold to: `apply` is lookup-then-create keyed on
  `resourceName(ctx)` so re-running is a no-op; `plan` never writes; `statePatch`
  carries resource ids only (a secret-shaped value is rejected at write time, since
  `state.json` is committed); every env var the driver can produce is declared in
  `outputs` so the runner can catch two drivers claiming one variable.
- Ordering is derived from `dependsOn`, not declaration order. Disabling a service in
  the manifest prunes its edges, so the graph still resolves.
- Two drivers are **CLI-backed rather than HTTP**, deliberately: `expo` (no stable
  public REST surface) and `clerk` (Platform API is beta, and `clerk env pull` is the
  only way to read an instance's keys). Both auth via an env var passed to the child.
- `clerk` and `anthropic` **degrade instead of failing**: they declare no required
  `credentials`, and emit a `ManualStep` when the optional token is absent. Preserve
  that shape — a driver that is merely unconfigured should not block the graph.
- Anthropic API keys are console-only and stay manual. Stripe provisions into the one
  existing account, tagged by metadata — the driver never creates Stripe accounts.
- `src/drivers/index.test.ts` guards the graph (cycles, output collisions, ordering)
  without needing any credentials. Keep it passing when adding a driver.

## Mobile (Expo + Unistyles)

- Styling is **Unistyles v3**, not NativeWind. Theme is registered once in
  `src/theme/unistyles.ts` (imported at the top of `app/_layout.tsx`).
- Breakpoints are intentionally **not** registered (keeps style types assignable to RN).
- Data layer is **Apollo Client**, mounted by `ApiProvider` in `src/lib/api.tsx`; the
  Clerk session token is attached with a `SetContextLink`. Operations live in
  `src/lib/queries.ts` and are typed by `~/gql`, generated by `pnpm codegen`.
- Import **values** from client-safe subpaths (e.g. `@habitual/core/models`) so Metro
  never bundles server code (drizzle, the Neon driver, the Sent SDK) into the app.
  Nothing in the app imports the `@habitual/core` root barrel any more — the wire
  contract arrives through generated GraphQL types instead of an inferred router type.
- New arch is default (SDK 57). Unistyles needs `react-native-nitro-modules` +
  `react-native-edge-to-edge`.

## Scaffolding

- `pnpm gen product` / `pnpm gen package` — plain Plop (`tooling/generators/plopfile.ts`,
  run by `tooling/generators/cli.ts` under tsx); templates in `tooling/generators/templates`.
  Keep templates in sync with the patterns proven in `apps/habitual`.
- `gen product` produces **files only, no side effects**. `pnpm factory new` wraps it
  and adds the remote resources, so templates stay the single source of truth.
- Mobile routes live in `mobile/src/app/` (matching `~/* -> ./src/*` and the Unistyles
  babel `root: "src"`), not a top-level `app/`.
- Every generated api app takes its dev port from the manifest's `devPort`, allocated
  at creation. Never hardcode 3000 in a template — two products must run at once.
