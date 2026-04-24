---
name: Bar Chart Net Worth
overview: Fix the missing Tailwind CSS setup so the chart (and all styling) renders correctly, then swap the line chart for a bar chart with hover tooltips showing the net worth for each year.
todos:
  - id: tailwind-fix
    content: Wire up Tailwind CSS v4 (postcss config + @tailwindcss/postcss dep + @import in globals.css) so utility classes actually apply.
    status: completed
  - id: bar-chart-swap
    content: Replace LineChart with BarChart in ProjectionChart.tsx, using green/red Cells based on sign, and keep the hover tooltip.
    status: completed
  - id: chart-validate
    content: Run lint, typecheck, tests, and build; then visually verify the chart renders and tooltip shows year/age/net worth.
    status: completed
isProject: false
---

# Fix Chart Rendering + Swap to Bar Chart

## Root cause of the missing chart

Tailwind CSS was never wired into the app:

- No `tailwind.config.*` file exists.
- No `postcss.config.*` file exists.
- `[app/src/app/globals.css](app/src/app/globals.css)` has no `@import "tailwindcss"` directive.

So the chart wrapper's `h-[400px] w-full` is ignored, the parent has 0 height, and Recharts' `ResponsiveContainer` silently renders nothing (matches the earlier build warning "width(-1) and height(-1) of chart should be greater than 0"). Fixing Tailwind also fixes the overall page styling, not just the chart.

## Step 1: Wire up Tailwind CSS v4

The app already has `tailwindcss@^4` in `[app/package.json](app/package.json)`. Tailwind v4 needs two pieces that are missing:

1. Install the PostCSS plugin inside the `app` workspace:

```bash
npm install -D @tailwindcss/postcss -w app
```

2. Create `[app/postcss.config.mjs](app/postcss.config.mjs)`:

```js
export default {
  plugins: {
    "@tailwindcss/postcss": {}
  }
};
```

3. Prepend the Tailwind import to `[app/src/app/globals.css](app/src/app/globals.css)`:

```css
@import "tailwindcss";
```

(Existing CSS in that file can stay below the import.)

No `tailwind.config.*` file is required for v4 defaults.

## Step 2: Swap LineChart to BarChart

Replace the chart body in `[app/src/features/planner/ProjectionChart.tsx](app/src/features/planner/ProjectionChart.tsx)`:

```tsx
<BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
  <YAxis tickFormatter={compactCurrency} tick={{ fontSize: 12 }} width={70} />
  <Tooltip
    formatter={(value) => [compactCurrency(Number(value)), "Net worth"]}
    labelFormatter={(label, payload) => {
      const point = payload?.[0]?.payload as ProjectionPoint | undefined;
      return point ? `Year ${label} (age ${point.age})` : `Year ${label}`;
    }}
  />
  <Bar dataKey="netWorth" isAnimationActive={false}>
    {data.map((point) => (
      <Cell key={point.year} fill={point.netWorth >= 0 ? "#10b981" : "#ef4444"} />
    ))}
  </Bar>
</BarChart>
```

Update the recharts imports:

```ts
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
```

`[app/src/features/planner/PlannerPage.tsx](app/src/features/planner/PlannerPage.tsx)` does not need to change.

## Step 3: Validate

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- Reload `http://localhost:3000`: expect a full bar chart with green positive bars, tooltip on hover showing year, age, and net worth, and the rest of the page styled properly by Tailwind.

## Out of scope

- No changes to calculation logic, inputs, or persistence.
- No change to the deferred roadmap items (Monte Carlo, Supabase, etc.).
