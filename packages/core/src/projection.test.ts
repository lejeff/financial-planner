import { describe, expect, it } from "vitest";
import {
  MAX_HORIZON_YEARS,
  MAX_RETIREMENT_AGE,
  MIN_HORIZON_YEARS,
  ageFromDob,
  clampHorizon,
  computeAnnualCashFlowRatio,
  computeCurrentNetWorth,
  computeRealCAGR,
  deflateToToday,
  projectNetWorth,
  type PlanInputs,
  type ProjectionPoint,
  type RealEstateHolding,
  type RealEstateInvestmentEvent,
  type WindfallEvent
} from "./index";

const FIXED_NOW = new Date("2026-06-15T00:00:00Z");

const money = (actual: number, expected: number, tolerance = 0.01) => {
  expect(Math.abs(actual - expected)).toBeLessThan(tolerance);
};

// Default debt config = inFine + 0% rate + far-future end year. This makes the
// debt balance behave as a constant subtraction across the horizon (no
// payments, no interest), matching the legacy projection behavior so tests
// that don't care about debt modeling stay valid. Tests that DO exercise the
// schedule override these fields explicitly.
const BASE_INPUTS: PlanInputs = {
  name: "Test",
  dateOfBirth: "1990-01-01",
  startAssets: 100_000,
  startDebt: 0,
  debtInterestRate: 0,
  debtRepaymentType: "inFine",
  debtEndYear: 2200,
  monthlySpending: 1_000,
  annualIncome: 50_000,
  retirementAge: MAX_RETIREMENT_AGE,
  rentalIncome: 0,
  rentalIncomeRate: 0,
  nominalReturn: 0.05,
  inflationRate: 0,
  horizonYears: 30,
  cashBalance: 0,
  nonLiquidInvestments: 0,
  otherFixedAssets: 0,
  // Both default to 2200 so non-liquid balances stay non-liquid throughout
  // the projection horizon and tests that don't care about liquidity timing
  // keep their original behavior. Tests that DO exercise the transfer
  // override these fields explicitly.
  nonLiquidLiquidityYear: 2200,
  otherFixedLiquidityYear: 2200,
  realEstateHoldings: [],
  events: []
};

// Compact factory for real-estate holdings in projection tests. Fixed ids
// (`reh-1`, `reh-2`, ...) so failures point at a specific holding.
let rehCounter = 0;
function makeHolding(
  overrides: Partial<RealEstateHolding> = {}
): RealEstateHolding {
  rehCounter += 1;
  return {
    id: `reh-${rehCounter}`,
    type: "realEstateHolding",
    value: 0,
    appreciationRate: 0,
    annualRentalIncome: 0,
    rentalIncomeRate: 0,
    ...overrides
  };
}

// Compact factory for RE investment events in projection tests. We use
// fixed ids (re-1, re-2, ...) so failures point at a specific event.
let reEventCounter = 0;
function makeReEvent(
  overrides: Partial<RealEstateInvestmentEvent> = {}
): RealEstateInvestmentEvent {
  reEventCounter += 1;
  return {
    id: `re-${reEventCounter}`,
    type: "realEstateInvestment",
    purchaseAmount: 0,
    purchaseYear: 0,
    appreciationRate: 0,
    annualRentalIncome: 0,
    rentalIncomeRate: 0,
    ...overrides
  };
}

// Compact factory for windfall events. Fixed ids (`wf-1`, `wf-2`, ...) so
// failures point at a specific event.
let wfEventCounter = 0;
function makeWindfallEvent(
  overrides: Partial<WindfallEvent> = {}
): WindfallEvent {
  wfEventCounter += 1;
  return {
    id: `wf-${wfEventCounter}`,
    type: "windfall",
    amount: 0,
    year: 0,
    ...overrides
  };
}

describe("ageFromDob", () => {
  it("computes age before birthday this year", () => {
    expect(ageFromDob("1990-09-10", FIXED_NOW)).toBe(35);
  });

  it("computes age after birthday this year", () => {
    expect(ageFromDob("1990-03-10", FIXED_NOW)).toBe(36);
  });

  it("returns 0 for invalid input", () => {
    expect(ageFromDob("not-a-date", FIXED_NOW)).toBe(0);
  });

  it("counts the birthday itself as already happened", () => {
    // FIXED_NOW = 2026-06-15; DoB on the same month/day in 1990 → exactly 36.
    expect(ageFromDob("1990-06-15", FIXED_NOW)).toBe(36);
  });
});

describe("clampHorizon", () => {
  it("clamps below minimum", () => {
    expect(clampHorizon(0)).toBe(MIN_HORIZON_YEARS);
    expect(clampHorizon(-10)).toBe(MIN_HORIZON_YEARS);
  });

  it("clamps above maximum", () => {
    expect(clampHorizon(999)).toBe(MAX_HORIZON_YEARS);
  });

  it("rounds fractional values", () => {
    expect(clampHorizon(29.6)).toBe(30);
  });

  it("returns the minimum for non-finite values", () => {
    expect(clampHorizon(Number.NaN)).toBe(MIN_HORIZON_YEARS);
    expect(clampHorizon(Number.POSITIVE_INFINITY)).toBe(MIN_HORIZON_YEARS);
    expect(clampHorizon(Number.NEGATIVE_INFINITY)).toBe(MIN_HORIZON_YEARS);
  });
});

describe("computeCurrentNetWorth", () => {
  it("sums every balance-sheet field and subtracts debt", () => {
    const filled: PlanInputs = {
      ...BASE_INPUTS,
      startAssets: 100_000,
      cashBalance: 20_000,
      nonLiquidInvestments: 30_000,
      otherFixedAssets: 5_000,
      realEstateHoldings: [
        makeHolding({ value: 400_000 }),
        makeHolding({ value: 50_000 })
      ],
      startDebt: 60_000
    };
    expect(computeCurrentNetWorth(filled)).toBe(545_000);
  });

  it("ignores debtEndYear when computing today's balance", () => {
    // The projection treats debt with `debtEndYear <= startYear` as already
    // settled (debtBalance starts at 0), so points[0].netWorth would omit the
    // entered debt. The helper must reflect the user's reported balance sheet
    // regardless.
    const settledLoan: PlanInputs = {
      ...BASE_INPUTS,
      startAssets: 200_000,
      startDebt: 50_000,
      debtEndYear: 2000
    };
    expect(computeCurrentNetWorth(settledLoan)).toBe(150_000);
  });

  it("returns zero when every balance is zero", () => {
    const empty: PlanInputs = {
      ...BASE_INPUTS,
      startAssets: 0,
      cashBalance: 0,
      nonLiquidInvestments: 0,
      otherFixedAssets: 0,
      realEstateHoldings: [],
      startDebt: 0
    };
    expect(computeCurrentNetWorth(empty)).toBe(0);
  });

  it("can return a negative number when debt exceeds assets", () => {
    const underwater: PlanInputs = {
      ...BASE_INPUTS,
      startAssets: 10_000,
      cashBalance: 0,
      nonLiquidInvestments: 0,
      otherFixedAssets: 0,
      realEstateHoldings: [],
      startDebt: 25_000
    };
    expect(computeCurrentNetWorth(underwater)).toBe(-15_000);
  });
});

