---
name: new-debt-range-slider
overview: Replace the two single-handle Start year + End year sliders on the New Debt life-event card with one dual-thumb range slider built on shadcn's Slider (a thin wrapper around @radix-ui/react-slider). Two helper lines below the slider preserve the existing principal preview, relative-year text, and inFine label swap. Radix enforces start <= end natively, so no projection/schema changes are needed.
todos:
  - id: install-dep
    content: Install `@radix-ui/react-slider` in the `app` workspace.
    status: completed
  - id: range-slider-primitive
    content: Create `app/src/features/planner/RangeSlider.tsx` with the shadcn-style Radix wrapper and a `RangeSliderRow` matching `SliderRow`'s visual layout (title row, min/max ticks, two helper lines).
    status: completed
  - id: wire-new-debt-card
    content: In `NewDebtEventCard`, drop `startYearSpec`/`endYearSpec`/`endYearLabel` and replace the two `SliderRow`s with one `RangeSliderRow` carrying both helpers and the inFine prefix swap.
    status: completed
  - id: update-tests
    content: Update existing PlannerForm tests that referenced the old labels/helpers, and add 2 new regression tests (start <= end clamping, inFine helper prefix swap).
    status: completed
  - id: doc-audit
    content: Audit README.md and docs/architecture.md for the new dep; update + regen architecture HTML/PDF if needed.
    status: completed
  - id: lint-typecheck-test
    content: Run `npm run lint`, `npm run typecheck`, `npm test` and report results.
    status: completed
  - id: manual-verification-pause
    content: Pause for manual dev-server verification (single dual-thumb slider, ordering, two helpers, inFine swap, keyboard nav, visual match).
    status: in_progress
  - id: ship
    content: "After approval: branch, commit, push, open PR, watch CI, squash-merge, clean up branches, archive plan."
    status: pending
isProject: false
---

## Behavior

- One dual-thumb slider replaces the two stacked `SliderRow`s on `NewDebtEventCard`. Thumbs control `startYear` and `endYear` independently.
- Radix's default ordering enforcement prevents the start thumb from crossing the end thumb (and vice versa). The schema stays unchanged (`startYear` / `endYear` remain independent ints) so legacy data with `endYear <= startYear` still loads correctly and triggers the existing "End year is at or before start year" schedule message.
- Two helper lines below the slider (Start / End) preserve every piece of context the two old helpers carried, and the inFine label swap moves into the End helper line.

## Design

```
Loan period                          2030 — 2035
[================o============o====================]
2026                                                 2106
Start: $110K in 5 years
End: in 10 years
```

In `inFine` mode the second line becomes `Lump sum repayment: in 10 years` (mirrors the existing dynamic "Loan end year" / "Lump sum repayment year" label swap). The repayment radio group above already conveys the mode, so dropping the prefix from the slider title in favor of a generic "Loan period" reads cleanly.

## File-by-file changes

### 1. [app/package.json](app/package.json) — add dependency

`npm install -w app @radix-ui/react-slider` (latest). Skipping `npx shadcn add slider` so we don't pull the broader `radix-ui` meta-package or the shadcn init machinery — we only need this one primitive. Vendor the small wrapper ourselves.

### 2. New file: `app/src/features/planner/RangeSlider.tsx`

Two exports, both kept in this file (mirroring the colocation pattern of `SliderRow` inside `PlannerForm.tsx`):

- `RangeSlider` — ~25-line shadcn-style wrapper around `@radix-ui/react-slider` (`Root` + `Track` + `Range` + N `Thumb` elements). Styling uses inline Tailwind to match the existing `.range` look: slim track (`h-[6px] bg-[var(--ink-muted)]/30`), filled range (`bg-[var(--accent)]`), thumbs (`size-4 rounded-full border bg-[var(--surface)]` with `border-[var(--accent)]`). The `--accent` CSS variable already cascades from the parent `CollapsiblePill` (see `globals.css` slider rules), so the slider auto-themes to the section's accent without a prop.
- `RangeSliderRow` — wrapper that mirrors `SliderRow`'s API and visual layout (title row + min/max ticks + helper lines):

```tsx
function RangeSliderRow({ spec, value, onChange, helpers }: {
  spec: SliderSpec;            // label, min, max, step, format (per-value)
  value: [number, number];
  onChange: (next: [number, number]) => void;
  helpers: [string, string];   // [start helper, end helper]
})
```

The title row shows `spec.label` on the left and `${format(value[0])} — ${format(value[1])}` on the right (em-dash range, matching existing typography). The two helper lines render in the same `text-[11px] text-[var(--ink-muted)]` style as the single-handle helper.

### 3. [app/src/features/planner/PlannerForm.tsx](app/src/features/planner/PlannerForm.tsx) — `NewDebtEventCard` (~lines 1281-1434)

- Delete `startYearSpec`, `endYearSpec`, and `endYearLabel`.
- Add a single `loanPeriodSpec: SliderSpec`:

```ts
const loanPeriodSpec: SliderSpec = {
  key: "newDebtLoanPeriod",
  label: "Loan period",
  min: yearMin,
  max: yearMax,
  step: 1,
  format: rawYear
};
```

- Replace the two `<SliderRow ... />` calls (~lines 1394-1415) with one `<RangeSliderRow>`:

```tsx
<RangeSliderRow
  spec={loanPeriodSpec}
  value={[event.startYear, event.endYear]}
  onChange={([start, end]) => onChange({ startYear: start, endYear: end })}
  helpers={[
    event.principal > 0
      ? `Start: ${format(inflatedPrincipal)} ${yearsFromNow(event.startYear, currentYear)}`
      : `Start: ${yearsFromNow(event.startYear, currentYear)}`,
    `${event.repaymentType === "inFine" ? "Lump sum repayment" : "End"}: ${yearsFromNow(event.endYear, currentYear)}`
  ]}
/>
```

