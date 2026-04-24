---
name: Coral savings when negative
overview: When Savings goes negative, recolor that segment (and its tooltip row marker) with a slightly darker coral, distinct from the existing Debt coral, while leaving the legend swatch as the default green.
todos:
  - id: palette
    content: Add SAVINGS_NEG constant (#e05c3a)
    status: completed
  - id: bar-fill
    content: Override fill in SavingsBarShape based on savings sign
    status: completed
  - id: tooltip
    content: Pick Savings row dot color by sign in ChartTooltip
    status: completed
isProject: false
---

## Palette

Add one new constant in [app/src/features/planner/ProjectionChart.tsx](app/src/features/planner/ProjectionChart.tsx):

```ts
const SAVINGS_NEG = "#e05c3a"; // darker coral for negative savings
```

For reference, existing:
- `SAVINGS = "#58b17b"` (positive savings)
- `DEBT = "#ff7a59"` (debt coral)

`SAVINGS_NEG` is deliberately a shade darker/more saturated than `DEBT` so the two coral tones read as related but clearly distinct in side-by-side coral segments.

## Bar color

In `SavingsBarShape`, compute the fill from the sign of `savings` instead of inheriting `props.fill`:

```tsx
function SavingsBarShape(props: BarShapeProps) {
  const isNegative = (props.payload?.savings ?? 0) < 0;
  const heightNeg = (props.height ?? 0) < 0;
  const radius: [number, number, number, number] = isNegative
    ? heightNeg ? [6, 6, 0, 0] : [0, 0, 6, 6]
    : [0, 0, 0, 0];
  const fill = isNegative ? SAVINGS_NEG : SAVINGS;
  return <Rectangle {...(props as object)} fill={fill} radius={radius} />;
}
```

The `<Bar fill={SAVINGS}>` prop stays as the default (drives the static legend dot); the shape override wins per segment.

## Tooltip

Pick the dot color per-year in `ChartTooltip`:

```tsx
const savingsColor = point.savings < 0 ? SAVINGS_NEG : SAVINGS;
const rows: Array<{ label: string; value: number; color: string }> = [
  { label: "Savings", value: point.savings, color: savingsColor }
];
```

Everything else (Other Assets, Real Estate, Debt rows, Total line) is unchanged.

## Legend

Leave untouched. The legend represents the "canonical" color for the series, which stays green. The year-specific coral variant is a per-value signal and is conveyed by the bar itself and by the tooltip dot.

## No test or calculator changes

This is a pure render/styling change. No updates to [calculator.ts](app/src/features/planner/calculator.ts), [types.ts](app/src/features/planner/types.ts), or [calculator.test.ts](app/src/features/planner/calculator.test.ts).