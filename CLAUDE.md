# CLAUDE.md — conventions for this monorepo

## Architecture

- **pnpm workspaces + Turborepo.** Workspaces: `apps/*/*`, `packages/*`, `tooling/*`.
- **Products** live at `apps/<product>/` and contain multiple deployables plus a domain
  package: `core/` (logic), `api/` (Next.js), `mobile/` (Expo).
- **Packages** (`packages/*`) are generic **logic bricks**. Hard rule:
  - `packages/*` may depend on other `packages/*` and **never** on `apps/*`.
  - No product-specific naming or logic in `packages/*`. If it says "habit", it belongs
    in `apps/habitual/core`.
- Packages ship **raw TypeScript** via their `exports` map (no build step). Apps transpile
  them (`transpilePackages` in Next; Metro watches the workspace).

## Where things go

- **Domain models, tRPC routers, AI modules, analytics event maps** → the product's
  `core` package (e.g. `@habitual/core`).
- **The tRPC transport, procedure builders, Effect runtime bridge** → `@repo/api`
  (generic, no routers).
- **Mongo client + repository helpers** → `@repo/db` (generic, no models).
- **Design tokens** → `@repo/design`; they feed the Unistyles theme (native) and the
  Tailwind preset (web). Do not hardcode colors in apps.

## Effect

- Business logic is written as Effect programs. Services are `Context.Tag`s provided by
  `Layer`s; apps build a `ManagedRuntime` from their layers (see `core/src/api/trpc.ts`).
- tRPC procedures call `runEffect(ctx, program)` from `@repo/api`, which provides
  `CurrentUser` from the request auth and maps failures to `TRPCError`.
- The Mongo layer connects **lazily** (driver auto-connects on first op), so DB-free
  procedures like `health` never open a socket.

## AI engine (`@repo/ai`)

- Generic engine + module registry. Products define modules (`defineModule`) in their
  `core` package and register them with `registryLayer([...])`.
- `engine.run(name, input)` dispatches directly; `engine.route({ text })` uses a
  deterministic keyword classifier. Providers are adapters — Anthropic is the default.
- Default model id: `claude-opus-4-8` (`DEFAULT_MODEL`).

## Tooling

- **oxlint** (`.oxlintrc.json`) and **oxfmt** (`.oxfmtrc.json`). Run `pnpm format:fix`
  before committing. If oxfmt is ever too limiting, Prettier is the documented fallback.
- **Vitest** for unit tests (`*.test.ts`). Packages without tests use `--passWithNoTests`.
- TypeScript configs are in `tooling/typescript`. `declaration` is off (packages are
  consumed as source, never emitted).
- Env vars are validated with `@t3-oss/env` and read from a single root `.env`
  (`turbo.json` globalDependencies). Never read `process.env` directly in app code —
  import from `~/env`.

## Mobile (Expo + Unistyles)

- Styling is **Unistyles v3**, not NativeWind. Theme is registered once in
  `src/theme/unistyles.ts` (imported at the top of `app/_layout.tsx`).
- Breakpoints are intentionally **not** registered (keeps style types assignable to RN).
- Import product **types** from the core barrel (`import type { AppRouter }`), but import
  **values** from client-safe subpaths (e.g. `@habitual/core/models`) so Metro never
  bundles server code (mongodb) into the app.
- New arch is default (SDK 57). Unistyles needs `react-native-nitro-modules` +
  `react-native-edge-to-edge`.

## Scaffolding

- `pnpm gen product` / `pnpm gen package` — templates in `turbo/generators/templates`.
  Keep templates in sync with the patterns proven in `apps/habitual`.