describe("computeAnnualCashFlowRatio", () => {
  it("computes the rate from salary alone when there are no other inflows", () => {
    const inputs: PlanInputs = {
      ...BASE_INPUTS,
      startAssets: 0,
      annualIncome: 120_000,
      monthlySpending: 5_000
    };
    // (120000 - 60000) / 120000 = 0.5
    money(computeAnnualCashFlowRatio(inputs)!, 0.5);
  });

  it("includes rental income in the inflow denominator", () => {
    const inputs: PlanInputs = {
      ...BASE_INPUTS,
      startAssets: 0,
      annualIncome: 100_000,
      rentalIncome: 20_000,
      monthlySpending: 5_000
    };
    // inflows = 120000, outflows = 60000 → 0.5
    money(computeAnnualCashFlowRatio(inputs)!, 0.5);
  });

  it("includes year-1 portfolio earnings (startAssets * nominalReturn) in inflows", () => {
    const inputs: PlanInputs = {
      ...BASE_INPUTS,
      startAssets: 100_000,
      nominalReturn: 0.05,
      annualIncome: 95_000,
      monthlySpending: 5_000
    };
    // inflows = 95000 + 0 + 100000 * 0.05 = 100000
    // outflows = 60000 → ratio = 0.4
    money(computeAnnualCashFlowRatio(inputs)!, 0.4);
  });

  it("excludes cashBalance from earnings (cash does not compound)", () => {
    const inputs: PlanInputs = {
      ...BASE_INPUTS,
      startAssets: 0,
      cashBalance: 1_000_000,
      nominalReturn: 0.05,
      annualIncome: 100_000,
      monthlySpending: 5_000
    };
    // inflows = 100000 (cashBalance contributes nothing), outflows = 60000 → 0.4
    money(computeAnnualCashFlowRatio(inputs)!, 0.4);
  });

  it("returns null when total inflows are zero", () => {
    const inputs: PlanInputs = {
      ...BASE_INPUTS,
      startAssets: 0,
      annualIncome: 0,
      rentalIncome: 0
    };
    expect(computeAnnualCashFlowRatio(inputs)).toBeNull();
  });

  it("returns null when nominalReturn is zero and salary/rental are zero", () => {
    const inputs: PlanInputs = {
      ...BASE_INPUTS,
      startAssets: 100_000,
      nominalReturn: 0,
      annualIncome: 0,
      rentalIncome: 0
    };
    expect(computeAnnualCashFlowRatio(inputs)).toBeNull();
  });

  it("returns a negative rate when spending exceeds total inflows", () => {
    const inputs: PlanInputs = {
      ...BASE_INPUTS,
      startAssets: 0,
      annualIncome: 60_000,
      monthlySpending: 6_000
    };
    // (60000 - 72000) / 60000 = -0.2
    money(computeAnnualCashFlowRatio(inputs)!, -0.2);
  });
});

describe("computeRealCAGR", () => {
  it("matches the closed-form (end/start)^(1/y) - 1", () => {
    const cagr = computeRealCAGR(100_000, 250_000, 20)!;
    money(cagr, (250_000 / 100_000) ** (1 / 20) - 1);
  });

  it("returns null when the start net worth is non-positive", () => {
    expect(computeRealCAGR(0, 100_000, 10)).toBeNull();
    expect(computeRealCAGR(-1, 100_000, 10)).toBeNull();
  });

  it("returns null when the end net worth is non-positive", () => {
    expect(computeRealCAGR(100_000, 0, 10)).toBeNull();
    expect(computeRealCAGR(100_000, -50_000, 10)).toBeNull();
  });

  it("returns null when years is zero or negative", () => {
    expect(computeRealCAGR(100_000, 200_000, 0)).toBeNull();
    expect(computeRealCAGR(100_000, 200_000, -5)).toBeNull();
  });

  it("returns zero when start equals end (no growth)", () => {
    money(computeRealCAGR(100_000, 100_000, 30)!, 0);
  });
});

