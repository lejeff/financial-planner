---
name: Horizon Variable And Tests
overview: Add a user-controlled projection horizon (10-80 years) with a slider, replacing the hardcoded age-95 endpoint, and expand the unit tests to cover multi-year recurrence, the new horizon variable, and key edge cases.
todos:
  - id: horizon-types
    content: Add horizonYears to PlanInputs + DEFAULT_PLAN_INPUTS; export MIN/MAX horizon constants from calculator.ts and use them in projectNetWorth.
    status: completed
  - id: horizon-ui
    content: Add horizon slider to PlannerForm and update summary card in PlannerPage to reflect dynamic end age.
    status: completed
  - id: expand-calc-tests
    content: Expand calculator.test.ts with closed-form, zero/negative return, horizon length/clamp/monotonicity, year labels, and purity tests.
    status: completed
  - id: storage-tests
    content: Add storage.test.ts verifying that loading partial saved payloads merges defaults for new fields.
    status: completed
  - id: full-validate
    content: Run lint, typecheck, tests, and build; manually verify slider behavior and dynamic summary card in the browser.
    status: completed
isProject: false
---

# Add Projection Horizon Variable + Expand Calculator Tests

## Part 1: Projection Horizon as a User Variable

### Type changes

In `[app/src/features/planner/types.ts](app/src/features/planner/types.ts)`:

- Add `horizonYears: number` to `PlanInputs`.
- Default it in `DEFAULT_PLAN_INPUTS` to `30`.

```ts
export type PlanInputs = {
  name: string;
  dateOfBirth: string;
  startAssets: number;
  startDebt: number;
  monthlySpending: number;
  annualIncome: number;
  nominalReturn: number;
  horizonYears: number;
};
```

### Calculator changes

In `[app/src/features/planner/calculator.ts](app/src/features/planner/calculator.ts)`:

- Remove the hardcoded `PROJECTION_END_AGE = 95`.
- Replace with bounds constants exported for reuse:

```ts
export const MIN_HORIZON_YEARS = 10;
export const MAX_HORIZON_YEARS = 80;
```

- `projectNetWorth` uses `input.horizonYears` (clamped to `[MIN_HORIZON_YEARS, MAX_HORIZON_YEARS]`) as the number of years to project:

```ts
const years = Math.min(
  Math.max(input.horizonYears, MIN_HORIZON_YEARS),
  MAX_HORIZON_YEARS
);
```

- Loop runs `i = 0..years` inclusive → produces `years + 1` points.

### UI changes

In `[app/src/features/planner/PlannerForm.tsx](app/src/features/planner/PlannerForm.tsx)`:

- Add a sixth slider for `horizonYears` (min 10, max 80, step 1, format as "NN years").

In `[app/src/features/planner/PlannerPage.tsx](app/src/features/planner/PlannerPage.tsx)`:

- Change the middle summary card label from "Projected net worth at 95" to a dynamic label: `Projected net worth at age ${currentAge + inputs.horizonYears}`.
- The right summary card already reads `projection.length - 1 yrs`, which will now reflect the chosen horizon automatically.

## Part 2: Expanded Unit Tests

All changes in `[app/src/features/planner/calculator.test.ts](app/src/features/planner/calculator.test.ts)`.

### Add a small helper and fixture

At top of the test file:

```ts
const money = (actual: number, expected: number, tolerance = 0.01) =>
  expect(Math.abs(actual - expected)).toBeLessThan(tolerance);

const BASE_INPUTS: PlanInputs = {
  name: "Test",
  dateOfBirth: "1990-01-01",
  startAssets: 100_000,
  startDebt: 0,
  monthlySpending: 1_000,
  annualIncome: 50_000,
  nominalReturn: 0.05,
  horizonYears: 30
};
```

### Keep/update existing tests

- `ageFromDob` tests stay (3 tests).
- Rename the length test and assert against `horizonYears` instead of age 95:
  - "produces `horizonYears + 1` points with correct start/end ages".

### New tests to add

1. Year 10 closed-form:

   ```ts
   it("matches closed-form value at year 10", () => {
     const points = projectNetWorth(BASE_INPUTS, FIXED_NOW);
     const r = BASE_INPUTS.nominalReturn;
     const flow = BASE_INPUTS.annualIncome - BASE_INPUTS.monthlySpending * 12;
     // A_n = A_0 * (1+r)^n + flow * ((1+r)^n - 1) / r
     const n = 10;
     const expected = BASE_INPUTS.startAssets * (1 + r) ** n + (flow * ((1 + r) ** n - 1)) / r;
     money(points[n].netWorth, expected, 0.5);
   });
   ```

