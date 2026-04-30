# Customizable card labels

Make the legend title on every stackable card editable inline. Empty label falls back to the existing auto-numbered default. Persisted via a new `label` field on each variant's schema.

## Scope

Four card types, all going through `CollapsibleSubsection` ([app/src/features/planner/PlannerForm.tsx](app/src/features/planner/PlannerForm.tsx)):

- `WindfallEventCard` — default `Windfall N`
- `RealEstateInvestmentCard` — default `Real Estate Investment N`
- `NewDebtEventCard` — default `New Debt N`
- `RealEstateHoldingCard` — default `Real Estate N`

(`CollapsibleCategory` parents — About you, Assets and Debt, etc. — are NOT affected. Sub-pills inside Assets and Debt — Liquid / Non-Liquid / Debt — are also NOT affected; only the per-card pills the user adds.)

## UX

The current legend `<button>` text toggles open/closed. Replace it with a text input + small pencil icon that edits the label. The chevron in the top-right and the click-anywhere-on-collapsed-pill-body both already toggle open/closed, so swapping the title to an input does not remove any open/close affordance.

- Input shows `event.label` if non-empty.
- If empty, input shows the auto-numbered default as `placeholder`.
- A small pencil icon (12px, accent-colored, `aria-hidden`) sits to the immediate right of the input as a static affordance — always visible so the editable nature is discoverable. Clicking the pencil focuses the input and selects all of its text.
- Focused state: subtle accent-colored underline / outline so the user sees it's editable. Hover state shows a faint background tint on the input.
- `Enter` blurs and commits; `Escape` blurs (no revert — see "Open question 1" below).
- `onClick` on the input AND on the pencil button both call `e.stopPropagation()` so clicking either on a collapsed pill doesn't trigger the body-click expander (which would steal focus).
- Auto-size: use `size={Math.max(value.length || defaultLabel.length, 1)}` so the input width tracks content. Capped via `max-w-[14rem]` so a long label wraps the chevron gracefully.
- aria-label on the input: `Edit label, defaults to "${defaultLabel}"`.
- aria-label on the pencil button: `Edit label`. Tab order: input first, then pencil — so keyboard users can Tab into the input directly without going through the pencil.

aria-labels on Remove buttons / inflation toggles / range slider thumbs **stay numbered** (e.g. `Remove windfall 1`) — keeps screen-reader semantics stable independent of what the user types.

## Schema (`packages/core/src/planInputs.ts`)

Add `label: z.string().default("")` to each of:

- `RealEstateInvestmentEventSchema` (line 22)
- `WindfallEventSchema` (line 56)
- `NewDebtEventSchema` (line 79)
- `RealEstateHoldingSchema` (line 118)

Update each `makeDefault*` factory in the same package to set `label: ""`. The Zod `.default("")` ensures legacy stored events round-trip cleanly through `PlanInputsSchema.parse()` — no `storage.ts` change needed.

## Form changes ([app/src/features/planner/PlannerForm.tsx](app/src/features/planner/PlannerForm.tsx))

### 1. Extend `CollapsiblePill` legend

Replace the legend `<button>` (lines 922–937) with a structure that conditionally renders either a button (current behavior, used by `CollapsibleCategory` parents and Liquid/Non-Liquid/Debt sub-pills) or a text input + open/close click target. Drive the choice with a new optional prop on `CollapsiblePill`:

```tsx
editableTitle?: {
  value: string;            // event.label, possibly ""
  onChange: (next: string) => void;
  defaultLabel: string;     // auto-numbered fallback, e.g. "Windfall 1"
};
```

When `editableTitle` is provided, the legend renders an input + a pencil button. We use a `useRef` to focus + select the input from the pencil click:

```tsx
const inputRef = useRef<HTMLInputElement>(null);

<legend className={legendClass} style={{ color: accent }}>
  <span className="inline-flex items-center gap-1.5">
    <input
      ref={inputRef}
      type="text"
      value={editableTitle.value}
      placeholder={editableTitle.defaultLabel}
      onChange={(e) => editableTitle.onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
      }}
      size={Math.max(
        (editableTitle.value || editableTitle.defaultLabel).length,
        1
      )}
      className="bg-transparent border-0 outline-none focus:underline placeholder:opacity-70 max-w-[14rem] hover:bg-[color-mix(in_oklab,var(--accent)_8%,transparent)] rounded-sm px-0.5"
      style={{ color: accent }}
      aria-label={`Edit label, defaults to "${editableTitle.defaultLabel}"`}
    />
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        inputRef.current?.focus();
        inputRef.current?.select();
      }}
      aria-label="Edit label"
      className="inline-flex shrink-0 opacity-60 hover:opacity-100"
      style={{ color: accent }}
    >
      <PencilIcon />
    </button>
  </span>
</legend>
```