describe("projectNetWorth", () => {
  it("produces horizonYears+1 points with correct start and end ages", () => {
    const points = projectNetWorth(BASE_INPUTS, FIXED_NOW);
    const currentAge = ageFromDob(BASE_INPUTS.dateOfBirth, FIXED_NOW);
    expect(points).toHaveLength(BASE_INPUTS.horizonYears + 1);
    expect(points[0].age).toBe(currentAge);
    expect(points.at(-1)?.age).toBe(currentAge + BASE_INPUTS.horizonYears);
  });

  it("returns the start assets at year 0", () => {
    const points = projectNetWorth(BASE_INPUTS, FIXED_NOW);
    expect(points[0].netWorth).toBe(BASE_INPUTS.startAssets);
  });

  it("applies the deterministic recurrence at year 1", () => {
    const points = projectNetWorth(BASE_INPUTS, FIXED_NOW);
    const expected =
      BASE_INPUTS.startAssets * (1 + BASE_INPUTS.nominalReturn) -
      BASE_INPUTS.monthlySpending * 12 +
      BASE_INPUTS.annualIncome;
    money(points[1].netWorth, expected);
  });

  it("matches closed-form value at year 10", () => {
    const points = projectNetWorth(BASE_INPUTS, FIXED_NOW);
    const r = BASE_INPUTS.nominalReturn;
    const flow = BASE_INPUTS.annualIncome - BASE_INPUTS.monthlySpending * 12;
    const n = 10;
    const expected =
      BASE_INPUTS.startAssets * (1 + r) ** n + (flow * ((1 + r) ** n - 1)) / r;
    money(points[n].netWorth, expected, 0.5);
  });

  it("subtracts debt from net worth", () => {
    const points = projectNetWorth(
      { ...BASE_INPUTS, startAssets: 100_000, startDebt: 40_000 },
      FIXED_NOW
    );
    expect(points[0].netWorth).toBe(60_000);
  });

  it("changes linearly when return is zero", () => {
    const points = projectNetWorth({ ...BASE_INPUTS, nominalReturn: 0 }, FIXED_NOW);
    const flow = BASE_INPUTS.annualIncome - BASE_INPUTS.monthlySpending * 12;
    expect(points[5].netWorth).toBe(BASE_INPUTS.startAssets + flow * 5);
  });

  it("compounds losses under a negative return", () => {
    const points = projectNetWorth(
      { ...BASE_INPUTS, nominalReturn: -0.1, annualIncome: 0, monthlySpending: 0 },
      FIXED_NOW
    );
    money(points[3].netWorth, BASE_INPUTS.startAssets * 0.9 ** 3, 0.5);
  });

  it.each([MIN_HORIZON_YEARS, 30, MAX_HORIZON_YEARS])(
    "produces horizon+1 points for horizon=%i",
    (h) => {
      const points = projectNetWorth({ ...BASE_INPUTS, horizonYears: h }, FIXED_NOW);
      expect(points).toHaveLength(h + 1);
      expect(points.at(-1)?.age).toBe(points[0].age + h);
    }
  );

  it("clamps horizon to MIN and MAX bounds", () => {
    expect(projectNetWorth({ ...BASE_INPUTS, horizonYears: 0 }, FIXED_NOW)).toHaveLength(
      MIN_HORIZON_YEARS + 1
    );
    expect(projectNetWorth({ ...BASE_INPUTS, horizonYears: 999 }, FIXED_NOW)).toHaveLength(
      MAX_HORIZON_YEARS + 1
    );
  });

  it("does not alter earlier-year values when horizon grows", () => {
    const short = projectNetWorth({ ...BASE_INPUTS, horizonYears: 20 }, FIXED_NOW);
    const long = projectNetWorth({ ...BASE_INPUTS, horizonYears: 50 }, FIXED_NOW);
    for (let i = 0; i <= 20; i += 1) money(long[i].netWorth, short[i].netWorth);
  });

  it("labels years starting from now.getFullYear()", () => {
    const points = projectNetWorth(BASE_INPUTS, FIXED_NOW);
    expect(points[0].year).toBe(FIXED_NOW.getFullYear());
    expect(points[5].year).toBe(FIXED_NOW.getFullYear() + 5);
    expect(points.at(-1)?.year).toBe(FIXED_NOW.getFullYear() + BASE_INPUTS.horizonYears);
  });

  it("does not mutate its input", () => {
    const input: PlanInputs = { ...BASE_INPUTS };
    const snapshot = JSON.stringify(input);
    projectNetWorth(input, FIXED_NOW);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("is referentially deterministic for the same input", () => {
    const a = projectNetWorth(BASE_INPUTS, FIXED_NOW);
    const b = projectNetWorth(BASE_INPUTS, FIXED_NOW);
    expect(a).toEqual(b);
  });

  it("sums every bucket minus debt at year 0", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 100_000,
        cashBalance: 25_000,
        nonLiquidInvestments: 50_000,
        otherFixedAssets: 10_000,
        realEstateHoldings: [
          makeHolding({ value: 400_000 }),
          makeHolding({ value: 150_000 })
        ],
        startDebt: 80_000
      },
      FIXED_NOW
    );
    expect(points[0].netWorth).toBe(100_000 + 25_000 + 50_000 + 10_000 + 400_000 + 150_000 - 80_000);
  });

  it("compounds a held property at its own rate and ignores spending shortfalls", () => {
    // No income, no cash, no starting assets, no return — only a pure −120k/yr drag
    // on financial assets. The holding must still compound at 4% and contribute fully.
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        cashBalance: 0,
        annualIncome: 0,
        monthlySpending: 10_000,
        nominalReturn: 0,
        realEstateHoldings: [
          makeHolding({ value: 500_000, appreciationRate: 0.04 })
        ]
      },
      FIXED_NOW
    );
    const residenceAt10 = 500_000 * 1.04 ** 10;
    const assetsAt10 = -10_000 * 12 * 10;
    money(points[10].netWorth, residenceAt10 + assetsAt10, 0.5);
  });

  it("grows two held properties at independent rates", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        annualIncome: 0,
        monthlySpending: 0,
        realEstateHoldings: [
          makeHolding({ value: 100_000, appreciationRate: 0.02 }),
          makeHolding({ value: 100_000, appreciationRate: 0.05 })
        ]
      },
      FIXED_NOW
    );
    const residence = 100_000 * 1.02 ** 5;
    const other = 100_000 * 1.05 ** 5;
    money(points[5].netWorth, residence + other, 0.5);
  });

  it("drains cash before financial assets on a pure shortfall", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 100_000,
        cashBalance: 20_000,
        annualIncome: 0,
        monthlySpending: 1_000,
        nominalReturn: 0
      },
      FIXED_NOW
    );
    // year 1: shortfall = 12_000. Cash 20_000 → 8_000. Assets untouched at 100_000.
    expect(points[1].netWorth).toBe(8_000 + 100_000);
    // year 2: shortfall = 12_000. Cash 8_000 → 0. Assets -4_000 → 96_000.
    expect(points[2].netWorth).toBe(0 + 96_000);
  });

  it("continues depleting financial assets after cash reaches zero", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 50_000,
        cashBalance: 5_000,
        annualIncome: 0,
        monthlySpending: 1_000,
        nominalReturn: 0
      },
      FIXED_NOW
    );
    // year 1: shortfall 12_000. Cash 5_000 → 0, remaining 7_000 from assets → 43_000.
    expect(points[1].netWorth).toBe(0 + 43_000);
    // year 2: shortfall 12_000 all from assets → 31_000.
    expect(points[2].netWorth).toBe(0 + 31_000);
  });

  it("keeps non-liquid and other fixed assets flat across all years", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        cashBalance: 0,
        annualIncome: 0,
        monthlySpending: 0,
        nominalReturn: 0,
        nonLiquidInvestments: 75_000,
        otherFixedAssets: 25_000
      },
      FIXED_NOW
    );
    for (const p of points) {
      expect(p.netWorth).toBe(100_000);
    }
  });

  it("does not apply nominal return to cash", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        cashBalance: 10_000,
        annualIncome: 0,
        monthlySpending: 0,
        nominalReturn: 0.5
      },
      FIXED_NOW
    );
    expect(points[5].netWorth).toBe(10_000);
  });

  it("leaves cash untouched when income exactly matches spending (netFlow = 0)", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 100_000,
        cashBalance: 50_000,
        annualIncome: 12_000,
        monthlySpending: 1_000,
        nominalReturn: 0
      },
      FIXED_NOW
    );
    for (const p of points) {
      expect(p.netWorth).toBe(150_000);
    }
  });

  it("does not draw down real estate holdings during deep shortfall", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        cashBalance: 0,
        annualIncome: 0,
        monthlySpending: 2_000,
        nominalReturn: 0,
        realEstateHoldings: [
          makeHolding({ value: 300_000, appreciationRate: 0.03 }),
          makeHolding({ value: 200_000, appreciationRate: 0.02 })
        ]
      },
      FIXED_NOW
    );
    const residenceAt5 = 300_000 * 1.03 ** 5;
    const otherAt5 = 200_000 * 1.02 ** 5;
    const assetsAt5 = -2_000 * 12 * 5;
    money(points[5].netWorth, residenceAt5 + otherAt5 + assetsAt5, 0.5);
  });

  it("applies debt as a constant subtraction at every year", () => {
    const withoutDebt = projectNetWorth({ ...BASE_INPUTS, startDebt: 0 }, FIXED_NOW);
    const withDebt = projectNetWorth({ ...BASE_INPUTS, startDebt: 75_000 }, FIXED_NOW);
    expect(withDebt).toHaveLength(withoutDebt.length);
    for (let i = 0; i < withDebt.length; i += 1) {
      money(withoutDebt[i].netWorth - withDebt[i].netWorth, 75_000);
    }
  });

  it("adds rental income to the netFlow at year 1", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        annualIncome: 0,
        monthlySpending: 0,
        nominalReturn: 0,
        rentalIncome: 20_000,
        rentalIncomeRate: 0
      },
      FIXED_NOW
    );
    expect(points[0].netWorth).toBe(0);
    money(points[1].netWorth, 20_000);
    money(points[2].netWorth, 40_000);
  });

  it("grows rental income at its own rate each subsequent year", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        annualIncome: 0,
        monthlySpending: 0,
        nominalReturn: 0,
        rentalIncome: 10_000,
        rentalIncomeRate: 0.1
      },
      FIXED_NOW
    );
    money(points[1].netWorth, 11_000);
    money(points[2].netWorth, 23_100);
    money(points[3].netWorth, 36_410);
  });

  it("keeps rental income flat when its rate is zero", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        annualIncome: 0,
        monthlySpending: 0,
        nominalReturn: 0,
        rentalIncome: 5_000,
        rentalIncomeRate: 0
      },
      FIXED_NOW
    );
    for (let i = 1; i <= 5; i += 1) money(points[i].netWorth, 5_000 * i);
  });

  it("flows per-holding rental into liquid and compounds at the per-holding rate", () => {
    // Two holdings with independent rental streams: holding A at 10K with
    // 10% annual growth, holding B at 5K flat. Each year's net worth gain
    // is the sum of both rentals; we assert the engine sums them rather
    // than using a single global rental.
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        annualIncome: 0,
        monthlySpending: 0,
        nominalReturn: 0,
        rentalIncome: 0,
        rentalIncomeRate: 0,
        realEstateHoldings: [
          makeHolding({
            value: 0,
            annualRentalIncome: 10_000,
            rentalIncomeRate: 0.1
          }),
          makeHolding({
            value: 0,
            annualRentalIncome: 5_000,
            rentalIncomeRate: 0
          })
        ]
      },
      FIXED_NOW
    );
    // Year 1: 10K * 1.10 + 5K = 16K
    money(points[1].netWorth, 16_000);
    // Year 2: cumulative 16K + (10K * 1.10^2 + 5K) = 16K + 12_100 + 5K = 33_100
    money(points[2].netWorth, 33_100);
    // Year 3: cumulative 33_100 + (10K * 1.10^3 + 5K) = 33_100 + 13_310 + 5K = 51_410
    money(points[3].netWorth, 51_410);
  });

  it("does not contribute holdings rental when annualRentalIncome is zero", () => {
    // A holding with 0 rental should look identical (in liquid) to having
    // no holding at all from a cash-flow perspective. We compare two runs.
    const withRental = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        annualIncome: 0,
        monthlySpending: 0,
        nominalReturn: 0,
        rentalIncome: 0,
        rentalIncomeRate: 0,
        realEstateHoldings: [
          makeHolding({ value: 200_000, appreciationRate: 0 })
        ]
      },
      FIXED_NOW
    );
    for (let i = 0; i <= 5; i += 1) {
      // Real estate value contributes to netWorth but liquid stays at 0.
      money(withRental[i].liquid, 0);
    }
  });

  it("deposits the windfall into the investment portfolio on the matching calendar year", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        cashBalance: 0,
        annualIncome: 0,
        monthlySpending: 0,
        nominalReturn: 0,
        events: [
          makeWindfallEvent({
            amount: 100_000,
            year: FIXED_NOW.getFullYear() + 3
          })
        ]
      },
      FIXED_NOW
    );
    for (let i = 0; i <= 2; i += 1) expect(points[i].netWorth).toBe(0);
    expect(points[3].netWorth).toBe(100_000);
    expect(points[4].netWorth).toBe(100_000);
  });

  it("compounds the windfall with the nominal return from the following year onward", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        cashBalance: 0,
        annualIncome: 0,
        monthlySpending: 0,
        nominalReturn: 0.1,
        events: [
          makeWindfallEvent({
            amount: 100_000,
            year: FIXED_NOW.getFullYear() + 2
          })
        ]
      },
      FIXED_NOW
    );
    money(points[2].netWorth, 100_000);
    money(points[3].netWorth, 110_000);
    money(points[4].netWorth, 121_000);
  });

  it("ignores a windfall year outside the projection horizon", () => {
    const before = projectNetWorth(
      {
        ...BASE_INPUTS,
        horizonYears: MIN_HORIZON_YEARS,
        events: [
          makeWindfallEvent({
            amount: 100_000,
            year: FIXED_NOW.getFullYear() - 5
          })
        ]
      },
      FIXED_NOW
    );
    const after = projectNetWorth(
      {
        ...BASE_INPUTS,
        horizonYears: MIN_HORIZON_YEARS,
        events: [
          makeWindfallEvent({
            amount: 100_000,
            year: FIXED_NOW.getFullYear() + MIN_HORIZON_YEARS + 5
          })
        ]
      },
      FIXED_NOW
    );
    const neutral = projectNetWorth(
      { ...BASE_INPUTS, horizonYears: MIN_HORIZON_YEARS },
      FIXED_NOW
    );
    for (let i = 0; i < neutral.length; i += 1) {
      money(before[i].netWorth, neutral[i].netWorth);
      money(after[i].netWorth, neutral[i].netWorth);
    }
  });

  it("treats a zero-amount windfall as a no-op", () => {
    const withZero = projectNetWorth(
      {
        ...BASE_INPUTS,
        events: [
          makeWindfallEvent({
            amount: 0,
            year: FIXED_NOW.getFullYear() + 5
          })
        ]
      },
      FIXED_NOW
    );
    const without = projectNetWorth(BASE_INPUTS, FIXED_NOW);
    for (let i = 0; i < without.length; i += 1) {
      money(withZero[i].netWorth, without[i].netWorth);
    }
  });

  it("lands the windfall in assets, not cash (cash unchanged for the windfall year)", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        cashBalance: 50_000,
        annualIncome: 12_000,
        monthlySpending: 1_000,
        nominalReturn: 0,
        events: [
          makeWindfallEvent({
            amount: 25_000,
            year: FIXED_NOW.getFullYear() + 4
          })
        ]
      },
      FIXED_NOW
    );
    for (let i = 0; i <= 3; i += 1) expect(points[i].netWorth).toBe(50_000);
    expect(points[4].netWorth).toBe(75_000);
    expect(points[5].netWorth).toBe(75_000);
  });

  it("stacks multiple windfall events independently across years", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        cashBalance: 0,
        annualIncome: 0,
        monthlySpending: 0,
        nominalReturn: 0,
        events: [
          makeWindfallEvent({
            amount: 50_000,
            year: FIXED_NOW.getFullYear() + 2
          }),
          makeWindfallEvent({
            amount: 75_000,
            year: FIXED_NOW.getFullYear() + 5
          })
        ]
      },
      FIXED_NOW
    );
    expect(points[1].netWorth).toBe(0);
    expect(points[2].netWorth).toBe(50_000);
    expect(points[4].netWorth).toBe(50_000);
    expect(points[5].netWorth).toBe(125_000);
    expect(points[6].netWorth).toBe(125_000);
  });

  it("excludes rental income from direct net-worth contribution", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        annualIncome: 0,
        monthlySpending: 0,
        nominalReturn: 0,
        rentalIncome: 50_000,
        rentalIncomeRate: 0
      },
      FIXED_NOW
    );
    expect(points[0].netWorth).toBe(0);
  });

  it("matches hand-computed values across all buckets for 2 years", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 100_000,
        cashBalance: 10_000,
        nonLiquidInvestments: 5_000,
        otherFixedAssets: 5_000,
        realEstateHoldings: [
          makeHolding({ value: 100_000, appreciationRate: 0.1 }),
          makeHolding({ value: 100_000, appreciationRate: 0 })
        ],
        startDebt: 50_000,
        annualIncome: 0,
        monthlySpending: 1_000,
        nominalReturn: 0.1
      },
      FIXED_NOW
    );
    expect(points[0].netWorth).toBe(270_000);
    money(points[1].netWorth, 278_000);
    money(points[2].netWorth, 287_800);
  });

  it("inflates salary and spending when inflationRate > 0", () => {
    const inflated = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        cashBalance: 0,
        nominalReturn: 0,
        inflationRate: 0.02
      },
      FIXED_NOW
    );
    const flat = projectNetWorth(
      { ...BASE_INPUTS, startAssets: 0, cashBalance: 0, nominalReturn: 0 },
      FIXED_NOW
    );
    money(inflated[1].netWorth, 38_000 * 1.02);
    money(flat[1].netWorth, 38_000);
    expect(inflated[1].netWorth).toBeGreaterThan(flat[1].netWorth);
  });

  it("keeps cash nominally flat regardless of inflation", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        cashBalance: 10_000,
        annualIncome: 0,
        monthlySpending: 0,
        nominalReturn: 0,
        inflationRate: 0.05
      },
      FIXED_NOW
    );
    for (const p of points) expect(p.netWorth).toBe(10_000);
  });

  it("inflates the windfall amount to the landing year's nominal value", () => {
    const inflationRate = 0.05;
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        cashBalance: 0,
        annualIncome: 0,
        monthlySpending: 0,
        nominalReturn: 0,
        inflationRate,
        events: [
          makeWindfallEvent({
            amount: 100_000,
            year: FIXED_NOW.getFullYear() + 10
          })
        ]
      },
      FIXED_NOW
    );
    const expected = 100_000 * (1 + inflationRate) ** 10;
    money(points[10].netWorth, expected, 0.5);
  });
});

