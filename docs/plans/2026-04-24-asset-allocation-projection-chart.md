---
name: Asset allocation projection chart
overview: Turn the "Projected net worth" chart into a stacked-bar breakdown (Savings, Other Assets, Real Estate, Debt) with a rich tooltip and legend, matching the reference screenshot. Only the first chart changes; the Liquid position chart stays as is.
todos:
  - id: types
    content: Add savings/otherAssets/realEstate/debt to ProjectionPoint
    status: completed
  - id: calculator
    content: Populate buckets in projectNetWorth and deflate them in deflateToToday
    status: completed
  - id: chart
    content: Rewrite ProjectionChart as stacked bars with custom tooltip and legend
    status: completed
  - id: tests
    content: Add bucket assertions and update mk() helpers in calculator.test.ts
    status: completed
isProject: false
---

## Data model

Extend `ProjectionPoint` in [app/src/features/planner/types.ts](app/src/features/planner/types.ts) with per-year bucket values so the chart can stack them. Keep `netWorth` and `liquid` so `PlannerPage` and the existing Liquid chart keep working unchanged.

```ts
export type ProjectionPoint = {
  year: number;
  age: number;
  netWorth: number;
  liquid: number;
  savings: number;      // cash + financial portfolio (can be negative in shortfall)
  otherAssets: number;  // nonLiquidInvestments + otherFixedAssets (static)
  realEstate: number;   // residence + otherProp (compounded)
  debt: number;         // startDebt (constant, non-negative)
};
```

## Calculator

In [app/src/features/planner/calculator.ts](app/src/features/planner/calculator.ts):

- Inside the loop in `projectNetWorth`, emit the four buckets on each point. `savings = assets + cash`, `otherAssets = nonLiquid + otherFixed`, `realEstate = residence + otherProp`, `debt = input.startDebt`. `netWorth` stays `realEstate + savings + otherAssets - debt` (identical sum).
- Update `deflateToToday` to divide `savings`, `otherAssets`, `realEstate`, and `debt` by the same inflator as `netWorth`/`liquid`.

## Chart

Rewrite [app/src/features/planner/ProjectionChart.tsx](app/src/features/planner/ProjectionChart.tsx) as a stacked bar chart:

- Four `<Bar stackId="a">` series: `savings`, `otherAssets`, `realEstate`, and a derived `debtNeg = -debt` so debt renders below the zero line (recharts stacks negatives and positives separately, yielding the screenshot's two-sided bars).
- Add `<ReferenceLine y={0}>` and a `<Legend>` pinned to the bottom with the four colored dots.
- Bar colors: Savings `#00a385` (deeper teal), Real Estate `#9fe3dc` (mint), Other Assets `#d9b861` (muted gold, new), Debt `#ff7a59` (coral). Use the radius only on the outermost segment in each direction so the bar looks continuous.
- Replace `ChartTooltip` with a card that renders, in order:
  - Year header (bold) and `Age {age}` sub-label.
  - A row per series with a colored dot, label, and right-aligned formatted value.
  - A divider, then a `Total` row showing `netWorth`, colored coral when negative.
- Hide the `Other Assets` row in the tooltip when it's exactly 0 so simple plans stay clean.

## Page and tests

- [app/src/features/planner/PlannerPage.tsx](app/src/features/planner/PlannerPage.tsx) keeps passing `displayed` to `<ProjectionChart />`; no changes needed.
- Extend [app/src/features/planner/calculator.test.ts](app/src/features/planner/calculator.test.ts) with a new describe block verifying per-bucket values at year 0 and year 1 for a known input, and that `savings + otherAssets + realEstate - debt === netWorth` at every point. Update the two `mk()` helpers in the existing `deflateToToday`/`liquid` describes so they populate the new fields (default to 0) to satisfy the type.
- No updates needed in [app/src/features/planner/PlannerPage.test.tsx](app/src/features/planner/PlannerPage.test.tsx) beyond what the type requires (it doesn't read the new fields).

## Visual contract

```mermaid
flowchart LR
  Inputs[PlanInputs] --> Calc[projectNetWorth]
  Calc --> Points["ProjectionPoint[] with buckets"]
  Points --> Deflate[deflateToToday]
  Deflate --> Chart[Stacked BarChart]
  Chart --> Tooltip["Tooltip: Year, Age, 4 rows, Total"]
  Chart --> Legend["Legend: Savings, Other, Real Estate, Debt"]
```