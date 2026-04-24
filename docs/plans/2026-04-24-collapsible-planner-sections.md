---
name: collapsible-planner-sections
overview: "Make every category and subsection inside \"Your Numbers\" collapsible with a chevron toggle. Progressive-disclosure defaults: only the first section open at each level; all others closed. Pure UI/UX change, no changes to inputs, calculator, or storage."
todos:
  - id: form-components
    content: Add CollapsibleCategory, CollapsibleSubsection, and Chevron helpers in PlannerForm.tsx
    status: completed
  - id: form-wire
    content: Wrap the four top-level fieldsets and three nested subsections with the collapsible components and set progressive-disclosure defaults
    status: completed
  - id: tests-update
    content: Update PlannerForm.test.tsx existing tests to expand sections before asserting hidden content
    status: completed
  - id: tests-new
    content: Add tests for default open/closed state and toggle behavior
    status: completed
  - id: checks
    content: Run lint / typecheck / test locally
    status: completed
  - id: manual-pause
    content: Pause and ask the user to verify the collapsible UX in the dev server
    status: completed
  - id: ship
    content: "After user approval: commit, PR, merge on green, cleanup"
    status: completed
isProject: false
---

## Scope

The left panel currently shows four top-level fieldsets (Assets and Debt, Income & Expenses, Real Estate, Life Events) and three nested subsections inside Assets and Debt (Liquid, Non-Liquid, Debt). Every variable is visible at once, which is a lot of scrolling.

This change wraps each of those seven regions in a click-to-collapse header with a chevron. Nothing else about the planner logic, inputs, defaults, storage, or tests of the calculator changes.

## Defaults (progressive disclosure)

- Top level: **Assets and Debt open**, Income & Expenses / Real Estate / Life Events closed.
- Nested inside Assets and Debt: **Liquid open**, Non-Liquid / Debt closed.
- About you (Date of birth) and the loose Inflation / Projection horizon sliders stay as they are (never collapsed).
- State is React-local (not persisted). If you want localStorage persistence later we can add it in a follow-up.

## Form changes

File: [app/src/features/planner/PlannerForm.tsx](app/src/features/planner/PlannerForm.tsx)

Add two small local components above the default export:

```tsx
type CollapsibleProps = {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

function CollapsibleCategory({ title, defaultOpen = false, children }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <fieldset className="space-y-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-5">
      <legend className="px-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="eyebrow flex w-full items-center justify-between text-[var(--navy)]"
        >
          <span>{title}</span>
          <Chevron open={open} />
        </button>
      </legend>
      {open ? (
        <div id={panelId} className="space-y-4">
          {children}
        </div>
      ) : null}
    </fieldset>
  );
}

function CollapsibleSubsection({
  title, defaultOpen = false, testId, children
}: CollapsibleProps & { testId: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div className="space-y-3" data-testid={testId}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="eyebrow flex w-full items-center justify-between text-[11px] tracking-[0.14em] text-[var(--ink-muted)]"
      >
        <span>{title}</span>
        <Chevron open={open} small />
      </button>
      {open ? (
        <div id={panelId} className="space-y-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function Chevron({ open, small = false }: { open: boolean; small?: boolean }) {
  const size = small ? 12 : 14;
  return (
    <svg
      width={size} height={size} viewBox="0 0 20 20" aria-hidden="true"
      className={"transition-transform duration-150 " + (open ? "rotate-180" : "")}
    >
      <path d="M5 7l5 6 5-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```

Then swap the JSX:

- Replace the four top-level `<fieldset>` blocks (Assets and Debt, Income & Expenses, Real Estate, Life Events) with `<CollapsibleCategory title="..." defaultOpen={...}>`. Only Assets and Debt gets `defaultOpen`.
- Inside Assets and Debt, replace the three `<div data-testid="subsection-...">` blocks with `<CollapsibleSubsection title="..." testId="..." defaultOpen={...}>`. Only Liquid gets `defaultOpen`.
- `useState` and `useId` are already used in the project; add the imports from `react` at the top.

