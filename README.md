# Financial Planner

A browser-based financial planning app: interactive long-horizon net-worth projections, multi-scenario accounts, Monte Carlo probability of success, and an AI assistant that helps you reason about your plan.

Production deploy: **https://planner.boombaleia.com**

Architecture documentation: see [`docs/architecture.md`](docs/architecture.md) (source), [`docs/architecture.pdf`](docs/architecture.pdf) (print-ready), and [`docs/architecture.html`](docs/architecture.html) (standalone, self-contained HTML with inline diagrams).

## Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind v4
- **Recharts** for all interactive visualizations
- **Supabase** (EU / Frankfurt) — Postgres + Auth + RLS
- **Stripe** — subscription billing (M3+)
- **Sentry** (EU region) — error and performance monitoring
- **PostHog** (EU cloud) — product analytics + session replay
- **Vercel** (functions pinned to `fra1`) — hosting and preview deploys
- **GitHub Actions** — CI (lint, typecheck, unit, e2e)

## Repository layout

```
financial-planner/
├─ app/                    # Next.js app (Client + Server Components, route handlers)
│  ├─ src/
│  │  ├─ app/              # App Router pages & API routes
│  │  ├─ features/         # Feature-scoped UI (planner, currency, auth, ...)
│  │  ├─ components/       # Shared UI primitives
│  │  ├─ lib/
│  │  │  ├─ env.ts         # Public env (NEXT_PUBLIC_*) — safe on client
│  │  │  └─ env.server.ts  # Server secrets — guarded by `server-only`
│  │  └─ server/           # Server-only logic (billing, security, audit)
├─ packages/
│  └─ core/                # @app/core — pure domain logic (schemas + projection)
├─ tests/
│  └─ e2e/                 # Playwright end-to-end tests
└─ .github/workflows/      # CI pipelines
```

The domain model and financial math live in `@app/core` (no React, no env, no I/O) so they are trivially unit-testable and reusable across the client app, future Supabase Edge Functions, and the AI chatbot's tool layer.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in values as you create services
npm run dev                  # http://127.0.0.1:3000
```

Without a populated `.env.local` the app still boots — dev uses safe placeholder defaults. Production builds (on Vercel or CI) are strict: missing required envs fail the build with a clear list of what's missing.

### Scripts

| Command            | What it runs                               |
| ------------------ | ------------------------------------------ |
| `npm run dev`      | Next.js dev server                         |
| `npm run build`    | Production build (local uses defaults)     |
| `npm run typecheck`| `tsc --noEmit` across app + packages       |
| `npm test`         | Vitest (app + `@app/core`)                 |
| `npm run test:e2e` | Playwright e2e against a real dev build    |
| `npm run format`   | Prettier write                             |

## Deploy playbook (one-time setup)

1. **Vercel** — connect the GitHub repo, select the `app/` root; `vercel.json` pins serverless functions to `fra1` (Frankfurt).
2. **Supabase** — create a project in `eu-central-1`. Copy `URL`, `anon key`, `service role key` into Vercel env vars.
3. **Sentry** — create a Next.js project in the EU region. Copy `DSN` into Vercel.
4. **PostHog** — create a project in EU Cloud. Copy the project API key into Vercel as `NEXT_PUBLIC_POSTHOG_KEY`.
5. **Gandi DNS** — add a `CNAME` record: `planner` → `cname.vercel-dns.com.` (Vercel issues SSL automatically).
6. In Vercel → **Settings → Domains**, add `planner.boombaleia.com`.

Required environment variables are enumerated in `.env.example`. On Vercel / CI, the app will refuse to start with placeholder values.

## Branch and CI strategy

- Trunk-based development on `main`; short-lived feature branches; PRs only.
- `main` protected: require PR, status checks, 1 approval, linear history.
- CI runs lint, typecheck, unit tests, and e2e on every PR.
- Vercel auto-deploys preview for each PR and production on merge to `main`.
