---
name: Reorder bar stacks
overview: Change the stack order in the Projected net worth chart so positive bars go Savings → Real Estate → Other Assets (bottom to top) and negative bars go Debt → Savings → Real Estate → Other Assets (from zero outward).
todos:
  - id: reorder
    content: Reorder realEstate before otherAssets in ProjectionChart
    status: completed
  - id: radius
    content: Move top-corner radius to topmost visible bar (otherAssets when present, else realEstate)
    status: completed
isProject: false
---

## Context

Today's bar order in [app/src/features/planner/ProjectionChart.tsx](app/src/features/planner/ProjectionChart.tsx) is `debtNeg` → `savings` → `otherAssets` → `realEstate`. With `stackOffset="sign"`, Recharts places the first-declared bar closest to zero (in both the positive and the negative stack) and stacks subsequent bars outward in declaration order.

Desired visual result:

- Positive stack (bottom to top): Savings, Real Estate, Other Assets
- Negative stack (top to bottom, i.e. zero outward): Debt, Savings, Real Estate, Other Assets

Because `debt`, `realEstate`, and `otherAssets` are never negative in our data model, only Debt and Savings actually appear in the negative stack. A single declaration order `[debtNeg, savings, realEstate, otherAssets]` yields both desired orderings simultaneously.

## Change in [app/src/features/planner/ProjectionChart.tsx](app/src/features/planner/ProjectionChart.tsx)

Swap the positions of the `realEstate` and `otherAssets` `<Bar>` blocks so `realEstate` comes before `otherAssets`. Move the top-corner `radius={[6, 6, 0, 0]}` to the new topmost bar (`otherAssets`) when it is rendered; keep it on `realEstate` when `otherAssets` is hidden so the topmost visible bar always has rounded top corners.

```tsx
{hasDebt ? (
  <Bar dataKey="debtNeg" name="Debt" stackId="a" fill={DEBT}
       shape={<DebtBarShape />} isAnimationActive={false} />
) : null}
<Bar dataKey="savings" name="Savings" stackId="a" fill={SAVINGS}
     shape={<SavingsBarShape />} isAnimationActive={false} />
<Bar dataKey="realEstate" name="Real Estate" stackId="a" fill={REAL_ESTATE}
     radius={hasOther ? undefined : [6, 6, 0, 0]}
     isAnimationActive={false} />
{hasOther ? (
  <Bar dataKey="otherAssets" name="Other Assets" stackId="a" fill={OTHER}
       radius={[6, 6, 0, 0]} isAnimationActive={false} />
) : null}
```

Nothing else in the file changes. `SavingsBarShape` and `DebtBarShape` already handle the outermost-negative-bar rounding purely off of Recharts' signed `height`, so reordering does not affect their behavior. The tooltip row order, legend, colors, calculator, and types are unchanged.

## No other files

- No calculator, type, or test changes. The existing [PlannerPage.test.tsx](app/src/features/planner/PlannerPage.test.tsx) and [calculator.test.ts](app/src/features/planner/calculator.test.ts) continue to pass; they don't assert bar ordering.