describe("debt modeling", () => {
  // Tests in this block share a common technique: run the projection twice —
  // once with the configured `startDebt` and once with `startDebt = 0` — and
  // compare per-year `liquid`/`savings`. The delta isolates the debt-related
  // cash outflow each year (since `ProjectionPoint` doesn't expose it).
  const startYear = FIXED_NOW.getFullYear();
  const baseDebtScenario: PlanInputs = {
    ...BASE_INPUTS,
    cashBalance: 200_000, // plenty so payments come out of cash, never overdraw assets
    annualIncome: 0,
    monthlySpending: 0,
    nominalReturn: 0
  };

  const runWith = (overrides: Partial<PlanInputs>) =>
    projectNetWorth({ ...baseDebtScenario, ...overrides }, FIXED_NOW);

  describe("overTime", () => {
    const P = 100_000;
    const r = 0.05;
    const n = 10;
    const endYear = startYear + n;
    const cfg: Partial<PlanInputs> = {
      startDebt: P,
      debtInterestRate: r,
      debtRepaymentType: "overTime",
      debtEndYear: endYear
    };
    const expectedAnnualPayment = (P * r) / (1 - (1 + r) ** -n);

    it("monotonically decreases the debt balance to ~0 at debtEndYear", () => {
      const points = runWith(cfg);
      for (let i = 1; i <= n; i += 1) {
        expect(points[i].debt).toBeLessThan(points[i - 1].debt);
      }
      money(points[n].debt, 0, 0.01);
    });

    it("keeps the debt balance at 0 after debtEndYear", () => {
      const points = runWith(cfg);
      for (let i = n + 1; i < points.length; i += 1) {
        expect(points[i].debt).toBe(0);
      }
    });

    it("reduces liquid vs. baseline by the cumulative annual payment up to each year", () => {
      const withDebt = runWith(cfg);
      const baseline = runWith({ ...cfg, startDebt: 0 });
      for (let i = 1; i <= n; i += 1) {
        const expectedCumulative = expectedAnnualPayment * i;
        money(baseline[i].liquid - withDebt[i].liquid, expectedCumulative, 0.5);
      }
    });

    it("total of all payments ~ matches the closed-form annuity (paymentsxn)", () => {
      const withDebt = runWith(cfg);
      const baseline = runWith({ ...cfg, startDebt: 0 });
      const totalPaid = baseline[n].liquid - withDebt[n].liquid;
      money(totalPaid, expectedAnnualPayment * n, 0.5);
    });

    it("at r=0, repays principal linearly (P/n per year, no interest)", () => {
      const points = runWith({ ...cfg, debtInterestRate: 0 });
      for (let i = 0; i <= n; i += 1) {
        money(points[i].debt, P - (P / n) * i, 0.01);
      }
      const baseline = runWith({ ...cfg, debtInterestRate: 0, startDebt: 0 });
      for (let i = 1; i <= n; i += 1) {
        money(baseline[i].liquid - points[i].liquid, (P / n) * i, 0.5);
      }
    });
  });

  describe("inFine", () => {
    const P = 100_000;
    const r = 0.05;
    const n = 10;
    const endYear = startYear + n;
    const cfg: Partial<PlanInputs> = {
      startDebt: P,
      debtInterestRate: r,
      debtRepaymentType: "inFine",
      debtEndYear: endYear
    };

    it("holds the principal balance flat at P for every year before debtEndYear", () => {
      const points = runWith(cfg);
      for (let i = 1; i < n; i += 1) {
        expect(points[i].debt).toBe(P);
      }
    });

    it("makes interest-only payments of exactly P*r every year before debtEndYear", () => {
      const withDebt = runWith(cfg);
      const baseline = runWith({ ...cfg, startDebt: 0 });
      const annualInterest = P * r;
      for (let i = 1; i < n; i += 1) {
        const perYearDelta = (baseline[i].liquid - baseline[i - 1].liquid)
          - (withDebt[i].liquid - withDebt[i - 1].liquid);
        money(perYearDelta, annualInterest, 0.5);
      }
    });

    it("pays interest + lump sum (P*r + P) in debtEndYear and clears the balance", () => {
      const withDebt = runWith(cfg);
      const baseline = runWith({ ...cfg, startDebt: 0 });
      const finalYearOutflow =
        (baseline[n].liquid - baseline[n - 1].liquid) -
        (withDebt[n].liquid - withDebt[n - 1].liquid);
      money(finalYearOutflow, P * r + P, 0.5);
      expect(withDebt[n].debt).toBe(0);
    });

    it("plateaus cumulative outflow at P*r*n + P after debtEndYear", () => {
      const withDebt = runWith(cfg);
      const baseline = runWith({ ...cfg, startDebt: 0 });
      const expectedTotal = P * r * n + P;
      for (let i = n; i < withDebt.length; i += 1) {
        money(baseline[i].liquid - withDebt[i].liquid, expectedTotal, 0.5);
        expect(withDebt[i].debt).toBe(0);
      }
    });

    it("at r=0, no annual interest and a single lump sum at debtEndYear", () => {
      const cfg0 = { ...cfg, debtInterestRate: 0 };
      const withDebt = runWith(cfg0);
      const baseline = runWith({ ...cfg0, startDebt: 0 });
      for (let i = 1; i < n; i += 1) {
        money(baseline[i].liquid - withDebt[i].liquid, 0, 0.01);
        expect(withDebt[i].debt).toBe(P);
      }
      money(baseline[n].liquid - withDebt[n].liquid, P, 0.5);
      expect(withDebt[n].debt).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("P=0 has no impact for either repayment type", () => {
      for (const debtRepaymentType of ["overTime", "inFine"] as const) {
        const points = runWith({
          startDebt: 0,
          debtInterestRate: 0.05,
          debtRepaymentType,
          debtEndYear: startYear + 10
        });
        for (const p of points) {
          expect(p.debt).toBe(0);
        }
        const baseline = runWith({ startDebt: 0 });
        for (let i = 0; i < points.length; i += 1) {
          money(points[i].liquid, baseline[i].liquid, 0.01);
        }
      }
    });

    it("debtEndYear <= startYear treats the loan as already settled (balance 0, no flows)", () => {
      for (const debtEndYear of [startYear, startYear - 5]) {
        const points = runWith({
          startDebt: 100_000,
          debtInterestRate: 0.05,
          debtRepaymentType: "overTime",
          debtEndYear
        });
        const baseline = runWith({ startDebt: 0 });
        for (let i = 0; i < points.length; i += 1) {
          expect(points[i].debt).toBe(0);
          money(points[i].liquid, baseline[i].liquid, 0.01);
        }
      }
    });

    it("draws debt payments from cash first, then portfolio", () => {
      // Small cash buffer so the overTime payment fully drains cash within ~2 yrs.
      const points = projectNetWorth(
        {
          ...BASE_INPUTS,
          startAssets: 1_000_000,
          cashBalance: 5_000,
          annualIncome: 0,
          monthlySpending: 0,
          nominalReturn: 0,
          startDebt: 100_000,
          debtInterestRate: 0,
          debtRepaymentType: "overTime",
          debtEndYear: FIXED_NOW.getFullYear() + 10
        },
        FIXED_NOW
      );
      // year 1: 10_000 payment, cash 5_000 → 0, assets 1_000_000 → 995_000.
      money(points[1].liquid, 0 + 995_000, 0.5);
      // year 2: 10_000 payment, cash 0, assets 995_000 → 985_000.
      money(points[2].liquid, 0 + 985_000, 0.5);
    });
  });
});

describe("deflateToToday", () => {
  const mk = (year: number, netWorth: number, liquid = 0): ProjectionPoint => ({
    year,
    age: 40 + (year - 2026),
    netWorth,
    liquid,
    savings: 0,
    otherAssets: 0,
    realEstate: 0,
    debt: 0
  });

  it("returns the input array untouched when inflationRate is 0", () => {
    const points = [mk(2026, 100_000), mk(2027, 110_000), mk(2028, 121_000)];
    expect(deflateToToday(points, 0, 2026)).toBe(points);
  });

  it("leaves the year-0 point unchanged", () => {
    const points = [mk(2026, 100_000), mk(2027, 110_000)];
    const result = deflateToToday(points, 0.05, 2026);
    expect(result[0].netWorth).toBe(100_000);
    expect(result[0].year).toBe(2026);
    expect(result[0].age).toBe(points[0].age);
  });

  it("deflates later points by (1 + i)^t", () => {
    const points = [mk(2026, 100_000), mk(2027, 110_000), mk(2028, 121_000)];
    const result = deflateToToday(points, 0.1, 2026);
    money(result[1].netWorth, 110_000 / 1.1);
    money(result[2].netWorth, 121_000 / 1.1 ** 2);
  });

  it("round-trips: inflating then deflating returns the start value", () => {
    const i = 0.03;
    const t = 5;
    const start = 250_000;
    const nominal = start * (1 + i) ** t;
    const points = [mk(2026, start), mk(2026 + t, nominal)];
    const real = deflateToToday(points, i, 2026);
    money(real[1].netWorth, start);
  });

  it("deflates the liquid field by the same factor as netWorth", () => {
    const points: ProjectionPoint[] = [
      {
        year: 2026,
        age: 40,
        netWorth: 100_000,
        liquid: 50_000,
        savings: 0,
        otherAssets: 0,
        realEstate: 0,
        debt: 0
      },
      {
        year: 2031,
        age: 45,
        netWorth: 200_000,
        liquid: 75_000,
        savings: 0,
        otherAssets: 0,
        realEstate: 0,
        debt: 0
      }
    ];
    const real = deflateToToday(points, 0.05, 2026);
    expect(real[0].liquid).toBe(50_000);
    money(real[1].liquid, 75_000 / 1.05 ** 5);
    money(real[1].netWorth, 200_000 / 1.05 ** 5);
  });

  it("deflates each bucket by the same factor as netWorth", () => {
    const points: ProjectionPoint[] = [
      {
        year: 2026,
        age: 40,
        netWorth: 100_000,
        liquid: 60_000,
        savings: 60_000,
        otherAssets: 10_000,
        realEstate: 50_000,
        debt: 20_000
      },
      {
        year: 2031,
        age: 45,
        netWorth: 200_000,
        liquid: 80_000,
        savings: 80_000,
        otherAssets: 15_000,
        realEstate: 125_000,
        debt: 20_000
      }
    ];
    const real = deflateToToday(points, 0.04, 2026);
    const divisor = 1.04 ** 5;
    expect(real[0].savings).toBe(60_000);
    expect(real[0].otherAssets).toBe(10_000);
    expect(real[0].realEstate).toBe(50_000);
    expect(real[0].debt).toBe(20_000);
    money(real[1].savings, 80_000 / divisor);
    money(real[1].otherAssets, 15_000 / divisor);
    money(real[1].realEstate, 125_000 / divisor);
    money(real[1].debt, 20_000 / divisor);
  });
});

describe("projectNetWorth bucket fields", () => {
  it("splits year-0 into the four buckets matching the raw inputs", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 100_000,
        cashBalance: 25_000,
        nonLiquidInvestments: 50_000,
        otherFixedAssets: 10_000,
        realEstateHoldings: [
          makeHolding({ value: 400_000 }),
          makeHolding({ value: 150_000 })
        ],
        startDebt: 80_000
      },
      FIXED_NOW
    );
    expect(points[0].savings).toBe(125_000);
    expect(points[0].otherAssets).toBe(60_000);
    expect(points[0].realEstate).toBe(550_000);
    expect(points[0].debt).toBe(80_000);
  });

  it("keeps savings + otherAssets + realEstate - debt equal to netWorth at every point", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 100_000,
        cashBalance: 10_000,
        nonLiquidInvestments: 5_000,
        otherFixedAssets: 5_000,
        realEstateHoldings: [
          makeHolding({ value: 100_000, appreciationRate: 0.05 }),
          makeHolding({ value: 50_000, appreciationRate: 0.02 })
        ],
        startDebt: 40_000,
        monthlySpending: 1_500,
        nominalReturn: 0.04
      },
      FIXED_NOW
    );
    for (const p of points) {
      money(p.savings + p.otherAssets + p.realEstate - p.debt, p.netWorth);
    }
  });

  it("compounds real estate holdings independently at their own rates", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        cashBalance: 0,
        annualIncome: 0,
        monthlySpending: 0,
        realEstateHoldings: [
          makeHolding({ value: 200_000, appreciationRate: 0.03 }),
          makeHolding({ value: 100_000, appreciationRate: 0.05 })
        ]
      },
      FIXED_NOW
    );
    money(points[10].realEstate, 200_000 * 1.03 ** 10 + 100_000 * 1.05 ** 10, 0.5);
  });

  it("holds otherAssets and debt flat across all years", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        nonLiquidInvestments: 75_000,
        otherFixedAssets: 25_000,
        startDebt: 60_000
      },
      FIXED_NOW
    );
    for (const p of points) {
      expect(p.otherAssets).toBe(100_000);
      expect(p.debt).toBe(60_000);
    }
  });
});

