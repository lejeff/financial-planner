---
name: Form Copy Cleanup
overview: "Small polish pass on the planner form: drop per-field helpers, move the \"in today's money\" context next to the section legend, remove the Name field from this page (keep it in the data model for the future account page), and drop the \"Base\" prefix from two labels."
todos:
  - id: remove-name
    content: Remove the Name FramedField from PlannerForm's 'About you' fieldset and collapse its grid to one column.
    status: completed
  - id: strip-helpers
    content: Drop every helper string from the AMOUNTS array and stop passing helper to CurrencyField.
    status: completed
  - id: rename-labels
    content: Change 'Base monthly spending' -> 'Monthly spending' and 'Base annual non-rental income' -> 'Annual non-rental income'.
    status: completed
  - id: legend-context
    content: Update the 'Your numbers' legend to include the inline 'in today's money' note.
    status: completed
  - id: verify
    content: Run typecheck and tests.
    status: completed
isProject: false
---

## Changes

All in [app/src/features/planner/PlannerForm.tsx](app/src/features/planner/PlannerForm.tsx).

- Remove the "About you" fieldset entirely (both Name and Date of birth).
  - Wait — the user only asked to remove Name. I'll keep Date of birth in its current `FramedField`, but collapse the now-single-field grid to one column. The "About you" legend stays and wraps just the DOB.
- Strip the `helper` string from every `AMOUNTS` entry (no per-field subtext under any currency field).
- Update two labels in `AMOUNTS`:
  - `monthlySpending`: `"Base monthly spending"` → `"Monthly spending"`
  - `annualIncome`: `"Base annual non-rental income"` → `"Annual non-rental income"`
- Update the "Your numbers" `<legend>` to include inline context:
  ```tsx
  <legend className="eyebrow">
    Your numbers <span className="text-[var(--ink-muted)] normal-case tracking-normal">· in today's money</span>
  </legend>
  ```
  (keeps eyebrow caps on "Your numbers", then a soft separator and readable inline note.)
- Since `helper` is no longer used here, also remove the `helper?: string` prop from the `AmountSpec` type inside this file and from `<CurrencyField helper={...}>` — `CurrencyField` itself keeps the optional `helper` prop for future callers (Account page, etc.), so no cross-cutting changes.

## What stays

- `PlanInputs.name` and its default stay in [app/src/features/planner/types.ts](app/src/features/planner/types.ts); `loadInputs`/`saveInputs` keep persisting it. The account page will render/edit it later.
- `CurrencyField` component API is unchanged (`helper?` still accepted but no longer passed from `PlannerForm`).
- `FramedField` unchanged.

## Validation

- `npm run typecheck` stays green.
- `npm run test` stays green (no test references the removed strings).
- Visual smoke: only Date of birth shows in "About you" (single-column); currency fields have no subtext; the "Your numbers" heading reads `YOUR NUMBERS · in today's money`; labels read "Monthly spending" and "Annual non-rental income".
