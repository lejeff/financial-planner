import type { PlanInputs, ProjectionPoint } from "./planInputs";

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

export function clampHorizon(horizonYears: number, min = 10, max = 80): number {
  if (!Number.isFinite(horizonYears)) return min;
  return Math.min(Math.max(Math.round(horizonYears), min), max);
}

/**
 * Closed-form annual payment for a fixed-rate amortizing loan that fully
 * repays principal `P` over `n` payments at annual rate `r`. Returns 0 when
 * the loan is already fully paid (P=0 or n<=0). Falls back to a linear
 * principal split when r=0.
 */
export function computeOverTimeAnnualPayment(P: number, r: number, n: number): number {
  if (P <= 0 || n <= 0) return 0;
  if (r === 0) return P / n;
  return (P * r) / (1 - (1 + r) ** -n);
}

export function projectNetWorth(input: PlanInputs, now: Date = new Date()): ProjectionPoint[] {
  const currentAge = ageFromDob(input.dateOfBirth, now);
  const years = clampHorizon(input.horizonYears);
  const nonLiquid = input.nonLiquidInvestments;
  const otherFixed = input.otherFixedAssets;
  const startYear = now.getFullYear();

  // Debt is modeled as a fixed-rate loan with a `currently outstanding`
  // balance entered as `startDebt`. Payments are nominal (the loan contract
  // doesn't get inflated), so we don't apply the inflator to them.
  const debtRate = input.debtInterestRate;
  const debtEndYear = input.debtEndYear;
  const remainingTerm = Math.max(0, debtEndYear - startYear);
  const overTimeAnnualPayment =
    input.debtRepaymentType === "overTime"
      ? computeOverTimeAnnualPayment(input.startDebt, debtRate, remainingTerm)
      : 0;
  // If the schedule already ended (or no principal), the loan is treated as
  // settled from year 0; otherwise we carry the entered balance forward.
  let debtBalance = remainingTerm > 0 && input.startDebt > 0 ? input.startDebt : 0;

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
      // Salary stops the year the user reaches retirementAge (i.e. the first
      // year `yearAge >= retirementAge`).
      const yearAge = currentAge + i;
      const inflator = (1 + input.inflationRate) ** i;
      const salaryNominal =
        yearAge < input.retirementAge ? input.annualIncome * inflator : 0;
      const spendingNominal = input.monthlySpending * 12 * inflator;

      const year = startYear + i;
      let debtCashOut = 0;
      if (debtBalance > 0) {
        if (input.debtRepaymentType === "overTime") {
          if (year <= debtEndYear) {
            const interest = debtBalance * debtRate;
            const principal = Math.min(
              Math.max(overTimeAnnualPayment - interest, 0),
              debtBalance
            );
            debtCashOut = interest + principal;
            debtBalance -= principal;
            if (debtBalance < 1e-6) debtBalance = 0;
          }
        } else {
          // inFine: interest-only each year, full principal due at debtEndYear.
          if (year < debtEndYear) {
            debtCashOut = debtBalance * debtRate;
          } else if (year === debtEndYear) {
            debtCashOut = debtBalance * debtRate + debtBalance;
            debtBalance = 0;
          }
        }
      }

      const afterReturn = assets * (1 + input.nominalReturn);
      const netFlow = salaryNominal + rental - spendingNominal - debtCashOut;

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

    const savings = assets + cash;
    const otherAssets = nonLiquid + otherFixed;
    const realEstate = residence + otherProp;
    points.push({
      year: startYear + i,
      age: currentAge + i,
      netWorth: realEstate + savings + otherAssets - debtBalance,
      liquid: assets + cash,
      savings,
      otherAssets,
      realEstate,
      debt: debtBalance
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
      liquid: p.liquid / divisor,
      savings: p.savings / divisor,
      otherAssets: p.otherAssets / divisor,
      realEstate: p.realEstate / divisor,
      debt: p.debt / divisor
    };
  });
}
