---
name: Architecture doc (PDF + HTML)
overview: Author a comprehensive architecture document (markdown source + generated PDF and standalone HTML) covering the full target system (M0 foundation + planned M1–M3 features), with clear "active today vs. planned" labels so you can use it both as a current operational reference and a roadmap.
todos:
  - id: scaffold
    content: Add docs/ directory, md-to-pdf devDep, docs:build/docs:build:html scripts, and config file
    status: completed
  - id: write-doc
    content: Author docs/architecture.md (overview, services, data flows with mermaid, data model, shipping workflow, env/config, security, costs)
    status: completed
  - id: generate-pdf
    content: Run npm run docs:build to produce docs/architecture.pdf and docs/architecture.html; verify diagrams render in both
    status: pending
  - id: readme-link
    content: Add pointers to docs/architecture.md (PDF and HTML artifacts) from README.md
    status: completed
isProject: false
---

## Assumptions (flag if wrong)

- **Scope: full target architecture**, not M0-only. Each service will be documented with a badge: `ACTIVE`, `WIRED-DORMANT` (scaffolded, waiting for credentials), or `PLANNED (M1 / M2 / M3)`. M0-only would yield a thin document since most services are intentionally dormant.
- **Deliverable location:** `docs/architecture.md` as single source of truth, `docs/architecture.pdf` and `docs/architecture.html` as rendered artifacts. New `docs/` directory (separates architecture from deploy playbooks in `infra/`).
- **Diagrams:** Mermaid embedded in markdown — rendered to both the PDF and HTML via headless Chromium so they appear inline rather than as code blocks.

## PDF + HTML generation approach

