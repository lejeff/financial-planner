---
name: life-events-and-legend-cleanup
overview: Move Windfall fields into a new "Life Events" category (placed after Real Estate) and remove the "Positive / Negative / Shortfall" legend rows from both charts. Both changes ship together on one new branch.
todos:
  - id: form-move
    content: Remove Windfall fields from Income & Expenses fieldset in PlannerForm.tsx
    status: completed
  - id: form-new-category
    content: Add Life Events fieldset with Windfall amount + year after Real Estate
    status: completed
  - id: chart-legend
    content: Remove Positive/Negative and Positive/Shortfall legend rows plus unused LegendSwatch helper in PlannerPage.tsx
    status: completed
  - id: tests
    content: "Update PlannerForm.test.tsx: drop Windfall from Income & Expenses test, add Life Events render test and negative-presence assertion"
    status: completed
  - id: ship
    content: Branch, local checks (lint/typecheck/test), commit, PR, merge on green
    status: completed
isProject: false
---

## Scope

Two small UI changes, one branch, one PR:

1. Promote Windfall amount + Windfall year out of "Income & Expenses" into a dedicated **Life Events** fieldset (placed after Real Estate), so future items (home purchase, inheritance, etc.) can join it later.
2. Remove the legend swatch rows ("Positive / Negative" and "Positive / Shortfall") below each chart. The bar colors and tooltip already convey sign; the legend is noise.

## Form change: new Life Events category

File: [app/src/features/planner/PlannerForm.tsx](app/src/features/planner/PlannerForm.tsx)

- Remove the Windfall `CurrencyField` (lines 224-230) and the Windfall-year `FramedField` (lines 231-246) from the Income & Expenses `<fieldset>`. `INCOME_EXPENSE_AMOUNTS` stays as-is (Annual Salary only); Annual Rental Income, rental rate slider, and Recurring monthly expenses remain in place.
- Add a new `<fieldset>` immediately after the Real Estate fieldset (between lines 282 and 284, before the Inflation/Horizon slider block) with the same chrome as the other categories:

```tsx
<fieldset className="space-y-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-5">
  <legend className="eyebrow px-1 text-[var(--navy)]">Life Events</legend>
  <CurrencyField
    label="Windfall amount"
    value={value.windfallAmount}
    onChange={(next) => update("windfallAmount", next)}
    min={0}
    max={100_000_000}
  />
  <FramedField label="Windfall year">
    <input
      type="number"
      min={WINDFALL_YEAR_MIN}
      max={WINDFALL_YEAR_MAX}
      step={1}
      value={value.windfallYear}
      onChange={(event) => {
        const parsed = Number(event.target.value);
        update("windfallYear", Number.isFinite(parsed) ? parsed : 0);
      }}
      className="field-input"
      aria-label="Windfall year"
      inputMode="numeric"
    />
  </FramedField>
</fieldset>
```

- `WINDFALL_YEAR_MIN`/`MAX` constants stay where they are.
- No changes to `PlanInputs`, defaults, storage, or calculator — this is pure DOM relocation.

## Chart change: remove legend rows

File: [app/src/features/planner/PlannerPage.tsx](app/src/features/planner/PlannerPage.tsx)

- Delete the two `<div className="mt-4 flex items-center gap-5 ...">` blocks at lines 84-87 (Projected net worth legend) and 95-98 (Liquid position legend).
- Remove the now-unused `LegendSwatch` helper at line 210 to keep the file clean. No other references.

The Liquidity warning card (`firstNegativeLiquid` block) stays exactly as-is — it's the actionable signal; the legend was redundant.

## Test updates

File: [app/src/features/planner/PlannerForm.test.tsx](app/src/features/planner/PlannerForm.test.tsx)

- In the "renders every Income & Expenses field" test (lines 61-70): drop the two Windfall assertions; keep Annual Salary, Annual Rental Income, Rental rate, Recurring monthly expenses.
- Add a new test:

```tsx
it("renders the Life Events fieldset with Windfall amount and year", () => {
  render(<Host />);
  const fs = screen.getByText("Life Events").closest("fieldset")!;
  expect(within(fs).getByLabelText("Windfall amount")).toBeInTheDocument();
  expect(within(fs).getByLabelText("Windfall year")).toBeInTheDocument();
});

it("does not render Windfall fields inside Income & Expenses", () => {
  render(<Host />);
  const fs = screen.getByText("Income & Expenses").closest("fieldset")!;
  expect(within(fs).queryByLabelText("Windfall amount")).toBeNull();
  expect(within(fs).queryByLabelText("Windfall year")).toBeNull();
});
```

- The existing "updates the Windfall year field when the user types" test (line 106) uses a global `getByLabelText` and keeps working — no change needed.

No changes to [PlannerPage.test.tsx](app/src/features/planner/PlannerPage.test.tsx) — it doesn't assert on legend swatches.

## Shipping

- Branch: `feat/life-events-and-legend-cleanup` off the current `main`.
- Local: `npm run lint`, `npm run typecheck`, `npm test` from repo root.
- Single commit: `feat(planner): add Life Events category and drop chart legends`.
- Open PR, wait for CI green, merge (squash), delete branch, `git pull` on `main`.