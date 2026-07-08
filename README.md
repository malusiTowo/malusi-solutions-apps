# Malusi Solutions — Apps Monorepo

A pnpm + Turborepo monorepo for Malusi Solutions products (mobile, web, and future
platforms), built around reusable **logic bricks** so a new product can be scaffolded
in ~10 minutes.

The first product is **Habitual** — a dark, gamified, AI-powered habit tracker.

## Stack

| Concern              | Choice                                                       |
| -------------------- | ------------------------------------------------------------ |
| Monorepo             | pnpm workspaces + Turborepo                                  |
| Language             | TypeScript (strict)                                          |
| Business logic       | Effect TS                                                    |
| Data                 | MongoDB (official driver, wrapped in Effect)                 |
| API                  | tRPC v11, served from each product's Next.js app             |
| Auth                 | Clerk                                                        |
| Payments             | Stripe                                                       |
| Email                | Resend + react-email                                         |
| Analytics            | PostHog (web + native)                                       |
| AI                   | Provider-agnostic engine (`@repo/ai`) — Anthropic by default |
| Mobile               | Expo + expo-router + Unistyles                               |
| Web                  | Next.js 16 + Tailwind v4 + shadcn/ui                         |
| Errors               | Sentry                                                       |
| Env                  | `@t3-oss/env` (validated)                                    |
| Lint / Format / Test | oxlint · oxfmt · Vitest                                      |

## Layout

```
apps/
  habitual/
    core/     @habitual/core — all product logic (models, tRPC routers, AI modules)
    api/      @habitual/api  — Next.js: hosts tRPC + Stripe webhooks + landing page
    mobile/   @habitual/mobile — Expo app
packages/     generic logic bricks — no product-specific code
  api  auth  db  design  ui  ai  analytics  email  payments  notifications
tooling/      shared tsconfigs + CI
turbo/generators/  scaffolding (pnpm gen)
```

**Boundary rule:** `packages/*` are generic and never import from `apps/*`. Anything
product-specific ("habit", "streak", "coach") lives in that product's `core` package.

## Getting started

```bash
pnpm install
cp .env.example .env      # fill in keys (all optional for the skeleton)

# run the Habitual API (Next.js) — http://localhost:3000
pnpm --filter @habitual/api dev

# run the Habitual mobile app (Expo)
pnpm --filter @habitual/mobile dev
```

## Common commands

```bash
pnpm typecheck     # tsc across all workspaces
pnpm lint          # oxlint
pnpm format        # oxfmt --check   (pnpm format:fix to write)
pnpm test          # vitest
pnpm build         # turbo build (Next build + Expo export)
```

## New product in 10 minutes

```bash
pnpm gen product   # prompts for a name, scaffolds apps/<name>/{core,api,mobile}
pnpm install       # link the new workspace
# add <NAME>_* keys to .env, then:
pnpm --filter @<name>/api dev
pnpm --filter @<name>/mobile dev
```

`pnpm gen package` scaffolds a new generic brick under `packages/`.

## Mobile ops (EAS)

`apps/*/mobile/eas.json` defines `development` / `preview` / `production` build profiles
with EAS Update (OTA) channels. Fill in the EAS `projectId` (app.config.ts) and store
credentials (eas.json) before running `eas build` / `eas update` / `eas submit`.