describe("projectNetWorth — non-liquid liquidity year", () => {
  // Strip flows down so changes in liquid (`savings`) come purely from the
  // liquidity transfer + portfolio compounding, never from salary/spend.
  const startYear = FIXED_NOW.getFullYear();
  const quietBase: PlanInputs = {
    ...BASE_INPUTS,
    startAssets: 0,
    cashBalance: 0,
    annualIncome: 0,
    monthlySpending: 0,
    rentalIncome: 0,
    inflationRate: 0
  };

  it("keeps the value in otherAssets and lets liquid compound separately before the liquidity year", () => {
    const points = projectNetWorth(
      {
        ...quietBase,
        startAssets: 100_000,
        nominalReturn: 0.05,
        nonLiquidInvestments: 50_000,
        nonLiquidLiquidityYear: startYear + 5
      },
      FIXED_NOW
    );
    // Years 0..4 are strictly before the transfer.
    for (let i = 0; i < 5; i += 1) {
      expect(points[i].otherAssets).toBe(50_000);
      money(points[i].savings, 100_000 * 1.05 ** i, 0.5);
    }
  });

  it("transfers the value into liquid at the liquidity year and compounds it from the next year", () => {
    const points = projectNetWorth(
      {
        ...quietBase,
        startAssets: 0,
        nominalReturn: 0.05,
        nonLiquidInvestments: 50_000,
        nonLiquidLiquidityYear: startYear + 3
      },
      FIXED_NOW
    );
    // Year 2 — still non-liquid.
    expect(points[2].otherAssets).toBe(50_000);
    money(points[2].savings, 0, 0.01);
    // Year 3 — transfer happens at year-end, mirroring the windfall convention:
    // the transferred amount lands in `assets` after that year's compounding,
    // so savings == the entered nominal value and otherAssets is drained.
    expect(points[3].otherAssets).toBe(0);
    money(points[3].savings, 50_000, 0.01);
    // Year 4 — compounds for the first time.
    money(points[4].savings, 50_000 * 1.05, 0.5);
    // Year 5 — keeps compounding.
    money(points[5].savings, 50_000 * 1.05 ** 2, 0.5);
  });

  it("treats nonLiquidLiquidityYear at-or-before the start year as already liquid at year 0", () => {
    const points = projectNetWorth(
      {
        ...quietBase,
        startAssets: 0,
        nominalReturn: 0.05,
        nonLiquidInvestments: 80_000,
        nonLiquidLiquidityYear: startYear // exactly at start
      },
      FIXED_NOW
    );
    // Already moved at year 0; compounds from year 1 onward.
    expect(points[0].otherAssets).toBe(0);
    money(points[0].savings, 80_000, 0.01);
    money(points[1].savings, 80_000 * 1.05, 0.5);
    money(points[5].savings, 80_000 * 1.05 ** 5, 0.5);
  });

  it("also treats a liquidity year strictly before the start year as already liquid", () => {
    const points = projectNetWorth(
      {
        ...quietBase,
        startAssets: 0,
        nominalReturn: 0.05,
        nonLiquidInvestments: 80_000,
        nonLiquidLiquidityYear: startYear - 5 // already past
      },
      FIXED_NOW
    );
    expect(points[0].otherAssets).toBe(0);
    money(points[0].savings, 80_000, 0.01);
    money(points[1].savings, 80_000 * 1.05, 0.5);
  });

  it("leaves the asset non-liquid for the entire horizon when the liquidity year is past it", () => {
    const horizon = 30;
    const points = projectNetWorth(
      {
        ...quietBase,
        horizonYears: horizon,
        startAssets: 0,
        nominalReturn: 0.05,
        nonLiquidInvestments: 50_000,
        nonLiquidLiquidityYear: startYear + horizon + 100
      },
      FIXED_NOW
    );
    for (const p of points) {
      expect(p.otherAssets).toBe(50_000);
      money(p.savings, 0, 0.01);
    }
  });

  it("transfers the two non-liquid buckets at independent years", () => {
    const points = projectNetWorth(
      {
        ...quietBase,
        startAssets: 0,
        nominalReturn: 0,
        nonLiquidInvestments: 30_000,
        otherFixedAssets: 20_000,
        nonLiquidLiquidityYear: startYear + 2,
        otherFixedLiquidityYear: startYear + 5
      },
      FIXED_NOW
    );
    // Year 1 — both still non-liquid.
    expect(points[1].otherAssets).toBe(50_000);
    money(points[1].savings, 0, 0.01);
    // Year 2 — non-liquid bucket lands in liquid.
    expect(points[2].otherAssets).toBe(20_000);
    money(points[2].savings, 30_000, 0.01);
    // Years 3..4 — only non-liquid has transferred, otherFixed still pending.
    expect(points[3].otherAssets).toBe(20_000);
    money(points[3].savings, 30_000, 0.01);
    expect(points[4].otherAssets).toBe(20_000);
    money(points[4].savings, 30_000, 0.01);
    // Year 5 — otherFixed lands too. With nominalReturn=0 the first deposit
    // does not grow, so liquid simply holds the sum of both transfers.
    expect(points[5].otherAssets).toBe(0);
    money(points[5].savings, 50_000, 0.01);
  });

  it("preserves total net worth at the moment of transfer (a value just moves between buckets)", () => {
    const points = projectNetWorth(
      {
        ...quietBase,
        startAssets: 0,
        nominalReturn: 0,
        nonLiquidInvestments: 40_000,
        nonLiquidLiquidityYear: startYear + 3
      },
      FIXED_NOW
    );
    // With zero return and zero flows, every year's net worth equals the
    // initial 40k regardless of which bucket holds it.
    for (const p of points) {
      money(p.netWorth, 40_000, 0.01);
    }
  });

  it("does not change behavior on the default plan (defaults are past horizon)", () => {
    const baseline = projectNetWorth(
      {
        ...BASE_INPUTS,
        nonLiquidInvestments: 50_000,
        otherFixedAssets: 25_000
      },
      FIXED_NOW
    );
    for (const p of baseline) {
      expect(p.otherAssets).toBe(75_000);
    }
  });
});

