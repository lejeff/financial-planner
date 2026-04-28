import type {
  PlanInputs,
  ProjectionPoint,
  RealEstateInvestmentEvent
} from "./planInputs";

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
 * Sum the user's reported balance-sheet today: every asset bucket minus
 * outstanding debt. We compute this directly from inputs (rather than reading
 * `points[0].netWorth`) so it stays correct when `debtEndYear <= startYear`,
 * since the projection treats already-due loans as settled at year 0.
 */
export function computeCurrentNetWorth(input: PlanInputs): number {
  const holdingsTotal = input.realEstateHoldings.reduce(
    (sum, h) => sum + h.value,
    0
  );
  return (
    input.startAssets +
    input.cashBalance +
    input.nonLiquidInvestments +
    input.otherFixedAssets +
    holdingsTotal -
    input.startDebt
  );
}

/**
 * Annual cash-flow ratio: the share of total inflows left after recurring
 * spending, expressed as a fraction.
 *
 *   inflows  = annualIncome + rentalIncome + startAssets * nominalReturn
 *   outflows = monthlySpending * 12
 *   ratio    = (inflows - outflows) / inflows
 *
 * `startAssets * nominalReturn` is a year-1 estimate of portfolio earnings;
 * cashBalance is excluded because it does not compound in the projection. We
 * intentionally leave debt servicing out — this ratio answers "how much of
 * your gross cash flow is left over after living costs?", not "how much
 * truly free cash do you have?". Returns null when total inflows are zero
 * (so the UI can render a placeholder instead of dividing by zero). A
 * negative value means recurring expenses exceed inflows, which is
 * meaningful information to surface.
 */
export function computeAnnualCashFlowRatio(input: PlanInputs): number | null {
  const portfolioEarnings = input.startAssets * input.nominalReturn;
  const inflows = input.annualIncome + input.rentalIncome + portfolioEarnings;
  if (inflows <= 0) return null;
  const outflows = input.monthlySpending * 12;
  return (inflows - outflows) / inflows;
}

/**
 * Real (inflation-adjusted) compounded annual growth rate between two
 * real-money endpoints. Returns null when either endpoint is non-positive or
 * the horizon is zero, since CAGR is undefined in those cases.
 */