Add a `PencilIcon` component near the existing `Chevron` (line ~1052) — small inline SVG, 12px, `currentColor` stroke so it inherits the accent.

The chevron (top-right) and the existing collapsed-pill body `onClick` (line ~894) keep handling open/close. No behavior is lost.

When `editableTitle` is undefined (parent categories, asset sub-pills), the legend keeps today's `<button>{title}</button>` exactly.

### 2. Pass `editableTitle` from the four cards

Each card passes the new prop alongside the existing `title=` (which we keep as a non-editable fallback used in error states / aria-* derivations):

| Card | Default label | event field |
|------|---------------|-------------|
| `WindfallEventCard` (line 1269) | `Windfall ${index + 1}` | `event.label` |
| `RealEstateInvestmentCard` (line 1162) | `Real Estate Investment ${index + 1}` | `event.label` |
| `NewDebtEventCard` (line 1373) | `New Debt ${index + 1}` | `event.label` |
| `RealEstateHoldingCard` (line 1589) | `Real Estate ${index + 1}` | `holding.label` |

Each card already receives `onChange` to mutate its event/holding — wire the input's `onChange` through that:

```tsx
editableTitle={{
  value: event.label,
  onChange: (label) => onChange({ label }),
  defaultLabel: `Windfall ${index + 1}`,
}}
```

### 3. `title` prop stays as the default

The legacy `title=\`Windfall ${index + 1}\`` prop stays in place for backward compatibility (and so `CollapsibleCategory` callers that don't pass `editableTitle` still work). When `editableTitle` is provided, the input takes over rendering — so `title` is effectively unused for the four card types but kept for type-safety + the (rare) case where we'd want to render a non-editable fallback.

## Tests ([app/src/features/planner/PlannerForm.test.tsx](app/src/features/planner/PlannerForm.test.tsx))

### Existing tests to update

The legend was previously matched via `getByRole("button", { name: /^Windfall 1$/i })` — for the four card types, the legend is now an `<input>`, not a button. Six call sites need to switch to `getByRole("textbox", { name: /Edit label, defaults to "Windfall 1"/i })` or equivalent placeholder lookup:

- Line 300, 348 — `Windfall 1`
- Line 1301, 1312 — `Real Estate 1` (RE Holding)
- Line 1563, 1605 — `New Debt 1`

### New tests to add

In `describe("Card label customization")` (or fold into each card's existing block):

1. Adding a card surfaces a placeholder of the auto-numbered default in the legend input.
2. Typing in the legend input updates `event.label`; the new text shows when the card is collapsed and reopened.
3. Clearing the legend input back to "" restores the auto-numbered placeholder (rendered via the `placeholder` attribute, not as the value).
4. Clicking the input on a collapsed pill does NOT expand the pill (stopPropagation works). Pressing the chevron still expands it.
5. `Escape` blurs the input (manual revert isn't supported in the simple version — see "Open question 2" below).
6. Custom labels round-trip through `localStorage`: seed a `PlanInputs` with a custom-labeled event, render, confirm the legend input shows the custom value.

## Documentation

- `docs/architecture.md` §4.1 — add `label: string` (default `""`) to each of `WindfallEvent`, `RealEstateInvestmentEvent`, `NewDebtEvent`, and `RealEstateHolding` field tables. Run `npm run docs:build` and commit the regenerated `architecture.pdf` + `architecture.html` per the docs rule.
- `README.md`, `ROADMAP.md`, `.env.example` — no change.
- Archive plan to `docs/plans/2026-04-30-customizable-card-labels.md`, bump `docs/plans/README.md` count 38 → 39.

## Decisions locked in

- **Edit affordance**: small accent-colored pencil icon to the right of the input, always visible (decided: discoverability matters more than minimalism).
- **Escape behavior**: `Escape` blurs the input but does NOT revert. Simpler implementation; the user can Cmd-Z in the input if they regret. Revisit if it feels wrong in manual testing.

## Out of scope

- Renaming sub-pills (Liquid / Non-Liquid / Debt) or parent categories — those remain fixed-label.
- Reordering cards (would need explicit drag handles + an `order` field).
- Validating label length / uniqueness — labels are free-form strings, empty is allowed (falls back to default).
