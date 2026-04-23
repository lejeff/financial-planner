import type { PlanInputs, ProjectionPoint } from "./types";

export const MIN_HORIZON_YEARS = 10;
export const MAX_HORIZON_YEARS = 80;

export const MIN_APPRECIATION = -0.05;
export const MAX_APPRECIATION = 0.1;

export function ageFromDob(dateOfBirth: string, now: Date = new Date()): number {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return 0;
  let age = now.getFullYear() - dob.getFullYear();
  const hadBirthdayThisYear =
    now.getMonth() > dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return Math.max(0, age);
}

export function clampHorizon(horizonYears: number): number {
  if (!Number.isFinite(horizonYears)) return MIN_HORIZON_YEARS;
  return Math.min(Math.max(Math.round(horizonYears), MIN_HORIZON_YEARS), MAX_HORIZON_YEARS);
}

export function projectNetWorth(input: PlanInputs, now: Date = new Date()): ProjectionPoint[] {
  const currentAge = ageFromDob(input.dateOfBirth, now);
  const years = clampHorizon(input.horizonYears);
  const debt = input.startDebt;
  const nonLiquid = input.nonLiquidInvestments;
  const otherFixed = input.otherFixedAssets;
  const startYear = now.getFullYear();

  let assets = input.startAssets;
  let cash = input.cashBalance;
  let residence = input.primaryResidenceValue;
  let otherProp = input.otherPropertyValue;
  let rental = input.rentalIncome;

  const points: ProjectionPoint[] = [];

  for (let i = 0; i <= years; i += 1) {
    if (i > 0) {
      residence *= 1 + input.primaryResidenceRate;
      otherProp *= 1 + input.otherPropertyRate;
      rental *= 1 + input.rentalIncomeRate;

      // Salary and recurring expenses are entered in today's money but the
      // projection is nominal, so inflate them to the current year's value.
      const inflator = (1 + input.inflationRate) ** i;
      const salaryNominal = input.annualIncome * inflator;
      const spendingNominal = input.monthlySpending * 12 * inflator;

      const afterReturn = assets * (1 + input.nominalReturn);
      const netFlow = salaryNominal + rental - spendingNominal;

      if (netFlow >= 0) {
        assets = afterReturn + netFlow;
      } else {
        const shortfall = -netFlow;
        const fromCash = Math.min(cash, shortfall);
        cash -= fromCash;
        assets = afterReturn - (shortfall - fromCash);
      }

      // One-off windfall lands in the investment portfolio at year-end of the
      // matching calendar year, so it starts compounding from the following year.
      // The amount is entered in today's money, so inflate it to the landing year.
      if (startYear + i === input.windfallYear && input.windfallAmount > 0) {
        assets += input.windfallAmount * inflator;
      }
    }

    points.push({
      year: startYear + i,
      age: currentAge + i,
      netWorth: residence + otherProp + cash + assets + nonLiquid + otherFixed - debt,
      liquid: assets + cash
    });
  }

  return points;
}

/**
 * Convert a nominal projection to real (today's-money) terms by deflating each
 * point's monetary fields by (1 + inflationRate) raised to the years-from-start.
 */
export function deflateToToday(
  points: ProjectionPoint[],
  inflationRate: number,
  startYear: number
): ProjectionPoint[] {
  if (inflationRate === 0) return points;
  return points.map((p) => {
    const divisor = (1 + inflationRate) ** (p.year - startYear);
    return {
      ...p,
      netWorth: p.netWorth / divisor,
      liquid: p.liquid / divisor
    };
  });
}