Use [`md-to-pdf`](https://www.npmjs.com/package/md-to-pdf) (Puppeteer-based, renders mermaid natively via a built-in plugin). It supports a `--as-html` flag to emit a self-contained HTML page from the same markdown source and the same CSS, so both artifacts stay visually consistent with zero duplication.

- Add as a **root-level `devDependency`** only (not shipped to production, not added to the `app` workspace).
- Chromium is already on the machine via Playwright, so no extra download.
- New root scripts:
  - `"docs:build:pdf": "md-to-pdf docs/architecture.md --config-file docs/.md-to-pdf.config.cjs"`
  - `"docs:build:html": "md-to-pdf docs/architecture.md --as-html --config-file docs/.md-to-pdf.config.cjs"`
  - `"docs:build": "npm run docs:build:pdf && npm run docs:build:html"` — convenience wrapper that produces both in one go.
- Shared config file enables the mermaid plugin, sets A4 page size + margins for PDF, and applies one CSS stylesheet ([`docs/architecture.css`](docs/architecture.css)) that both artifacts inherit. HTML output is a **single self-contained file** (inline CSS, no external assets) so it can be opened directly or served from any static host.
- Commit `architecture.md` (source of truth) **plus** both `architecture.pdf` and `architecture.html` so readers without Node can open either directly. The workflow is: edit markdown, run `npm run docs:build`, commit all three.

## Document outline (what goes in `docs/architecture.md`)

1. **One-page overview**
   - Elevator pitch, a status badge legend, and a top-level C4-style context diagram (users, browser, Vercel edge, Vercel serverless, Supabase, Stripe, Resend, Sentry, PostHog, OpenAI).

2. **Services and responsibilities** — table + per-service deep-dives. For each row: purpose, data captured, region, pricing tier, when it activates. Services covered:
   - **Vercel** (edge + `fra1` serverless) — Next.js hosting, static/edge cache, regional function execution. Cite [`vercel.json`](vercel.json).
   - **Next.js app** (App Router) — UI, server actions, API routes. Cite [`app/src/app/`](app/src/app/) structure.
   - **`@app/core` package** — pure domain logic (schema + projections), shared between server and client. Cite [`packages/core/src/index.ts`](packages/core/src/index.ts).
   - **Supabase** (EU/Frankfurt) — Auth (M1), Postgres + RLS (M1 scenarios, M2 Monte Carlo cache), Storage (not used yet).
   - **Stripe** — checkout + webhook for subscriptions (M3). Cite [`app/src/app/api/billing/checkout/route.ts`](app/src/app/api/billing/checkout/route.ts) and [`app/src/app/api/webhooks/stripe/route.ts`](app/src/app/api/webhooks/stripe/route.ts).
   - **Resend** — transactional email (welcome, password reset, billing receipts). Wired-dormant.
   - **Sentry** (EU region) — error + performance telemetry. Wired-dormant; explain `/monitoring` tunnel and `instrumentation.ts` hooks.
   - **PostHog** (EU cloud) — product analytics, session replay (off by default). Wired-dormant; explain memory-persistence choice for GDPR, `/ingest` rewrite.
   - **OpenAI / LLM provider** — PLANNED (M3 chatbot); document only the contract and data-minimization rules.
   - **GitHub + GitHub Actions** — source of truth, CI gate, preview deploys via Vercel integration.

3. **Data flows** (mermaid sequence diagrams)
   - Cold page load (browser → Vercel edge → SSR → rendered HTML)
   - Auth sign-in (browser → Supabase Auth → cookie → RLS-scoped reads) — PLANNED M1
   - Save scenario (client → server action → Supabase RLS insert) — PLANNED M1
   - Run Monte Carlo (client → Vercel fra1 function → worker compute → cached result in Postgres) — PLANNED M2
   - Stripe checkout + webhook — PLANNED M3
   - Error reporting (client exception → `/monitoring` tunnel → Sentry EU)
   - Analytics event (client → `/ingest` rewrite → PostHog EU)

4. **Data model**
   - **Today**: Zod `PlanInputsSchema` from [`packages/core/src/planInputs.ts`](packages/core/src/planInputs.ts) with a compact field table.
   - **M1 target**: ER diagram for `profiles`, `scenarios`, `scenario_versions` tables + RLS policy summary. Cite planned migration path in [`supabase/migrations/`](supabase/migrations/).
   - **M2 target**: `simulation_runs` table for Monte Carlo caching.
   - **M3 target**: `subscriptions`, `chat_threads`, `chat_messages`.

5. **Feature shipping workflow** (the "new feature" walkthrough you asked for)
   - Step-by-step from `git switch -c feat/...` through local dev, unit tests, commit, push, PR, CI checks (lint / typecheck / unit / e2e), Vercel preview deploy, review, squash-merge to `main`, auto-deploy to `planner.boombaleia.com`, Sentry release association, post-deploy verification.
   - Include a mermaid flowchart visualising the same workflow.
   - Cite [`.github/workflows/ci.yml`](.github/workflows/ci.yml) and [`app/playwright.config.ts`](app/playwright.config.ts).

6. **Environments and configuration**
   - Public vs server env split: [`app/src/lib/env.ts`](app/src/lib/env.ts) vs [`app/src/lib/env.server.ts`](app/src/lib/env.server.ts).
   - Strict-mode trigger (`VERCEL=1 || CI=true`) and why.
   - How secrets flow: Vercel project settings → build env → serverless runtime; no secrets in the repo.

7. **Security, privacy, data residency**
   - Why every hop is EU (Vercel `fra1`, Supabase Frankfurt, Sentry EU, PostHog EU cloud).
   - Row-Level Security as the primary tenant-isolation mechanism.
   - PII inventory (email in Supabase Auth; no PII in PostHog due to memory persistence; scrubbing rules for Sentry).
   - HTTP hardening headers already in prod (verified): HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.

8. **Cost model** — one-table summary of free-tier limits vs expected first-paid-tier price per service.

9. **Glossary and further reading** — links back to [`README.md`](README.md), [`infra/m0-deploy-checklist.md`](infra/m0-deploy-checklist.md), [`infra/vercel-deploy.md`](infra/vercel-deploy.md), [`infra/supabase-setup.md`](infra/supabase-setup.md).

## Files to be added / changed

- **New:** [`docs/architecture.md`](docs/architecture.md) — the source of truth (est. 600–900 lines with diagrams).
- **New:** [`docs/architecture.pdf`](docs/architecture.pdf) — generated PDF, committed for easy viewing.
- **New:** [`docs/architecture.html`](docs/architecture.html) — generated self-contained HTML (inline CSS, mermaid rendered inline), committed alongside the PDF.
- **New:** [`docs/architecture.css`](docs/architecture.css) — shared stylesheet used by both PDF and HTML outputs.
- **New:** [`docs/.md-to-pdf.config.cjs`](docs/.md-to-pdf.config.cjs) — enables mermaid plugin, references the CSS, sets A4 layout for PDF.
- **Changed:** root [`package.json`](package.json) — add `md-to-pdf` to `devDependencies` and the three `docs:build*` scripts.
- **Changed:** root [`.gitignore`](.gitignore) — nothing added; both PDF and HTML are intentionally committed.
- **Changed:** [`README.md`](README.md) — add pointers to the markdown source, PDF, and HTML.

## Notes

- No runtime code changes; this is pure documentation + tooling.
- The doc is designed to stay accurate as milestones land: each section has explicit "as of M0" annotations you can flip to "active" as you build.