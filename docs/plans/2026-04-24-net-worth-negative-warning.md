---
name: Net worth negative warning
overview: Add a coral alert under the Projected net worth chart — mirroring the existing Liquidity warning — that fires when the projection first dips below zero, showing the year, age, and shortfall amount.
todos:
  - id: derive
    content: Compute firstNegativeNetWorth in PlannerPage
    status: completed
  - id: render
    content: Render NetWorthWarning under ProjectionChart
    status: completed
  - id: component
    content: Add NetWorthWarning component alongside LiquidityWarning
    status: completed
isProject: false
---

## Changes in [app/src/features/planner/PlannerPage.tsx](app/src/features/planner/PlannerPage.tsx)

1. Compute the first negative net-worth point alongside the existing `firstNegativeLiquid`:

```ts
const firstNegativeNetWorth = displayed.find((p) => p.netWorth < 0) ?? null;
```

2. Render a warning inside the Projected net worth card, directly after `<ProjectionChart data={displayed} />`, styled identically to `LiquidityWarning`:

```tsx
<ProjectionChart data={displayed} />
{firstNegativeNetWorth ? (
  <NetWorthWarning
    year={firstNegativeNetWorth.year}
    age={firstNegativeNetWorth.age}
    shortfallLabel={format(firstNegativeNetWorth.netWorth)}
  />
) : null}
```

3. Add a sibling component `NetWorthWarning` next to `LiquidityWarning`. Same outer markup (role=alert, coral border/bg) and eyebrow, only the heading text and body copy change:

```tsx
function NetWorthWarning({ year, age, shortfallLabel }: { year: number; age: number; shortfallLabel: string }) {
  return (
    <div role="alert" className="mt-5 rounded-xl border border-[var(--coral)]/40 bg-[var(--coral)]/10 p-4">
      <div className="eyebrow" style={{ color: "var(--coral)" }}>
        Net worth warning
      </div>
      <p className="mt-1 text-sm leading-relaxed text-[var(--navy)]">
        Your projected net worth goes negative in <strong>{year}</strong> (age {age}) at{" "}
        <strong className="tabular-nums">{shortfallLabel}</strong>. Your debts exceed your
        assets from that year onward; consider reducing spending, paying down debt, or
        extending your earning horizon.
      </p>
    </div>
  );
}
```

I'm keeping `LiquidityWarning` as its own component rather than generalising, because the two warnings have different body copy and it's simpler to read than a prop-driven variant.

## No other files

- [ProjectionChart.tsx](app/src/features/planner/ProjectionChart.tsx) unchanged — the warning lives in `PlannerPage` so it sits in the card, outside the chart, exactly like `LiquidityWarning` does today.
- No calculator or type changes. `netWorth` is already on each `ProjectionPoint`.
- Existing tests in [PlannerPage.test.tsx](app/src/features/planner/PlannerPage.test.tsx) and [calculator.test.ts](app/src/features/planner/calculator.test.ts) continue to pass; no new assertions required for this styling addition.