describe("projectNetWorth liquid field", () => {
  it("equals startAssets + cashBalance at year 0", () => {
    const points = projectNetWorth(
      { ...BASE_INPUTS, startAssets: 100_000, cashBalance: 25_000 },
      FIXED_NOW
    );
    expect(points[0].liquid).toBe(125_000);
  });

  it("does not include non-liquid, other fixed, or property in liquid", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 50_000,
        cashBalance: 10_000,
        nonLiquidInvestments: 999_999,
        otherFixedAssets: 999_999,
        realEstateHoldings: [
          makeHolding({ value: 999_999 }),
          makeHolding({ value: 999_999 })
        ],
        startDebt: 100_000
      },
      FIXED_NOW
    );
    expect(points[0].liquid).toBe(60_000);
  });

  it("drops liquid as cash drains during a shortfall", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 100_000,
        cashBalance: 20_000,
        annualIncome: 0,
        monthlySpending: 1_000,
        nominalReturn: 0
      },
      FIXED_NOW
    );
    expect(points[0].liquid).toBe(120_000);
    expect(points[1].liquid).toBe(108_000);
  });

  it("lets liquid go negative once cash is gone and assets are overdrawn", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 10_000,
        cashBalance: 5_000,
        annualIncome: 0,
        monthlySpending: 2_000,
        nominalReturn: 0
      },
      FIXED_NOW
    );
    expect(points[0].liquid).toBe(15_000);
    expect(points[1].liquid).toBe(-9_000);
    expect(points[2].liquid).toBe(-33_000);
  });

  it("grows liquid when the portfolio compounds with no flows", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 100_000,
        cashBalance: 0,
        annualIncome: 0,
        monthlySpending: 0,
        nominalReturn: 0.05,
        inflationRate: 0
      },
      FIXED_NOW
    );
    money(points[10].liquid, 100_000 * 1.05 ** 10, 0.5);
  });

  it("keeps liquid flat when cash is the only liquid bucket and nothing moves", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        cashBalance: 50_000,
        annualIncome: 12_000,
        monthlySpending: 1_000,
        nominalReturn: 0,
        inflationRate: 0
      },
      FIXED_NOW
    );
    for (const p of points) expect(p.liquid).toBe(50_000);
  });
});

