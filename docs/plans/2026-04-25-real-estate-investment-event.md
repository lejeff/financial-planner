# Real Estate Investment life event

Add a new "Real Estate Investment" life event so users can model future
property purchases that behave like the existing primary residence + rental
income (compounding value, per-event rental income), but start in a future
year and are funded from liquid assets at purchase time. The work also
introduces a list-based events architecture that future life-event variants
can plug into without further schema churn, and brings the architecture doc
back in sync with the schema.

## Architecture decision: list-based events

Past life events were modelled as flat scalar fields on `PlanInputs`
(e.g. `windfallAmount` + `windfallYear`). That works for one-off scalar
events but doesn't scale to multi-row events like "I'm planning two
investment property purchases over the next decade".

We add a new optional `events: LifeEvent[]` field on `PlanInputs`, where
`LifeEvent` is a Zod discriminated union keyed by `type`. The first variant
is `RealEstateInvestmentEvent`. Future variants (e.g. `LifeEventChildBirth`,
`LifeEventCareerChange`) drop in by adding a new schema to
`LifeEventSchema` and a new card to the form.

The existing `windfall*` fields stay where they are — moving them would be a
data migration with no user-facing benefit.

## Plan

### 1. Schema (`packages/core/src/planInputs.ts`)

- New `RealEstateInvestmentEventSchema` with fields:
  - `id: z.string().min(1)` (stable uuid)
  - `type: z.literal("realEstateInvestment")`
  - `purchaseAmount`, `purchaseYear`
  - `appreciationRate` (bounded by `MIN/MAX_APPRECIATION`)
  - `annualRentalIncome`, `rentalIncomeRate`
- New `LifeEventSchema = z.discriminatedUnion("type", [...])`.
- Add `events: z.array(LifeEventSchema)` to `PlanInputsSchema`.
- Add `events: []` to `DEFAULT_PLAN_INPUTS`.
- Export `makeDefaultRealEstateInvestment()` factory (uuid id, year+5,
  zero monetary fields, 2% rates).

### 2. Engine (`packages/core/src/projection.ts`)

Mirror the residence + rental compounding pattern for each event:

- Pre-loop: collect `RealEstateInvestmentEvent`s, seed a
  `Map<id, { value, rental }>` at `{0, 0}`.
- Inside `if (i > 0)` block, top of iteration:
  - If `t === purchaseYear`: seed `state.value = purchaseAmount * inflator`,
    `state.rental = annualRentalIncome * inflator`.
  - If `t > purchaseYear`: `state.value *= 1 + appreciationRate`,
    `state.rental *= 1 + rentalIncomeRate`.
  - If `t >= purchaseYear`: add `state.rental` to `reInvestmentRental`.
- Include `reInvestmentRental` in `netFlow`.
- At year-end (alongside the windfall block), if `t === purchaseYear`,
  deduct `purchaseAmount * inflator` from `assets`.
- After the per-year block: sum every `state.value` into `realEstate` so
  the property bucket reflects all active investments.

This keeps the existing semantics for `primaryResidenceValue`,
`otherPropertyValue`, and the windfall, while adding the new behavior on
top without touching their math.

### 3. Form (`app/src/features/planner/PlannerForm.tsx`)

Inside the existing Life Events `CollapsibleCategory`:

- Below the windfall fields, render a list of `RealEstateInvestmentCard`
  components (one per event in `value.events`).
- Each card has: Purchase amount (CurrencyField), Purchase year
  (SliderRow), Annual rental income (CurrencyField), Rental income annual
  appreciation (SliderRow), Annual appreciation rate (SliderRow), and a
  Remove button.
- Below the list: an "Add Real Estate Investment" button that calls
  `makeDefaultRealEstateInvestment()` and appends it to `events`.
- Helpers `updateEvent(id, patch)` and `removeEvent(id)` keep the
  `onChange(...)` immutability story consistent with `update(key, value)`.
- Extend `summarizeLifeEvents` so the collapsed pill shows
  `Windfall ... · N real estate investments` when both are present.

### 4. Storage (`app/src/features/planner/storage.ts`)

- Legacy plans (saved before `events` existed) hydrate to `events: []` via
  the existing `{ ...DEFAULT_PLAN_INPUTS, ...parsed }` spread.
- Validate `parsed.events` through `z.array(LifeEventSchema).safeParse(...)`
  on load; fall back to `[]` if it fails (without discarding other valid
  fields).

### 5. Tests

- `planInputs.test.ts`: schema acceptance, missing/malformed event fields,
  discriminator rejection, factory uniqueness.
- `projection.test.ts`: empty events no-op, pre/at/post purchase year
  behavior, appreciation + rental compounding, inflation inflator,
  multiple stacking events, out-of-horizon events, bucket invariant,
  immutability.
- `PlannerForm.test.tsx`: empty state, add card, edit one card without
  affecting siblings, remove a specific card, summary count.
- `storage.test.ts`: legacy hydration, valid round-trip, malformed-events
  fallback preserves other fields.

### 6. Documentation

- `docs/architecture.md` §4.1: backfill six previously-missing schema
  fields (`debtInterestRate`, `debtRepaymentType`, `debtEndYear`,
  `retirementAge`, `nonLiquidLiquidityYear`, `otherFixedLiquidityYear`)
  and add the new `events` row + a `RealEstateInvestmentEvent` sub-table.
- Regenerate `docs/architecture.pdf` and `docs/architecture.html` via
  `npm run docs:build`; commit all three files together.
- Archive this plan under `docs/plans/2026-04-25-...md` and bump the
  count + add the index entry in `docs/plans/README.md`.

### 7. Workflow rule

Add `.cursor/rules/documentation.mdc` (`alwaysApply: true`) requiring a
doc-freshness audit on every PR — covers schema, public API, env, routes,
stack, milestone, and the plan-archive step.

### 8. Verify

- `npm run lint`, `npm run typecheck`, full test suite via `npm test`.
- Pause for manual verification in `npm run dev` per workflow rule.
