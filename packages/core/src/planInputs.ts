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
    .max(MAX_APPRECIATION)
});

export type RealEstateInvestmentEvent = z.infer<
  typeof RealEstateInvestmentEventSchema
>;

export const LifeEventSchema = z.discriminatedUnion("type", [
  RealEstateInvestmentEventSchema
]);

export type LifeEvent = z.infer<typeof LifeEventSchema>;

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
  rentalIncome: z.number().finite().nonnegative(),
  rentalIncomeRate: z.number().finite().min(MIN_APPRECIATION).max(MAX_APPRECIATION),
  windfallAmount: z.number().finite().nonnegative(),
  windfallYear: z.number().int(),
  nominalReturn: z.number().finite().min(-0.5).max(0.5),
  inflationRate: z.number().finite().min(-0.05).max(0.15),
  horizonYears: z.number().int().min(MIN_HORIZON_YEARS).max(MAX_HORIZON_YEARS),
  cashBalance: z.number().finite().nonnegative(),
  nonLiquidInvestments: z.number().finite().nonnegative(),
  otherFixedAssets: z.number().finite().nonnegative(),
  primaryResidenceValue: z.number().finite().nonnegative(),
  otherPropertyValue: z.number().finite().nonnegative(),
  primaryResidenceRate: z.number().finite().min(MIN_APPRECIATION).max(MAX_APPRECIATION),
  otherPropertyRate: z.number().finite().min(MIN_APPRECIATION).max(MAX_APPRECIATION),
  // Year at which each non-liquid asset is expected to become liquid; on
  // that year the projection moves the asset's value into the liquid
  // portfolio so it begins compounding at the expected return.
  nonLiquidLiquidityYear: z.number().int(),
  otherFixedLiquidityYear: z.number().int(),
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
// at 0 so the form reads as a blank slate. Loan end year and windfall year
// default to currentYear + 5 (a reasonable mid-term target users can adjust
// via the slider); liquidity-year fields stay at the current year (the
// "already liquid" baseline). retirementAge stays at 65 and horizonYears
// stays at 30 (the schema enforces a minimum of 10).
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
  rentalIncome: 0,
  rentalIncomeRate: DEFAULT_RATE,
  windfallAmount: 0,
  windfallYear: new Date().getFullYear() + 5,
  nominalReturn: 0.05,
  inflationRate: DEFAULT_RATE,
  horizonYears: 30,
  cashBalance: 0,
  nonLiquidInvestments: 0,
  otherFixedAssets: 0,
  primaryResidenceValue: 0,
  otherPropertyValue: 0,
  primaryResidenceRate: DEFAULT_RATE,
  otherPropertyRate: DEFAULT_RATE,
  nonLiquidLiquidityYear: new Date().getFullYear(),
  otherFixedLiquidityYear: new Date().getFullYear(),
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
    purchaseAmount: 0,
    purchaseYear: new Date().getFullYear() + 5,
    appreciationRate: 0,
    annualRentalIncome: 0,
    rentalIncomeRate: 0
  };
}