2. Zero-return identity (compounding disabled):

   ```ts
   it("changes linearly when return is zero", () => {
     const points = projectNetWorth({ ...BASE_INPUTS, nominalReturn: 0 }, FIXED_NOW);
     const flow = BASE_INPUTS.annualIncome - BASE_INPUTS.monthlySpending * 12;
     expect(points[5].netWorth).toBe(BASE_INPUTS.startAssets + flow * 5);
   });
   ```

3. Negative return compounds a loss:

   ```ts
   it("compounds losses under a negative return", () => {
     const points = projectNetWorth(
       { ...BASE_INPUTS, nominalReturn: -0.1, annualIncome: 0, monthlySpending: 0 },
       FIXED_NOW
     );
     money(points[3].netWorth, BASE_INPUTS.startAssets * 0.9 ** 3, 0.5);
   });
   ```

4. Horizon determines length:

   ```ts
   it.each([10, 30, 80])("produces horizon+1 points for horizon=%i", (h) => {
     const points = projectNetWorth({ ...BASE_INPUTS, horizonYears: h }, FIXED_NOW);
     expect(points).toHaveLength(h + 1);
     expect(points.at(-1)?.age).toBe(points[0].age + h);
   });
   ```

5. Horizon clamps out-of-range input (protects against bad slider state):

   ```ts
   it("clamps horizon to MIN/MAX bounds", () => {
     expect(projectNetWorth({ ...BASE_INPUTS, horizonYears: 0 }, FIXED_NOW)).toHaveLength(MIN_HORIZON_YEARS + 1);
     expect(projectNetWorth({ ...BASE_INPUTS, horizonYears: 999 }, FIXED_NOW)).toHaveLength(MAX_HORIZON_YEARS + 1);
   });
   ```

6. Changing horizon does not change earlier-year values:

   ```ts
   it("does not alter earlier-year values when horizon grows", () => {
     const short = projectNetWorth({ ...BASE_INPUTS, horizonYears: 20 }, FIXED_NOW);
     const long = projectNetWorth({ ...BASE_INPUTS, horizonYears: 50 }, FIXED_NOW);
     for (let i = 0; i <= 20; i += 1) money(long[i].netWorth, short[i].netWorth);
   });
   ```

7. Year labels correctness:

   ```ts
   it("labels years starting from now.getFullYear()", () => {
     const points = projectNetWorth(BASE_INPUTS, FIXED_NOW);
     expect(points[0].year).toBe(2026);
     expect(points[5].year).toBe(2031);
   });
   ```

8. Pure function property (no mutation):

   ```ts
   it("does not mutate its input", () => {
     const input = { ...BASE_INPUTS };
     const snapshot = JSON.stringify(input);
     projectNetWorth(input, FIXED_NOW);
     expect(JSON.stringify(input)).toBe(snapshot);
   });
   ```

### Storage test (small but high-value)

Add `[app/src/features/planner/storage.test.ts](app/src/features/planner/storage.test.ts)` to guard the defaults-merge behavior when new fields (like `horizonYears`) are added to old saved data:

```ts
it("fills missing fields with defaults when loading older payloads", () => {
  const stored = JSON.stringify({ name: "Jeff", startAssets: 50_000 });
  const fakeStorage = { getItem: () => stored, setItem: () => {}, removeItem: () => {} };
  // Inject via a test-only helper or vi.stubGlobal on window.localStorage.
  ...
});
```

This catches the exact bug class that pops up every time you add a new input.

## Validation

Run after changes:

- `npm run typecheck`
- `npm run test`
- `npm run lint`
- `npm run build`

Then visually:

- Horizon slider moves between 10 and 80, chart re-renders with the new number of bars.
- Summary card shows "Projected net worth at age X" with X = currentAge + horizon.
- Refreshing the page preserves horizon value.

## Out of Scope

- Other Excel variables (rentals, inflation, property growth, debt paydown).
- Snapshot/golden tests (can add once more math is in).
- Property-based tests with `fast-check` (defer until we have more invariants).