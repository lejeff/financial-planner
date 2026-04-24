---
name: Planner inputs v2
overview: Restructure the planner form into three top-level categories (Assets and Debt, Income & Expenses, Real Estate) with single-column layout and nested subsections under Assets, plus add Rental Income (grows at its own rate) and a one-off Windfall (amount + calendar year, deposited into the investment portfolio).
todos:
  - id: types
    content: Extend PlanInputs + DEFAULT_PLAN_INPUTS with rentalIncome, rentalIncomeRate, windfallAmount, windfallYear
    status: completed
  - id: calculator
    content: Update projectNetWorth to grow rental income, include it in netFlow, and deposit windfall into the investment portfolio at the matching calendar year
    status: completed
  - id: calculator-tests
    content: Update BASE_INPUTS and add unit tests for rental income growth, windfall year-matching (deposits into portfolio), and net-worth invariants
    status: completed
  - id: form-layout
    content: Restructure PlannerForm into Assets and Debt / Income & Expenses / Real Estate with single-column layout and Liquid/Non-Liquid/Debt subheadings
    status: pending
  - id: form-new-fields
    content: Add Rental Income (+ rate slider) and Windfall amount/year inputs; move nominalReturn slider under Liquid
    status: pending
  - id: form-tests
    content: Update PlannerForm and PlannerPage tests for the new categories, subheadings, and new fields
    status: completed
  - id: ship
    content: Branch, run local checks, open PR, merge after CI green
    status: in_progress
isProject: false
---

# Planner inputs v2

## Scope

- Form layout: one variable per line (drop the 2-column grids on currency fields).
- Rename the single "Financial" category into three top-level categories under `Your numbers`.
- Add two new inputs: **Rental Income** (annual, grows at its own rate) and **Windfall** (one-off amount in a specific calendar year, deposited into the investment portfolio).

## New category structure

1. **Assets and Debt** (bordered fieldset with three nested subheadings)
   - *Liquid*
     - Financial Assets / Portfolio (was `Starting financial assets`, key `startAssets`)
     - Expected annual return (slider `nominalReturn`, moved here — it only compounds the portfolio)
     - Cash Balance (`cashBalance`)
   - *Non-Liquid*
     - Private Equity (was `Non-liquid investments, Private Equity`, key `nonLiquidInvestments`)
     - Other Fixed Assets (`otherFixedAssets`)
   - *Debt*
     - Debt (was `Starting total debt`, key `startDebt`)

2. **Income & Expenses** (bordered fieldset)
   - Salary (was `Annual non-rental income`, key `annualIncome`)
   - Rental Income (new, `rentalIncome`)
   - Rental income annual appreciation rate (new slider, `rentalIncomeRate`)
   - Windfall amount (new, `windfallAmount`) — deposited into the investment portfolio
   - Windfall year (new, `windfallYear`, 4-digit calendar year)
   - Recurring monthly expenses (was `Base monthly spending`, key `monthlySpending`)

3. **Real Estate** (bordered fieldset, unchanged inputs)
   - Primary Residence value + Annual Appreciation rate
   - Other Property Value + Annual Appreciation rate

`Projection horizon` slider stays outside the three categories, as today.

Keeping the existing data-model keys avoids breaking `localStorage` for anyone who has already typed values in (only the visible labels change).

## Calculator changes

`[app/src/features/planner/calculator.ts](app/src/features/planner/calculator.ts)` — update the per-year loop:

```ts
rentalIncome *= 1 + input.rentalIncomeRate;

const netFlow = input.annualIncome + rentalIncome - input.monthlySpending * 12;

// existing afterReturn + netFlow / cash-drain logic runs here, updating `assets` and `cash`

// one-off windfall lands in the investment portfolio in the matching calendar year
const currentYear = now.getFullYear() + i;
if (currentYear === input.windfallYear && input.windfallAmount > 0) {
  assets += input.windfallAmount;
}
```

Rental income is a flow, not a stock, so it does NOT appear in the net-worth sum. The windfall is added to `assets` (the investment portfolio) after that year's return compounding and netFlow drain, meaning the windfall arrives at year-end and starts compounding from the next year onward. If the `windfallYear` falls outside the projection horizon (past year 0 or beyond `horizonYears`), the deposit is simply never triggered. Appreciation caps reuse the existing `MIN_APPRECIATION` / `MAX_APPRECIATION` constants.

## Types + defaults

`[app/src/features/planner/types.ts](app/src/features/planner/types.ts)` — extend `PlanInputs` and `DEFAULT_PLAN_INPUTS`:

```ts
rentalIncome: number;       // default 0
rentalIncomeRate: number;   // default 0.02
windfallAmount: number;     // default 0
windfallYear: number;       // default new Date().getFullYear() + 10 (evaluated at module load)
```

## Form restructure

`[app/src/features/planner/PlannerForm.tsx](app/src/features/planner/PlannerForm.tsx)`:

- Replace the `FINANCIAL_AMOUNTS` / `REAL_ESTATE_AMOUNTS` constants with three arrays: `ASSETS_LIQUID`, `ASSETS_NON_LIQUID`, `ASSETS_DEBT`, `INCOME_EXPENSE_AMOUNTS`, `REAL_ESTATE_AMOUNTS`.
- Drop the `grid grid-cols-1 gap-4 sm:grid-cols-2` wrappers — render each `CurrencyField` on its own full-width row (`space-y-4`).
- Inside the Assets fieldset, use three `<div>` blocks each headed by a smaller eyebrow label ("Liquid" / "Non-Liquid" / "Debt") and containing its fields/sliders.
- Put `nominalReturn` slider inline inside the Liquid block (right under Financial Assets / Portfolio). Move `rentalIncomeRate` slider inline inside Income & Expenses (right under Rental Income).
- Add a new compact integer input for `windfallYear` (reuse `FramedField` with a numeric `<input type="number" min={1900} max={2200}>`) so the windfall reads as "Windfall amount" on one line then "Windfall year" on the next.

## Tests to update

- `[app/src/features/planner/calculator.test.ts](app/src/features/planner/calculator.test.ts)`
  - Extend `BASE_INPUTS` with the four new fields (all zero / neutral).
  - Add cases: rental income grows at its own rate and boosts inflows; rental-rate = 0 keeps income flat; windfall lands in the investment portfolio on the matching calendar year only (cash unchanged); windfall year outside the horizon is a no-op; windfall amount of 0 is a no-op; rental income is not double-counted in net worth.
- `[app/src/features/planner/PlannerForm.test.tsx](app/src/features/planner/PlannerForm.test.tsx)`
  - Replace `Financial` / `Real Estate` layout assertions with `Assets and Debt` / `Income & Expenses` / `Real Estate`.
  - Assert Liquid/Non-Liquid/Debt subheadings and that `nominalReturn` sits inside the Liquid block.
  - Assert Rental Income field + its rate slider render together.
  - Assert Windfall amount + Windfall year fields render and update.
- `[app/src/features/planner/PlannerPage.test.tsx](app/src/features/planner/PlannerPage.test.tsx)`
  - Update the "both fieldsets" assertion to three fieldsets.

## Workflow

1. Branch from `main`: `feat/planner-inputs-v2`.
2. Implement model changes → calculator → form → tests.
3. Run `npm run lint && npm run typecheck && npm run test` locally.
4. Push branch, open PR (`gh pr create --fill`), wait for green CI, `gh pr merge --squash --delete-branch`.

## Out of scope (flag for later)

- Multiple windfalls / event list (user chose single one-off for now).
- Taxation of any income stream.
- Stacked-bar breakdown of net worth by bucket on the chart.