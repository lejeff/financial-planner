import { z } from "zod";

// Bounds for appreciation and horizon are part of the domain contract and are
// shared by UI sliders (app/src/features/planner/PlannerForm.tsx), the
// deterministic projection (projection.ts), and the Zod validator below.
export const MIN_HORIZON_YEARS = 10;
export const MAX_HORIZON_YEARS = 80;
export const MIN_APPRECIATION = -0.05;
export const MAX_APPRECIATION = 0.1;
export const MIN_DEBT_INTEREST_RATE = 0;
export const MAX_DEBT_INTEREST_RATE = 0.2;
export const MIN_RETIREMENT_AGE = 18;
export const MAX_RETIREMENT_AGE = 100;

export const DEBT_REPAYMENT_TYPES = ["overTime", "inFine"] as const;
export type DebtRepaymentType = (typeof DEBT_REPAYMENT_TYPES)[number];

// Discriminated union of life-event variants. Each variant carries a stable
// `id` (uuid) so the form can edit/remove a specific entry across renders,
// and a `type` literal that the projection engine and the form switch on.
// New variants drop in by adding another schema to LifeEventSchema below.
export const RealEstateInvestmentEventSchema = z.object({
  id: z.string().min(1),
  type: z.literal("realEstateInvestment"),
  // User-customizable display label for the card legend. Empty string
  // means "use the auto-numbered default" (e.g. `Real Estate Investment 1`)
  // computed by the form. Stored on the schema so custom names round-trip
  // through localStorage. Default `""` keeps legacy stored events working.
  label: z.string().default(""),
  purchaseAmount: z.number().finite().nonnegative(),
  purchaseYear: z.number().int(),
  appreciationRate: z
    .number()
    .finite()
    .min(MIN_APPRECIATION)
    .max(MAX_APPRECIATION),
  annualRentalIncome: z.number().finite().nonnegative(),
  rentalIncomeRate: z
    .number()
    .finite()
    .min(MIN_APPRECIATION)
    .max(MAX_APPRECIATION),
  // When true, today's-money inputs (`purchaseAmount` + `annualRentalIncome`)
  // are inflated to the purchase year before the engine uses them — same
  // convention as windfall and new-debt principal. When false, the
  // nominal entered values land as-is at the purchase year (the user is
  // already entering future-year nominal numbers). Defaults to true so
  // legacy stored events without this field migrate to the historical
  // inflate-to-landing-year behavior on load.
  inflateAmount: z.boolean().default(true)
});

export type RealEstateInvestmentEvent = z.infer<
  typeof RealEstateInvestmentEventSchema
>;

// One-off cash deposit landing in the liquid portfolio at year-end of a
// chosen calendar year. The amount is entered in today's money and the
// engine inflates it to the landing year, mirroring the convention used by
// RealEstateInvestmentEvent's purchase amount.
export const WindfallEventSchema = z.object({
  id: z.string().min(1),
  type: z.literal("windfall"),
  // User-customizable display label for the card legend. Empty string
  // means "use the auto-numbered default" (e.g. `Windfall 1`) computed
  // by the form. Stored on the schema so custom names round-trip through
  // localStorage. Default `""` keeps legacy stored events working.
  label: z.string().default(""),
  amount: z.number().finite().nonnegative(),
  year: z.number().int(),
  // When true, the today's-money `amount` is inflated to the landing year
  // before being deposited into liquid (current convention). When false,
  // the nominal `amount` lands as-is in the landing year (the user is
  // already entering a future-year nominal value). Defaults to true so
  // legacy stored events without this field migrate to the historical
  // inflate-to-landing-year behavior on load.
  inflateAmount: z.boolean().default(true)
});

export type WindfallEvent = z.infer<typeof WindfallEventSchema>;