export function computeRealCAGR(
  startNetWorth: number,
  endRealNetWorth: number,
  years: number
): number | null {
  if (years <= 0 || startNetWorth <= 0 || endRealNetWorth <= 0) return null;
  return (endRealNetWorth / startNetWorth) ** (1 / years) - 1;
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
  const startYear = now.getFullYear();

  // Non-liquid assets transfer into the liquid portfolio at their
  // configured liquidity year. If the liquidity year is at or before the
  // projection start, we treat them as already liquid at year 0 (mirrors
  // the same convention used for `debtEndYear <= startYear`). Once
  // transferred, the value compounds at `nominalReturn` from then on.
  let nonLiquid =
    input.nonLiquidLiquidityYear > startYear ? input.nonLiquidInvestments : 0;
  let otherFixed =
    input.otherFixedLiquidityYear > startYear ? input.otherFixedAssets : 0;
  const nonLiquidStartInLiquid =
    input.nonLiquidLiquidityYear <= startYear ? input.nonLiquidInvestments : 0;
  const otherFixedStartInLiquid =
    input.otherFixedLiquidityYear <= startYear ? input.otherFixedAssets : 0;

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

  let assets = input.startAssets + nonLiquidStartInLiquid + otherFixedStartInLiquid;
  let cash = input.cashBalance;
  let rental = input.rentalIncome;

  // Currently-owned real-estate holdings: each compounds at its own
  // appreciation rate from year 0. The map keys on holding.id so multiple
  // holdings stack independently and edits/removals in the form survive
  // without disturbing the others. No purchase deduction (these are owned
  // today) and no rental contribution — rental flows belong to the
  // RealEstateInvestmentEvent variant below.
  const holdingStates = new Map<string, { value: number; rate: number }>();
  for (const holding of input.realEstateHoldings) {
    holdingStates.set(holding.id, {
      value: holding.value,
      rate: holding.appreciationRate
    });
  }

  // Real estate investment events: dormant before their purchase year, then
  // behave like a held property + rentalIncome (compounding value, rental
  // flowing into netFlow). Each event carries its own running { value,
  // rental } in nominal currency. The map keys on event.id so multiple
  // events stack independently.
  const reInvestmentEvents: RealEstateInvestmentEvent[] = input.events.filter(
    (e): e is RealEstateInvestmentEvent => e.type === "realEstateInvestment"
  );
  const reInvestmentStates = new Map<string, { value: number; rental: number }>();
  for (const event of reInvestmentEvents) {
    reInvestmentStates.set(event.id, { value: 0, rental: 0 });
  }

  const points: ProjectionPoint[] = [];

  for (let i = 0; i <= years; i += 1) {
    if (i > 0) {
      for (const state of holdingStates.values()) {
        state.value *= 1 + state.rate;
      }
      rental *= 1 + input.rentalIncomeRate;

      // Salary and recurring expenses are entered in today's money but the
      // projection is nominal, so inflate them to the current year's value.
      // Salary stops the year the user reaches retirementAge (i.e. the first
      // year `yearAge >= retirementAge`).
      const yearAge = currentAge + i;
      const inflator = (1 + input.inflationRate) ** i;

      // Real estate investment events: at the purchase year, seed the
      // event's value/rental buckets at nominal-at-purchase-year (today's
      // money inflated to the landing year, mirroring the windfall
      // convention). After the purchase year, compound both at the
      // per-event rates. Active rentals contribute to netFlow below; the
      // purchase amount is deducted from the liquid portfolio at year-end,
      // mirroring how a one-off windfall is added.
      let reInvestmentRental = 0;
      for (const event of reInvestmentEvents) {
        const state = reInvestmentStates.get(event.id)!;
        if (startYear + i === event.purchaseYear) {
          state.value = event.purchaseAmount * inflator;
          state.rental = event.annualRentalIncome * inflator;
        } else if (startYear + i > event.purchaseYear) {
          state.value *= 1 + event.appreciationRate;
          state.rental *= 1 + event.rentalIncomeRate;
        }
        if (startYear + i >= event.purchaseYear) {
          reInvestmentRental += state.rental;
        }
      }
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
      const netFlow =
        salaryNominal + rental + reInvestmentRental - spendingNominal - debtCashOut;

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

      // Non-liquid assets become liquid at their configured year. Transfer
      // the entered nominal value (no inflator — non-liquid assets are
      // held statically, matching how they accumulate before this point).
      if (startYear + i === input.nonLiquidLiquidityYear && nonLiquid > 0) {
        assets += nonLiquid;
        nonLiquid = 0;
      }
      if (startYear + i === input.otherFixedLiquidityYear && otherFixed > 0) {
        assets += otherFixed;
        otherFixed = 0;
      }

      // Real estate investment purchase: deduct the today's-money amount,
      // inflated to the landing year, from the liquid portfolio at
      // year-end. The matching property value/rental were already seeded
      // into the event's bucket at the top of this iteration.
      for (const event of reInvestmentEvents) {
        if (startYear + i === event.purchaseYear && event.purchaseAmount > 0) {
          assets -= event.purchaseAmount * inflator;
        }
      }
    }

    let reInvestmentValue = 0;
    for (const state of reInvestmentStates.values()) {
      reInvestmentValue += state.value;
    }
    let holdingsValue = 0;
    for (const state of holdingStates.values()) {
      holdingsValue += state.value;
    }
    const savings = assets + cash;
    const otherAssets = nonLiquid + otherFixed;
    const realEstate = holdingsValue + reInvestmentValue;
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
