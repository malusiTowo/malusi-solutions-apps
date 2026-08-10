# Malusi Solutions — Apps Monorepo

A pnpm + Turborepo **project factory** for Malusi Solutions products (mobile, web,
and future platforms). It is built around reusable **logic bricks**, and
`pnpm factory new <name>` produces not just the code but a real project in every
third-party service the product needs — database, auth, payments, email, analytics,
errors, hosting, DNS — with the credentials already wired in.

The first product is **Habitual** — a dark, gamified, AI-powered habit tracker.

## Stack

| Concern              | Choice                                                       |
| -------------------- | ------------------------------------------------------------ |
| Monorepo             | pnpm workspaces + Turborepo                                  |
| Language             | TypeScript (strict)                                          |
| Business logic       | Effect TS                                                    |
| Data                 | Neon Postgres + Drizzle ORM (wrapped in Effect)              |
| API                  | GraphQL (Pothos + Yoga), served from each product's Next app |
| Auth                 | Clerk                                                        |
| Payments             | Stripe                                                       |
| Email                | Resend + react-email                                         |
| Analytics            | PostHog (web + native)                                       |
| AI                   | Provider-agnostic engine (`@repo/ai`) — Anthropic by default |
| Messaging            | Sent.dm via `@repo/sms` — SMS · WhatsApp · RCS               |
| Mobile               | Expo + expo-router + Unistyles                               |
| Web                  | Next.js 16 + Tailwind v4 + shadcn/ui                         |
| Errors               | Sentry                                                       |
| Secrets              | Infisical (source of truth) → per-app `.env`                 |
| Infra / hosting      | Vercel · Neon · Cloudflare DNS · EAS                         |
| Provisioning         | `tooling/factory` — a driver per service, plain TS           |
| Env                  | `@t3-oss/env` (validated), one `.env` per deployable         |
| Lint / Format / Test | oxlint · oxfmt · Vitest                                      |

## Layout

```
apps/
  habitual/
    core/     @habitual/core — all product logic (models, GraphQL schema, AI modules)
    api/      @habitual/api  — Next.js: hosts /api/graphql + Stripe webhooks + landing page
    mobile/   @habitual/mobile — Expo app
packages/     generic logic bricks — no product-specific code
  api  auth  db  design  ui  ai  analytics  email  payments  notifications  sms
tooling/
  typescript/  shared tsconfigs
  github/      CI
  factory/     the project factory — provisioning drivers + `pnpm factory` CLI
turbo/generators/  file scaffolding (pnpm gen)
```

Per product, the factory also writes:

```
apps/<product>/
  product.manifest.ts        which services this product wants (committed)
  .factory/state.json        remote resource ids — no secrets (committed)
  .factory/manual-steps.md   the punch-list for providers with no create API
  api/.env  mobile/.env      credentials (gitignored, generated)
  api/turbo.json  mobile/turbo.json   that app's env vars, for correct caching
```

**Boundary rule:** `packages/*` are generic and never import from `apps/*`. Anything
product-specific ("habit", "streak", "coach") lives in that product's `core` package.

## Getting started

```bash
pnpm install
cp .env.factory.example .env.factory   # org tokens the factory provisions WITH

# run the Habitual API (Next.js) — http://localhost:3000
pnpm --filter @habitual/api dev

# run the Habitual mobile app (Expo)
pnpm --filter @habitual/mobile dev
```