describe("real estate investment events", () => {
  const startYear = FIXED_NOW.getFullYear();
  // Strip recurring flows so the only year-over-year movement comes from
  // the RE event under test.
  const quietBase: PlanInputs = {
    ...BASE_INPUTS,
    startAssets: 1_000_000,
    cashBalance: 0,
    annualIncome: 0,
    monthlySpending: 0,
    nominalReturn: 0,
    rentalIncome: 0,
    rentalIncomeRate: 0,
    inflationRate: 0
  };

  it("treats an empty events array as a no-op (matches baseline)", () => {
    const baseline = projectNetWorth(quietBase, FIXED_NOW);
    const explicit = projectNetWorth({ ...quietBase, events: [] }, FIXED_NOW);
    for (let i = 0; i < baseline.length; i += 1) {
      expect(explicit[i].netWorth).toBe(baseline[i].netWorth);
      expect(explicit[i].realEstate).toBe(baseline[i].realEstate);
    }
  });

  it("does nothing before the purchase year", () => {
    const event = makeReEvent({
      purchaseAmount: 200_000,
      purchaseYear: startYear + 5,
      appreciationRate: 0.05,
      annualRentalIncome: 12_000,
      rentalIncomeRate: 0.02
    });
    const points = projectNetWorth({ ...quietBase, events: [event] }, FIXED_NOW);
    for (let i = 0; i < 5; i += 1) {
      expect(points[i].realEstate).toBe(0);
      expect(points[i].liquid).toBe(1_000_000);
      expect(points[i].netWorth).toBe(1_000_000);
    }
  });

  it("at the purchase year deducts the purchase from liquid and seeds the property bucket plus the first year's rent", () => {
    const event = makeReEvent({
      purchaseAmount: 200_000,
      purchaseYear: startYear + 3,
      appreciationRate: 0,
      annualRentalIncome: 12_000,
      rentalIncomeRate: 0
    });
    const points = projectNetWorth({ ...quietBase, events: [event] }, FIXED_NOW);
    // Before purchase, untouched.
    expect(points[2].liquid).toBe(1_000_000);
    expect(points[2].realEstate).toBe(0);
    // Purchase year: liquid drops by 200k, gains 12k rental, rises by
    // (rental - purchase) = -188k overall in liquid; property bucket holds
    // the 200k value.
    money(points[3].liquid, 1_000_000 - 200_000 + 12_000);
    money(points[3].realEstate, 200_000);
    money(points[3].netWorth, 1_000_000 + 12_000);
  });

  it("compounds the property value at the appreciation rate after purchase", () => {
    const event = makeReEvent({
      purchaseAmount: 100_000,
      purchaseYear: startYear + 1,
      appreciationRate: 0.04,
      annualRentalIncome: 0,
      rentalIncomeRate: 0
    });
    const points = projectNetWorth({ ...quietBase, events: [event] }, FIXED_NOW);
    money(points[1].realEstate, 100_000);
    money(points[2].realEstate, 100_000 * 1.04);
    money(points[5].realEstate, 100_000 * 1.04 ** 4);
    money(points[10].realEstate, 100_000 * 1.04 ** 9);
  });

  it("compounds rental income at the rentalIncomeRate after purchase", () => {
    const event = makeReEvent({
      purchaseAmount: 0,
      purchaseYear: startYear + 1,
      appreciationRate: 0,
      annualRentalIncome: 10_000,
      rentalIncomeRate: 0.1
    });
    const points = projectNetWorth({ ...quietBase, events: [event] }, FIXED_NOW);
    // No purchase cost; with no other flows liquid grows by the cumulative
    // rental income each year.
    money(points[1].liquid, 1_000_000 + 10_000);
    money(points[2].liquid, 1_000_000 + 10_000 + 10_000 * 1.1);
    money(points[3].liquid, 1_000_000 + 10_000 + 10_000 * 1.1 + 10_000 * 1.1 ** 2);
  });

  it("inflates today's-money inputs to the landing year (windfall convention)", () => {
    const inflationRate = 0.05;
    const event = makeReEvent({
      purchaseAmount: 100_000,
      purchaseYear: startYear + 10,
      appreciationRate: 0,
      annualRentalIncome: 5_000,
      rentalIncomeRate: 0
    });
    const points = projectNetWorth(
      {
        ...quietBase,
        startAssets: 10_000_000,
        inflationRate,
        events: [event]
      },
      FIXED_NOW
    );
    const inflator = (1 + inflationRate) ** 10;
    money(points[10].realEstate, 100_000 * inflator, 0.5);
    // Year-of-purchase rental contributes one year's worth of inflated rent.
    money(
      points[10].liquid,
      10_000_000 - 100_000 * inflator + 5_000 * inflator,
      1
    );
  });

  it("supports multiple events stacking independently", () => {
    const a = makeReEvent({
      purchaseAmount: 50_000,
      purchaseYear: startYear + 2,
      appreciationRate: 0.03,
      annualRentalIncome: 5_000,
      rentalIncomeRate: 0
    });
    const b = makeReEvent({
      purchaseAmount: 100_000,
      purchaseYear: startYear + 4,
      appreciationRate: 0.05,
      annualRentalIncome: 8_000,
      rentalIncomeRate: 0
    });
    const points = projectNetWorth(
      { ...quietBase, events: [a, b] },
      FIXED_NOW
    );
    // Year 3: only A is active. Property value compounds once.
    money(points[3].realEstate, 50_000 * 1.03);
    // Year 5: A compounds 3x post-purchase, B compounds once.
    money(points[5].realEstate, 50_000 * 1.03 ** 3 + 100_000 * 1.05);
  });

  it("ignores events whose purchase year falls outside the projection horizon", () => {
    const beforeStart = makeReEvent({
      purchaseAmount: 999_999,
      purchaseYear: startYear - 5,
      annualRentalIncome: 50_000
    });
    const afterEnd = makeReEvent({
      purchaseAmount: 999_999,
      purchaseYear: startYear + BASE_INPUTS.horizonYears + 5,
      annualRentalIncome: 50_000
    });
    const baseline = projectNetWorth(quietBase, FIXED_NOW);
    const padded = projectNetWorth(
      { ...quietBase, events: [beforeStart, afterEnd] },
      FIXED_NOW
    );
    for (let i = 0; i < baseline.length; i += 1) {
      expect(padded[i].netWorth).toBe(baseline[i].netWorth);
      expect(padded[i].realEstate).toBe(baseline[i].realEstate);
    }
  });

  it("treats a zero-amount, zero-rental event as a no-op", () => {
    const event = makeReEvent({ purchaseYear: startYear + 5 });
    const baseline = projectNetWorth(quietBase, FIXED_NOW);
    const padded = projectNetWorth({ ...quietBase, events: [event] }, FIXED_NOW);
    for (let i = 0; i < baseline.length; i += 1) {
      expect(padded[i].netWorth).toBe(baseline[i].netWorth);
    }
  });

  it("preserves bucket invariant savings + otherAssets + realEstate - debt = netWorth", () => {
    const event = makeReEvent({
      purchaseAmount: 75_000,
      purchaseYear: startYear + 3,
      appreciationRate: 0.04,
      annualRentalIncome: 6_000,
      rentalIncomeRate: 0.02
    });
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 200_000,
        cashBalance: 20_000,
        nonLiquidInvestments: 10_000,
        otherFixedAssets: 5_000,
        realEstateHoldings: [
          makeHolding({ value: 100_000, appreciationRate: 0.02 })
        ],
        nominalReturn: 0.05,
        events: [event]
      },
      FIXED_NOW
    );
    for (const p of points) {
      money(p.savings + p.otherAssets + p.realEstate - p.debt, p.netWorth);
    }
  });

  it("does not mutate the input events array", () => {
    const event = makeReEvent({
      purchaseAmount: 100_000,
      purchaseYear: startYear + 5
    });
    const inputs: PlanInputs = { ...quietBase, events: [event] };
    const snapshot = JSON.stringify(inputs);
    projectNetWorth(inputs, FIXED_NOW);
    expect(JSON.stringify(inputs)).toBe(snapshot);
  });
});

