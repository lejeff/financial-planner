---
name: Summary Card Cleanup
overview: "Replace the 'Projection horizon: N yrs' summary card with a clearer card that shows the end age and end year of the projection. Slider and input form are untouched."
todos:
  - id: card-swap
    content: "In PlannerPage.tsx, add endYear derivation and replace the 'Projection horizon: N yrs' card with a 'Projection ends at: Age X in YYYY' card."
    status: completed
  - id: smoke-validate
    content: Run typecheck and lint to confirm no regressions; visually verify the new card updates with the horizon slider.
    status: completed
isProject: false
---

# Summary Card Cleanup for Projection Horizon

## Scope

Only the third summary card in `[app/src/features/planner/PlannerPage.tsx](app/src/features/planner/PlannerPage.tsx)` changes. The horizon slider, its label, and the numeric input in `[app/src/features/planner/PlannerForm.tsx](app/src/features/planner/PlannerForm.tsx)` stay exactly as they are.

## Change

Current card:

```tsx
<div className="rounded border border-gray-200 p-4">
  <div className="text-xs uppercase tracking-wide text-gray-500">Projection horizon</div>
  <div className="mt-1 text-2xl font-semibold">{projection.length - 1} yrs</div>
</div>
```

New card (label + value showing age and calendar year at the end of the projection):

```tsx
<div className="rounded border border-gray-200 p-4">
  <div className="text-xs uppercase tracking-wide text-gray-500">Projection ends at</div>
  <div className="mt-1 text-2xl font-semibold">
    Age {endAge} <span className="text-gray-500">in {endYear}</span>
  </div>
</div>
```

`endAge` already exists. Derive `endYear` the same way, from the last projection point:

```ts
const endYear = finalPoint?.year ?? new Date().getFullYear();
```

Place that alongside the existing `const endAge = finalPoint?.age ?? currentAge;` line.

## Out of scope

- No changes to `PlannerForm.tsx` (slider label stays "Projection horizon" and value stays formatted as "N years").
- No changes to the other two summary cards (`Current age` and `Projected net worth at age X`).
- No changes to calculator, types, storage, or tests.

## Validation

- Drag the horizon slider; the right card updates live to "Age X in YYYY".
- Run `npm run lint` and `npm run typecheck` as a smoke check; no other suites need re-running since only a render expression changes.