Each deployable reads its own `.env` (`apps/<product>/api/.env`,
`apps/<product>/mobile/.env`) — see [Environment](#environment). Both are generated;
`pnpm factory sync <product>` writes them from Infisical.

## Common commands

```bash
pnpm typecheck     # tsc across all workspaces (runs codegen first)
pnpm lint          # oxlint
pnpm format        # oxfmt --check   (pnpm format:fix to write)
pnpm test          # vitest
pnpm codegen       # schema.graphql from Pothos, then typed documents for mobile
pnpm build         # turbo build (Next build + Expo export)
```

Both codegen artifacts — `apps/<product>/core/schema.graphql` and
`apps/<product>/mobile/src/gql/` — are **committed**, so a fresh clone can run
`pnpm dev` without generating anything first. CI fails if they drift from the schema.

After `pnpm gen product`, run `pnpm codegen` (the new app has no generated types yet)
and `pnpm format:fix` (oxfmt sorts `package.json` dependencies, and where the
product's own `@<name>/core` sorts depends on its name, so no template can be
pre-sorted correctly for every product).

## New product in 10 minutes

This repo is a **project factory**: it creates the code _and_ a real project in each
third-party service, then wires the credentials back into the app.

```bash
pnpm factory new acme      # scaffold apps/acme, then provision everything
```

That one command:

1. scaffolds `apps/acme/{core,api,mobile}` (via `pnpm gen product`) on a free dev port,
2. writes `apps/acme/product.manifest.ts` declaring which services the product wants,
3. creates a GitHub repo, an Infisical project, a Neon Postgres project, a Vercel
   project linked to the repo, Sentry projects for web and mobile, a PostHog project,
   a Resend domain + key, Cloudflare DNS, an EAS project, a Clerk application, Stripe
   Products/Prices/webhook, and (opt-in) a Sent.dm delivery webhook,
4. stores every credential in Infisical and fans it out to `api/.env`, `mobile/.env`,
   Vercel project env, GitHub Actions secrets and EAS env vars,
5. prints a short checklist for anything no provider exposes an API for.

```bash
pnpm factory plan acme       # what would change; touches nothing
pnpm factory apply acme      # provision (idempotent — safe to re-run)
pnpm factory verify acme     # health-check every credential for real
pnpm factory sync acme       # pull Infisical -> the two .env files
pnpm factory destroy acme --yes
```

Add `--env=preview` or `--env=prod` to target another environment; `dev` is the default.

### What is and isn't automated

| Automated                                                                                                                                        | Manual (no create API)                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| GitHub, Infisical, Neon, Vercel, Sentry, PostHog, Resend, Cloudflare, Expo/EAS, Clerk application, Stripe Product/Price/webhook, Sent.dm webhook | Anthropic API key (console only) · Sent.dm API key (dashboard only) |

Manual steps never block `apply` — the rest of the graph provisions regardless, the
steps land in `apps/<product>/.factory/manual-steps.md` with deep links, and re-running
`apply` picks up whatever you pasted into Infisical.

**Clerk** needs `CLERK_PLATFORM_API_KEY` (Platform API, beta) and the `clerk` CLI on
`PATH`. With it, the factory creates one Clerk application per product and pulls that
instance's keys. Without it, Clerk degrades to a manual step rather than failing.
`dev` and `preview` share the application's development instance; `prod` uses its
production instance, and picks up `domain` from the manifest if set.

**Stripe** provisions into your existing account — it never creates accounts. Each
product's Product / Price / webhook endpoint is tagged
`malusi_factory_product: <product>-<env>`, so objects stay attributable in one
dashboard. Sandboxes would give real key isolation but are capped at five and are
test-mode only; a separate account per product is dashboard-only and is Stripe's
one-per-legal-entity model.

### Prerequisites

Fill in `.env.factory` (see `.env.factory.example`). A driver whose token is missing is
skipped with a clear message and blocks only its dependents, so you can start with two
or three services and add the rest later. The `gh`, `eas`, `infisical` and `clerk`
CLIs must be on `PATH`.

Prefer just the code, with no remote resources? `pnpm gen product` still works
standalone, and `pnpm gen package` scaffolds a new generic brick under `packages/`.

## Database

Neon Postgres with Drizzle. `@repo/db` is generic — it owns the connection and the
Effect wrapper and names no table; each product declares its own `Database` tag and
schema in `core/src/db/`.

One handle exposes all three access paths, and the choice matters:

| Handle | Endpoint  | Use for                                                        |
| ------ | --------- | -------------------------------------------------------------- |
| `db`   | HTTP      | writes and one-shot reads; one round-trip, no session          |
| `read` | HTTP      | reads; routed to a replica when `DATABASE_REPLICA_URLS` is set |
| `pool` | WebSocket | interactive transactions — the only handle that supports them  |

```ts
// core/src/db/habits.ts
export const listHabits = (userId: string) =>
  query("habit.list", ({ read }) => read.select().from(habits).where(eq(habits.userId, userId)));
```

Migrations live in `apps/<product>/core/drizzle/` and are committed:

```bash
pnpm --filter @habitual/core db:generate   # diff the schema -> a new .sql file
pnpm --filter @habitual/core db:migrate    # apply (uses DATABASE_URL_UNPOOLED)
pnpm --filter @habitual/core db:studio     # browse
pnpm --filter @habitual/core db:seed       # demo data, idempotent
```

`db:generate` needs no database. Production migrations run from the manually
dispatched `.github/workflows/migrate.yml`, never from CI or a Vercel build — CI has
no database and `next build` must never need one.

For local work, give each developer their own Neon branch
(`neonctl branches create --name dev-$(whoami)`) rather than sharing one: the HTTP
driver only speaks to a Neon endpoint, so there is no plain local Postgres fallback.

## Messaging

`@repo/sms` wraps [Sent.dm](https://docs.sent.dm) — one API for SMS, WhatsApp and RCS
with routing and fallback handled upstream. It is opt-in per product (`sent` in the
manifest, `@repo/sms` in the product's dependencies, `SentLive` in `AppLive`).

A body is either free-form text or a template, never both, and the type makes the
invalid combination unrepresentable:

```ts
yield * provider.send({ to: ["+27831234567"], body: text("Your code is 4291"), idempotencyKey });
```

Delivery status arrives by webhook at `/api/webhooks/sent`. `@repo/sms/webhook` verifies
the HMAC signature and decodes the event; the product upserts it into `sms_messages`
under a rank guard, so redelivered and out-of-order events converge on the right status
rather than overwriting a `delivered` with a late `sent`.

## Environment

There is **no root `.env`**. Each deployable owns its own:

```
apps/<product>/api/.env       server secrets   (gitignored, generated)
apps/<product>/mobile/.env    EXPO_PUBLIC_*    (gitignored, generated)
.env.factory                  org tokens the FACTORY uses to create resources
```

Variable names are deliberately **not** prefixed per product — `DATABASE_URL` means this
app's database. Isolation comes from which file an app loads, which is why nothing in
`packages/*` has to know a product exists.

Infisical is the source of truth (one project per product; `dev`/`preview`/`prod`;
folders `/api` and `/mobile`). Edit values there, then `pnpm factory sync <product>`.
Local keys the factory doesn't own — a LAN IP for `EXPO_PUBLIC_API_URL`, say — survive
a sync.

## Mobile ops (EAS)

`apps/*/mobile/eas.json` defines `development` / `preview` / `production` build profiles
with EAS Update (OTA) channels. The `expo` driver runs `eas init` (which writes
`extra.eas.projectId` into `app.config.ts`) and pushes each environment's
`EXPO_PUBLIC_*` values as EAS environment variables, so a build gets the same config as
local. Store submission credentials are added when you first run `eas submit`, which
prompts for anything missing.
