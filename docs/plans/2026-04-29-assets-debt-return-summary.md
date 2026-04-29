---
name: assets-debt-return-summary
overview: Append the Expected annual return rate to the Assets & Debt collapsed-pill summary so it reads "Net $X · 5.0% return on Liquid assets", reusing the existing percent formatter and middle-dot separator conventions.
todos:
  - id: summary-fn
    content: Update `summarizeAssetsDebt` in `PlannerForm.tsx` to append `· {percent} return on Liquid assets`.
    status: completed
  - id: tests
    content: Loosen the existing collapse-summary regex in `PlannerForm.test.tsx` and add a new test that the summary tracks the Expected annual return slider.
    status: completed
  - id: lint-typecheck-test
    content: Run `npm run lint`, `npm run typecheck`, `npm test` and report results.
    status: completed
  - id: manual-verification-pause
    content: Pause for manual dev-server verification of the collapsed pill and the live slider update.
    status: in_progress
  - id: ship
    content: "After approval: branch, commit, push, open PR, wait for green CI, squash-merge, clean up branches."
    status: pending
isProject: false
---

# Assets & Debt summary: include expected return

## Scope

A one-function UI tweak. The collapsed pill for Assets and Debt currently shows just `Net $X`; we add the expected annual return so it reads e.g.:

> Net $10K · 5.0% return on Portfolio

(Decimal precision matches the slider's 0.1% step and the existing `percent` formatter `(v * 100).toFixed(1) + "%"` used everywhere else in the form, so e.g. 5.4% renders correctly.)

## File-by-file changes

### 1. [app/src/features/planner/PlannerForm.tsx](app/src/features/planner/PlannerForm.tsx)

Update `summarizeAssetsDebt` (lines 176-187) to append the return rate using the same `·` separator as `summarizeIncomeExpenses` (line 193):

```ts
function summarizeAssetsDebt(
  v: PlanInputs,
  formatCompact: (n: number) => string
): string {
  const net =
    v.startAssets +
    v.cashBalance +
    v.nonLiquidInvestments +
    v.otherFixedAssets -
    v.startDebt;
  return `Net ${formatCompact(net)} · ${percent(v.nominalReturn)} return on Portfolio`;
}
```

`percent` is already defined at the top of the file (line ~63) and reused by every rate slider, so no new helper is needed.

### 2. [app/src/features/planner/PlannerForm.test.tsx](app/src/features/planner/PlannerForm.test.tsx)

The existing collapse-summary test at lines 519-527 currently asserts:

```ts
expect(screen.queryByText(/^Net .{1,3}10K$/)).toBeNull();
// ...
expect(screen.getByText(/^Net .{1,3}10K$/)).toBeInTheDocument();
```

The `$` anchor will fail once we append text. Loosen the regex to e.g. `/^Net .{1,3}10K · 5\.0% return on Liquid assets$/` (or drop the trailing `$` and match on the prefix). Add a small companion assertion confirming the rate string is present.

Also add one new test in the same file's "summary" group:

> "updates the Assets and Debt summary when the Expected annual return changes"

Steps: render, collapse Assets and Debt, drag the `Expected annual return` slider via `fireEvent.change` to e.g. `0.07`, confirm `7.0% return on Portfolio` shows in the collapsed pill.

## Out of scope (confirmed unchanged)

- `packages/core/` — no schema or projection logic changes.
- `docs/architecture.md` — summary text is UI copy, not part of the documented data model. No regen of architecture HTML/PDF.
- `docs/plans/` — small UI tweak, no plan archive.
- `.env.example`, `app/src/lib/env*.ts`, `README.md`, `ROADMAP.md` — unchanged.

## Workflow

Per [.cursor/rules/workflow.mdc](.cursor/rules/workflow.mdc):

1. Branch `feat/assets-debt-return-summary` off `main`.
2. Implement the changes above.
3. `npm run lint`, `npm run typecheck`, `npm test`.
4. Pause and ask you to dev-test in `npm run dev`. Specifically:
  - Collapse Assets and Debt; the pill reads `Net $X · 5.0% return on Portfolio`.
  - Slide Expected annual return to a few values (e.g. -2.0%, 0%, 7.5%); the pill text updates live.
  - All other category pills (About you, Income & Expenses, Real Estate, Life Events, Macro) are unchanged.
5. Wait for explicit "ship it" before committing, opening the PR, merging, and cleaning up branches.