// A future loan: at `startYear` the engine deposits `principal` (in today's
// money, inflated to the landing year — same convention as windfall and RE
// purchase) into the liquid portfolio and starts amortizing on its own
// schedule until `endYear`. Mirrors the existing top-level Debt fields
// (`startDebt`, `debtInterestRate`, `debtRepaymentType`, `debtEndYear`)
// but adds a `startYear` so multiple future loans can be stacked, each
// active on its own window.
export const NewDebtEventSchema = z.object({
  id: z.string().min(1),
  type: z.literal("newDebt"),
  // User-customizable display label for the card legend. Empty string
  // means "use the auto-numbered default" (e.g. `New Debt 1`) computed
  // by the form. Stored on the schema so custom names round-trip through
  // localStorage. Default `""` keeps legacy stored events working.
  label: z.string().default(""),
  principal: z.number().finite().nonnegative(),
  interestRate: z
    .number()
    .finite()
    .min(MIN_DEBT_INTEREST_RATE)
    .max(MAX_DEBT_INTEREST_RATE),
  repaymentType: z.enum(DEBT_REPAYMENT_TYPES),
  startYear: z.number().int(),
  endYear: z.number().int(),
  // When true, the today's-money `principal` is inflated to `startYear`
  // before being disbursed and amortized (current convention, mirrors
  // windfall and RE purchase). When false, the nominal `principal` is
  // disbursed as-is at `startYear`. Defaults to true so legacy stored
  // events without this field migrate to the historical
  // inflate-to-landing-year behavior on load.
  inflateAmount: z.boolean().default(true)
});

export type NewDebtEvent = z.infer<typeof NewDebtEventSchema>;

export const LifeEventSchema = z.discriminatedUnion("type", [
  RealEstateInvestmentEventSchema,
  WindfallEventSchema,
  NewDebtEventSchema
]);

export type LifeEvent = z.infer<typeof LifeEventSchema>;

// A property the user owns today: a value (in today's money), an annual
// appreciation rate, and an optional rental stream with its own annual
// growth rate. Compounds in the projection from year 0; no purchase
// deduction (these are owned now). Rental flows into liquid each year
// (today's-money input, compounds at `rentalIncomeRate` from year 1 on),
// matching the wiring on RealEstateInvestmentEvent. The form lets the
// user stack 0..N of these as cards; each carries a stable uuid so edits
// and removals survive re-renders.
export const RealEstateHoldingSchema = z.object({
  id: z.string().min(1),
  type: z.literal("realEstateHolding"),
  // User-customizable display label for the card legend. Empty string
  // means "use the auto-numbered default" (e.g. `Real Estate 1`) computed
  // by the form. Stored on the schema so custom names round-trip through
  // localStorage. Default `""` keeps legacy stored holdings working.
  label: z.string().default(""),
  value: z.number().finite().nonnegative(),
  appreciationRate: z
    .number()
    .finite()
    .min(MIN_APPRECIATION)
    .max(MAX_APPRECIATION),
  annualRentalIncome: z.number().finite().nonnegative(),
  rentalIncomeRate: z
    .number()
    .finite()
    .min(MIN_APPRECIATION)
    .max(MAX_APPRECIATION)
});

export type RealEstateHolding = z.infer<typeof RealEstateHoldingSchema>;