describe("retirementAge", () => {
  // BASE_INPUTS uses retirementAge: MAX_RETIREMENT_AGE (100) so salary is paid
  // across the whole horizon. These cases override it to exercise the gating.

  it("matches the no-cap baseline when retirementAge exceeds the projection's end age", () => {
    // currentAge=36, horizonYears=30 → final point age = 66, so retirementAge=67
    // means yearAge < retirementAge is true for every year and salary is paid.
    const baseline = projectNetWorth(BASE_INPUTS, FIXED_NOW);
    const capped = projectNetWorth({ ...BASE_INPUTS, retirementAge: 67 }, FIXED_NOW);
    expect(capped).toEqual(baseline);
  });

  it("never adds salary when retirementAge is at or below the current age", () => {
    // retirementAge=36 → at i=1 yearAge=37 ≥ 36, so salary is gated off forever.
    // Compare against an explicit annualIncome=0 baseline: the two projections
    // must be identical point-for-point.
    const noSalary = projectNetWorth(
      { ...BASE_INPUTS, annualIncome: 0 },
      FIXED_NOW
    );
    const retiredAlready = projectNetWorth(
      { ...BASE_INPUTS, retirementAge: 36 },
      FIXED_NOW
    );
    expect(retiredAlready).toEqual(noSalary);
  });

  it("stops adding salary at the first year the projected age reaches retirementAge", () => {
    // currentAge=36, retirementAge=38. With i=1 (yearAge=37) salary is paid,
    // with i=2 (yearAge=38) it is not. With every other flow zeroed out, the
    // liquid balance bumps once at i=1 and then stays flat.
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        cashBalance: 0,
        nominalReturn: 0,
        inflationRate: 0,
        monthlySpending: 0,
        annualIncome: 50_000,
        retirementAge: 38
      },
      FIXED_NOW
    );
    expect(points[0].liquid).toBe(0);
    expect(points[1].liquid).toBe(50_000);
    for (let i = 2; i < points.length; i += 1) {
      expect(points[i].liquid).toBe(50_000);
    }
  });
});
