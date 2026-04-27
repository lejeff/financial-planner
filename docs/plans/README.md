# Plans archive

Historical [Cursor Plan-mode](https://cursor.com/docs) plans from building this project, copied from `~/.cursor/plans/`.
Filenames are prefixed with the date the plan was created.

> For the current roadmap of upcoming work, see [`ROADMAP.md`](../../ROADMAP.md) at the repo root.

**22 plans** across 4 days.

## 2026-04-22

- [Add asset breakdown variables](./2026-04-22-add-asset-breakdown-variables.md) — Extend PlanInputs with five new balance-sheet inputs (Primary residence, Other property, Cash, Non-liquid/PE, Other fixed) plus two appreciation-rate sliders, update the calculator to model them per the chosen rules, and regroup the form into Financial and Real Estate categories.
- [Bar Chart Net Worth](./2026-04-22-bar-chart-net-worth.md) — Fix the missing Tailwind CSS setup so the chart (and all styling) renders correctly, then swap the line chart for a bar chart with hover tooltips showing the net worth for each year.
- [Boldin-style UI Restyle](./2026-04-22-boldin-style-ui-restyle.md) — Restyle the planner into a polished, Boldin-inspired product shell: navy/teal/coral palette, editorial serif headlines paired with Inter, rounded cards with soft shadows, branded top nav + footer, a hero framing above the planner, and a chart and form that match the design system.
- [Currency + Amount Fields](./2026-04-22-currency-+-amount-fields.md) — Replace the four currency sliders (Starting financial assets, Starting total debt, Base monthly spending, Base annual non-rental income) with live-formatted currency input fields (thousand separators + currency symbol), and add an app-wide currency selector in the header that drives every currency display in the app. Default currency is EUR and is persisted in localStorage.
- [Financial Planner MVP + Local Prep Plan](./2026-04-22-financial-planner-mvp-+-local-prep-plan.md) — Set up local development foundation (git, env, editor configs, Prettier) then build the minimal first version of the retirement/financial planner: name + DOB + 5 core inputs with sliders driving a deterministic net-worth-over-time chart, saved to localStorage.
- [Form Copy Cleanup](./2026-04-22-form-copy-cleanup.md) — Small polish pass on the planner form: drop per-field helpers, move the \"in today's money\" context next to the section legend, remove the Name field from this page (keep it in the data model for the future account page), and drop the \"Base\" prefix from two labels.
- [Framed Field Restyle](./2026-04-22-framed-field-restyle.md) — Fix the currency-symbol overlap and upgrade all text inputs (Name, Date of birth, four currency fields) to a Boldin-style framed input with a floating notched label. Currency symbol sits as a left-side flex child so it never overlaps the value. Helpers remain as small muted text below each field.
- [Horizon Variable And Tests](./2026-04-22-horizon-variable-and-tests.md) — Add a user-controlled projection horizon (10-80 years) with a slider, replacing the hardcoded age-95 endpoint, and expand the unit tests to cover multi-year recurrence, the new horizon variable, and key edge cases.
- [Planner inputs v2](./2026-04-22-planner-inputs-v2.md) — Restructure the planner form into three top-level categories (Assets and Debt, Income & Expenses, Real Estate) with single-column layout and nested subsections under Assets, plus add Rental Income (grows at its own rate) and a one-off Windfall (amount + calendar year, deposited into the investment portfolio).
- [SaaS Browser App Setup](./2026-04-22-saas-browser-app-setup.md) — Define a production-ready, fastest-to-market commercial stack and GitHub architecture for a SaaS browser app. Establish repo structure, deployment pipeline, security baseline, and an execution order from MVP to scale.
- [Summary Card Cleanup](./2026-04-22-summary-card-cleanup.md) — Replace the 'Projection horizon: N yrs' summary card with a clearer card that shows the end age and end year of the projection. Slider and input form are untouched.

## 2026-04-23

- [Inflation and real view](./2026-04-23-inflation-and-real-view.md) — Add an inflation-rate input and a Today's money / Future money toggle on the chart. The calculator keeps running in nominal terms (so salary, spending, and windfalls inflate each year); a display transform renders the projection in real (today's-money) or nominal (future-money) terms with Today's money as the default view.
- [life-events-and-legend-cleanup](./2026-04-23-life-events-and-legend-cleanup.md) — Move Windfall fields into a new "Life Events" category (placed after Real Estate) and remove the "Positive / Negative / Shortfall" legend rows from both charts. Both changes ship together on one new branch.

## 2026-04-24

- [Architecture doc (PDF + HTML)](./2026-04-24-architecture-pdf-doc.md) — Author a comprehensive architecture document (markdown source + generated PDF and standalone HTML) covering the full target system (M0 foundation + planned M1–M3 features), with clear "active today vs. planned" labels so you can use it both as a current operational reference and a roadmap.
- [Asset allocation projection chart](./2026-04-24-asset-allocation-projection-chart.md) — Turn the "Projected net worth" chart into a stacked-bar breakdown (Savings, Other Assets, Real Estate, Debt) with a rich tooltip and legend, matching the reference screenshot. Only the first chart changes; the Liquid position chart stays as is.
- [collapsible-planner-sections](./2026-04-24-collapsible-planner-sections.md) — Make every category and subsection inside \"Your Numbers\" collapsible with a chevron toggle. Progressive-disclosure defaults: only the first section open at each level; all others closed. Pure UI/UX change, no changes to inputs, calculator, or storage.
- [Coral savings when negative](./2026-04-24-coral-savings-when-negative.md) — When Savings goes negative, recolor that segment (and its tooltip row marker) with a slightly darker coral, distinct from the existing Debt coral, while leaving the legend swatch as the default green.
- [mid-term core features](./2026-04-24-mid-term-core-features.md) — A five-milestone roadmap that ships the current retirement planner to production on the commercial stack already half-wired (Supabase + Vercel), then layers account persistence, multi-scenario CRUD, Monte Carlo, and an AI chatbot on top — in that order, with a shared core package introduced early to prevent tech debt.
- [Net worth negative warning](./2026-04-24-net-worth-negative-warning.md) — Add a coral alert under the Projected net worth chart — mirroring the existing Liquidity warning — that fires when the projection first dips below zero, showing the year, age, and shortfall amount.
- [Pin debt just below zero](./2026-04-24-pin-debt-just-below-zero.md) — Reorder the stacked bars in the Projected net worth chart so Debt always sits directly beneath the zero line, with any negative asset values stacking below Debt (further from zero). Also retune the green palette so Savings is the darker shade and Real Estate is the lighter shade.
- [Reorder bar stacks](./2026-04-24-reorder-bar-stacks.md) — Change the stack order in the Projected net worth chart so positive bars go Savings → Real Estate → Other Assets (bottom to top) and negative bars go Debt → Savings → Real Estate → Other Assets (from zero outward).

## 2026-04-25

- [Real Estate Investment life event](./2026-04-25-real-estate-investment-event.md) — Add a new "Real Estate Investment" life event modelling a future property purchase (deducted from liquid assets at purchase year) with its own appreciation rate and rental income stream. Introduces a list-based `events: LifeEvent[]` discriminated union on `PlanInputs` so future variants drop in without further schema churn, and brings the architecture doc back in sync with the schema.