export const PlanInputsSchema = z.object({
  name: z.string(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD"),
  startAssets: z.number().finite().nonnegative(),
  startDebt: z.number().finite().nonnegative(),
  debtInterestRate: z
    .number()
    .finite()
    .min(MIN_DEBT_INTEREST_RATE)
    .max(MAX_DEBT_INTEREST_RATE),
  debtRepaymentType: z.enum(DEBT_REPAYMENT_TYPES),
  debtEndYear: z.number().int(),
  monthlySpending: z.number().finite().nonnegative(),
  annualIncome: z.number().finite().nonnegative(),
  retirementAge: z.number().int().min(MIN_RETIREMENT_AGE).max(MAX_RETIREMENT_AGE),
  nominalReturn: z.number().finite().min(-0.5).max(0.5),
  inflationRate: z.number().finite().min(-0.05).max(0.15),
  horizonYears: z.number().int().min(MIN_HORIZON_YEARS).max(MAX_HORIZON_YEARS),
  cashBalance: z.number().finite().nonnegative(),
  nonLiquidInvestments: z.number().finite().nonnegative(),
  otherFixedAssets: z.number().finite().nonnegative(),
  // Year at which each non-liquid asset is expected to become liquid; on
  // that year the projection moves the asset's value into the liquid
  // portfolio so it begins compounding at the expected return.
  nonLiquidLiquidityYear: z.number().int(),
  otherFixedLiquidityYear: z.number().int(),
  // Stackable list of currently-owned real-estate holdings. Each entry
  // compounds at its own appreciation rate from year 0; the engine sums
  // them into the `realEstate` bucket alongside any RealEstateInvestmentEvent
  // values from `events`. Empty array means no held real estate.
  realEstateHoldings: z.array(RealEstateHoldingSchema),
  // Ordered list of life events. See LifeEventSchema for the union of
  // supported variants. Empty array means no scheduled events.
  events: z.array(LifeEventSchema)
});

export type PlanInputs = z.infer<typeof PlanInputsSchema>;

export type ProjectionPoint = {
  year: number;
  age: number;
  netWorth: number;
  liquid: number;
  savings: number;
  otherAssets: number;
  realEstate: number;
  debt: number;
};

// Computed at module load: a fresh planner session starts with the user 40
// years old today (a sensible neutral midpoint) and every monetary/rate field
// at 0 so the form reads as a blank slate. The loan end year defaults to
// currentYear + 5 (a reasonable mid-term target users can adjust via the
// slider); liquidity-year fields stay at the current year (the "already
// liquid" baseline). retirementAge stays at 65 and horizonYears stays at 30
// (the schema enforces a minimum of 10). Windfalls and other life events
// default to empty arrays so the Life Events section reads as a blank slate.
function defaultDateOfBirth(): string {
  const now = new Date();
  const y = now.getFullYear() - 40;
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Every rate field defaults to 2% as a neutral starting point that is more
// useful in the chart than a flat zero (which would render the projection as
// a horizontal line).
const DEFAULT_RATE = 0.02;

export const DEFAULT_PLAN_INPUTS: PlanInputs = {
  name: "",
  dateOfBirth: defaultDateOfBirth(),
  startAssets: 10_000,
  startDebt: 0,
  debtInterestRate: DEFAULT_RATE,
  debtRepaymentType: "overTime",
  debtEndYear: new Date().getFullYear() + 5,
  monthlySpending: 0,
  annualIncome: 0,
  retirementAge: 65,
  nominalReturn: 0.05,
  inflationRate: DEFAULT_RATE,
  horizonYears: 30,
  cashBalance: 0,
  nonLiquidInvestments: 0,
  otherFixedAssets: 0,
  nonLiquidLiquidityYear: new Date().getFullYear(),
  otherFixedLiquidityYear: new Date().getFullYear(),
  realEstateHoldings: [],
  events: []
};

// Factory for a fresh real estate investment event with sensible defaults:
// purchase year five years out (matches windfall/loan defaults) and zero
// monetary fields + zero rates so the card reads as a blank slate the user
// fills in deliberately. The id is a uuid so it survives reorders and
// re-renders.
export function makeDefaultRealEstateInvestment(): RealEstateInvestmentEvent {
  return {
    id: crypto.randomUUID(),
    type: "realEstateInvestment",
    label: "",
    purchaseAmount: 0,
    purchaseYear: new Date().getFullYear() + 5,
    appreciationRate: 0,
    annualRentalIncome: 0,
    rentalIncomeRate: 0,
    inflateAmount: true
  };
}

// Factory for a fresh real-estate holding with every monetary and rate
// field zeroed out so a freshly-added card reads as a blank slate the
// user fills in deliberately. The id is a uuid so it survives reorders
// and re-renders, mirroring `makeDefaultRealEstateInvestment`.
export function makeDefaultRealEstateHolding(): RealEstateHolding {
  return {
    id: crypto.randomUUID(),
    type: "realEstateHolding",
    label: "",
    value: 0,
    appreciationRate: 0,
    annualRentalIncome: 0,
    rentalIncomeRate: 0
  };
}

// Factory for a fresh windfall event with a zero amount and a year five
// years from now (matches the historical default of the old single-windfall
// scalar so the slider lands in a familiar mid-term spot). The id is a uuid
// so it survives reorders and re-renders.
export function makeDefaultWindfallEvent(): WindfallEvent {
  return {
    id: crypto.randomUUID(),
    type: "windfall",
    label: "",
    amount: 0,
    year: new Date().getFullYear() + 5,
    inflateAmount: true
  };
}

// Factory for a fresh new-debt life event with zero principal, a 2% rate,
// `overTime` repayment, and a 5-year window starting 5 years out (currentYear
// + 5 → currentYear + 10). Defaults mirror the existing top-level Debt
// defaults so a freshly-added card reads as a familiar blank loan the user
// fills in deliberately. The id is a uuid so it survives reorders and
// re-renders.
export function makeDefaultNewDebtEvent(): NewDebtEvent {
  const currentYear = new Date().getFullYear();
  return {
    id: crypto.randomUUID(),
    type: "newDebt",
    label: "",
    principal: 0,
    interestRate: DEFAULT_RATE,
    repaymentType: "overTime",
    startYear: currentYear + 5,
    endYear: currentYear + 10,
    inflateAmount: true
  };
}
