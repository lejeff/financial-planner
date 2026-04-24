---
name: Add asset breakdown variables
overview: Extend PlanInputs with five new balance-sheet inputs (Primary residence, Other property, Cash, Non-liquid/PE, Other fixed) plus two appreciation-rate sliders, update the calculator to model them per the chosen rules, and regroup the form into Financial and Real Estate categories.
todos:
  - id: types
    content: Extend PlanInputs and DEFAULT_PLAN_INPUTS with 5 balance-sheet fields and 2 appreciation rates
    status: completed
  - id: calculator
    content: "Rewrite projectNetWorth per-year step: appreciate properties, draw cash before assets, sum all buckets into netWorth; export MIN/MAX_APPRECIATION"
    status: completed
  - id: tests
    content: Add calculator tests for residence/other-property appreciation, cash-before-assets drawdown, frozen buckets, and year-0 net worth composition
    status: completed
  - id: form
    content: Regroup the form into Financial and Real Estate subsections, add 2 appreciation sliders, widen key unions
    status: completed
  - id: verify
    content: Run typecheck and vitest, spot-check UI behavior
    status: completed
isProject: false
---

## Modeling rules (confirmed)

- **Primary residence value** — appreciates at its own `primaryResidenceRate` slider; never depleted.
- **Other property value** — appreciates at its own `otherPropertyRate` slider; never depleted.
- **Cash balance** — no return; drawn down *before* financial assets when `monthlySpending*12 > annualIncome`.
- **Non-liquid investments / Private equity** — no return; frozen (counts toward net worth only).
- **Other fixed assets** — no return; frozen (counts toward net worth only).

## Data model — `app/src/features/planner/types.ts`

Extend `PlanInputs` and `DEFAULT_PLAN_INPUTS` with:

```ts
primaryResidenceValue: number;   // default 400_000
otherPropertyValue: number;      // default 0
cashBalance: number;             // default 20_000
nonLiquidInvestments: number;    // default 0
otherFixedAssets: number;        // default 0
primaryResidenceRate: number;    // default 0.03
otherPropertyRate: number;       // default 0.03
```

Existing fields stay unchanged. `loadInputs` in [storage.ts](app/src/features/planner/storage.ts) already spreads defaults over stored partials, so older saved payloads hydrate cleanly.

## Calculator — `app/src/features/planner/calculator.ts`

Rewrite the per-year step in `projectNetWorth`. New recurrence at each year `i > 0`:

```ts
residence   *= (1 + input.primaryResidenceRate);
otherProp   *= (1 + input.otherPropertyRate);
const afterReturn = assets * (1 + input.nominalReturn);
const netFlow = input.annualIncome - input.monthlySpending * 12;

if (netFlow >= 0) {
  assets = afterReturn + netFlow;
} else {
  const shortfall = -netFlow;
  const fromCash = Math.min(cash, shortfall);
  cash   -= fromCash;
  assets  = afterReturn - (shortfall - fromCash); // may go negative, same as today
}

netWorth = residence + otherProp + cash + assets
         + input.nonLiquidInvestments + input.otherFixedAssets
         - input.startDebt;
```

Non-liquid/PE and other fixed assets are read directly from `input` each year (flat). Debt behavior is unchanged. Add new constants next to `MIN_HORIZON_YEARS`:

```ts
export const MIN_APPRECIATION = -0.05;
export const MAX_APPRECIATION = 0.10;
```

Expose them to the form for slider bounds.

## Unit tests — `app/src/features/planner/calculator.test.ts`

Add cases (update `BASE_INPUTS` with the new fields defaulted to 0 where appropriate to keep existing assertions valid):

- Year 0 net worth equals the sum of every bucket minus debt.
- Primary residence compounds at `primaryResidenceRate` and ignores spending shortfalls.
- Other property compounds at its own rate independently of residence.
- Cash depletes before financial assets during a pure-shortfall scenario (no income, spending > 0, return 0).
- Once cash hits 0, further shortfall hits financial assets (matches today's behavior).
- Non-liquid and other-fixed stay flat across all years.

## Form — `app/src/features/planner/PlannerForm.tsx`

Replace the single "Your numbers" fieldset with two category fieldsets under a shared "Your numbers · in today's money" header. Structure:

```
About you
  Date of birth

Your numbers · in today's money
  Financial
    [currency] Starting financial assets
    [currency] Cash balance
    [currency] Non-liquid investments / Private equity
    [currency] Other fixed assets
    [currency] Starting total debt
    [currency] Monthly spending
    [currency] Annual non-rental income
    [slider]   Nominal return on financial assets

  Real Estate
    [currency] Primary residence value
    [currency] Other property value
    [slider]   Primary residence appreciation
    [slider]   Other property appreciation

  [slider] Projection horizon   (kept outside the two categories — it governs both)
```

Implementation approach:

- Replace the single `AMOUNTS` array with two tagged arrays, `FINANCIAL_AMOUNTS` and `REAL_ESTATE_AMOUNTS`, each typed `AmountSpec[]`.
- Replace the single `SLIDERS` array with `FINANCIAL_SLIDERS`, `REAL_ESTATE_SLIDERS`, and keep `horizonYears` rendered separately at the bottom.
- Render each category as a nested `<fieldset>` with an `.eyebrow`-styled legend ("Financial", "Real Estate"). Use the outer fieldset's legend for "Your numbers · in today's money" (unchanged from today).
- 2-column `CurrencyField` grid inside each category; sliders stacked below in the same category, using the existing `SliderRow` component unchanged.
- Widen `SliderKey` to `"nominalReturn" | "horizonYears" | "primaryResidenceRate" | "otherPropertyRate"` and `AmountSpec['key']` to include the 5 new keys.
- Reasonable `max` caps: residence / other property / non-liquid / other fixed = `100_000_000`; cash = `50_000_000`.
- Appreciation sliders use `MIN_APPRECIATION`/`MAX_APPRECIATION` bounds and the existing `percent` formatter.

## No other touch points needed

- [ProjectionChart.tsx](app/src/features/planner/ProjectionChart.tsx) consumes `ProjectionPoint.netWorth` only — no change.
- [PlannerPage.tsx](app/src/features/planner/PlannerPage.tsx) consumes `finalPoint.netWorth` / `age` / `year` — no change.
- `storage.ts` tests still pass because the default-spread behavior already handles added keys.

## Verification

1. `cd app && npm run typecheck`
2. `cd app && npm test` — expect existing 28 to pass plus ~6 new ones.
3. Manually verify in the UI: toggling residence rate changes long-term net worth without touching early-year draw, and setting income to 0 / spending > 0 with nonzero cash drains cash before assets.