No changes to `PlanInputs`, `DEFAULT_PLAN_INPUTS`, `storage.ts`, `calculator.ts`, or either chart.

## Test updates

File: [app/src/features/planner/PlannerForm.test.tsx](app/src/features/planner/PlannerForm.test.tsx)

Now that most sections start collapsed, tests that look inside a collapsed section need to expand it first. Add a small helper near the top of the `describe` block:

```tsx
async function expand(name: RegExp | string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name }));
}
```

Changes per existing test:

- `"renders the form shell with every top-level group"` (line ~27): still works; asserts category labels, which remain in the toggle buttons.
- `"groups Liquid / Non-Liquid / Debt inside Assets and Debt with the right fields"` (line ~39): Assets and Debt starts open, Liquid starts open. Expand Non-Liquid and Debt subsections before asserting their content. Make the test `async`.
- `"renders every Income & Expenses field..."` (line ~61): expand `/income & expenses/i` first. `async`.
- `"renders the Life Events fieldset with Windfall amount and year"` (line ~70): expand `/life events/i` first. `async`.
- `"does not render Windfall fields inside Income & Expenses"` (line ~77): expand `/income & expenses/i` first, then assert `queryByLabelText` returns null. `async`.
- `"renders every Real Estate field..."` (line ~84): expand `/real estate/i` first. `async`.
- `"keeps the Projection horizon slider outside all three categories"` and `"renders the Inflation slider outside..."`: still work; loose sliders are not inside fieldsets.
- `"updates the Cash Balance field when the user types"`: Liquid is open by default; still works.
- `"updates the Windfall year field when the user types"`: Life Events is closed. Expand it first. `async`.

Add new tests:

```tsx
it("starts with Assets and Debt open and the other categories closed", () => {
  render(<Host />);
  expect(screen.getByRole("button", { name: /assets and debt/i })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("button", { name: /income & expenses/i })).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("button", { name: /real estate/i })).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("button", { name: /life events/i })).toHaveAttribute("aria-expanded", "false");
});

it("starts with Liquid open and Non-Liquid / Debt closed inside Assets and Debt", () => {
  render(<Host />);
  expect(screen.getByRole("button", { name: /^liquid$/i })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("button", { name: /non-liquid/i })).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("button", { name: /^debt$/i })).toHaveAttribute("aria-expanded", "false");
});

it("toggles a category open and closed when the header is clicked", async () => {
  const user = userEvent.setup();
  render(<Host />);
  const btn = screen.getByRole("button", { name: /real estate/i });
  expect(btn).toHaveAttribute("aria-expanded", "false");
  await user.click(btn);
  expect(btn).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByLabelText("Primary Residence value")).toBeInTheDocument();
  await user.click(btn);
  expect(btn).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByLabelText("Primary Residence value")).toBeNull();
});
```

[app/src/features/planner/PlannerPage.test.tsx](app/src/features/planner/PlannerPage.test.tsx) lines 55-57 only assert the category text exists, which the toggle buttons still render. No changes needed there.

## Ship sequence (per the repo workflow rule)

1. Branch `feat/collapsible-planner-sections` off `main`.
2. Apply the PlannerForm + test changes above.
3. Run `npm run lint`, `npm run typecheck`, `npm test` from the repo root.
4. **Pause and hand off for manual verification** in `npm run dev`:
   - On load, only Assets and Debt is expanded, and within it only Liquid is expanded.
   - Clicking any category header toggles it; chevron rotates; `aria-expanded` flips.
   - Clicking a subsection header inside Assets and Debt toggles only that subsection.
   - Inputs continue to drive the charts when a section is expanded; when a section is collapsed its values still feed the projection (verify by editing Windfall amount, collapsing Life Events, and seeing the chart unchanged).
5. Only after explicit approval: commit, push, open PR, merge on CI green, clean up branches.