`inflatedPrincipal` keeps its existing definition (~lines 1304-1312, computed from `yearsToStart = max(0, startYear - currentYear)`).

### 4. [app/src/features/planner/PlannerForm.test.tsx](app/src/features/planner/PlannerForm.test.tsx) — update + add tests

Update existing assertions that target the old labels / helper strings:

- ~Line 1307 ("adds a card with Principal + interest rate + repayment + start year + end year") — drop `getByText("Start year")` and `getByText("Loan end year")`. Replace with: assert `getByText("Loan period")` once, assert `getAllByRole("slider")` returns exactly 3 sliders on a fresh card (interest rate single + 2 range thumbs), assert helper texts `Start: in 5 years` and `End: in 10 years`.
- ~Line 1325 ("renders the end-year label as 'Lump sum repayment year' when repayment is inFine") — replace `getByText("Lump sum repayment year")` / `queryByText("Loan end year")` with assertions on the new helper prefix: `getByText(/^Lump sum repayment: in \d+ years?$/)` and `queryByText(/^End: /)` is null.
- ~Line 1402 ("shows the inflation-adjusted principal in the Start year helper when principal > 0") — update the regex from `/in 5 years/` + `/110/` to a single regex matching the prefixed helper, e.g. `/^Start: .{1,3}110\b.* in 5 years$/`.
- ~Line 1422 ("falls back to just the relative phrase in the Start year helper when principal is 0") — change `getByText("in 5 years")` to `getByText("Start: in 5 years")`.
- ~Line 1624 ("swaps the New Debt's Start year helper from the inflated preview to the face value when unchecked") — update the two regexes to include the `Start:` prefix.

Add 2 new regression tests in the `New debt events` describe:

1. "enforces start <= end on the New Debt range slider" — render, expand a new-debt card, get the two thumbs via `screen.getAllByRole("slider")` filtered by `aria-label` (Radix sets per-thumb `aria-label`, or fall back to position/order). Focus the start thumb, press ArrowRight repeatedly (≥ end - start + N times); assert the title-row text continues to read `${start} — ${end}` with start never exceeding end (Radix clamps).
2. "switches the End helper prefix to 'Lump sum repayment:' when repayment is set to inFine" — render, change the repayment radio to In Fine, assert helper text matches `/^Lump sum repayment: in \d+ years?$/` and the `Start:` helper still renders.

### 5. [README.md](README.md)

Add a one-line mention of `@radix-ui/react-slider` in whatever stack/dependencies section currently lists frontend libraries (per [documentation.mdc](.cursor/rules/documentation.mdc) "Stack / scripts changes (new package, ...) → README.md" rule). If the README doesn't enumerate deps individually, fold it into the broader UI-stack sentence.

### 6. [docs/architecture.md](docs/architecture.md)

Audit §2 (overview / stack) and any frontend-deps subsection. If a dep list exists, append `@radix-ui/react-slider`. No §4.1 (PlanInputs) change — schema is unchanged. If §2 is updated, regen via `npm run docs:build` and commit `architecture.md` + `architecture.html` + `architecture.pdf` together (per [docs/README.md](docs/README.md)).

## Out of scope (confirmed unchanged)

- `packages/core/` — no schema or projection changes. `NewDebtEventSchema.startYear` / `endYear` remain independent ints; no `superRefine` for ordering. Legacy stored data with `endYear <= startYear` still loads and falls through to the existing schedule warning copy.
- The existing single-handle `SliderRow` and the `.range` CSS in `globals.css` — untouched. The new `RangeSliderRow` is additive.
- Windfall, Real Estate Investment, Real Estate holding cards — all keep their single-handle sliders.
- The existing static Debt subsection (`Loan end year` / `Lump sum repayment year` for the legacy startDebt + payoff slider) — unchanged. Only the New Debt LIFE EVENT card is touched.
- `.env.example`, env schema, `ROADMAP.md` — no change.

## Workflow

Per [.cursor/rules/workflow.mdc](.cursor/rules/workflow.mdc):

1. Branch `feat/new-debt-range-slider` off `main`.
2. Install `@radix-ui/react-slider`, add `RangeSlider.tsx`, wire into `NewDebtEventCard`, update + add tests, audit README and architecture doc.
3. `npm run lint`, `npm run typecheck`, `npm test` — report results.
4. Pause and ask to dev-test in `npm run dev`. Specifically:
   - Add a New Debt card; verify a single dual-thumb slider with title "Loan period" and value display `YYYY — YYYY` replaces the two old sliders.
   - Drag both thumbs; verify start cannot cross end (and vice versa).
   - Verify the two helper lines: `Start: <principal preview when > 0> <relative time>` and `End: <relative time>`.
   - Toggle "Adjust amount for inflation" off; verify the Start helper drops the inflated preview and shows just the relative time (or face value depending on existing logic).
   - Switch repayment to In Fine; verify the End helper prefix changes to `Lump sum repayment:`.
   - Verify visual style matches the rest of the form (track thickness, accent color, thumb).
   - Verify keyboard nav: Tab to thumbs, ArrowLeft/ArrowRight move in 1-year steps, Home/End jump to bounds, ordering enforced via keyboard too.
   - Verify other life-event cards (Windfall, Real Estate Investment) and the legacy Debt subsection sliders are unchanged.
5. Wait for explicit "ship it" before commit, push, PR, watch CI, squash-merge, branch cleanup, and plan archive.