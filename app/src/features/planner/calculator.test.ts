import { describe, expect, it } from "vitest";
import {
  ageFromDob,
  clampHorizon,
  deflateToToday,
  MAX_HORIZON_YEARS,
  MIN_HORIZON_YEARS,
  projectNetWorth
} from "@/features/planner/calculator";
import type { PlanInputs, ProjectionPoint } from "@/features/planner/types";

const FIXED_NOW = new Date("2026-06-15T00:00:00Z");

const money = (actual: number, expected: number, tolerance = 0.01) => {
  expect(Math.abs(actual - expected)).toBeLessThan(tolerance);
};

const BASE_INPUTS: PlanInputs = {
  name: "Test",
  dateOfBirth: "1990-01-01",
  startAssets: 100_000,
  startDebt: 0,
  monthlySpending: 1_000,
  annualIncome: 50_000,
  rentalIncome: 0,
  rentalIncomeRate: 0,
  windfallAmount: 0,
  windfallYear: 0,
  nominalReturn: 0.05,
  inflationRate: 0,
  horizonYears: 30,
  cashBalance: 0,
  nonLiquidInvestments: 0,
  otherFixedAssets: 0,
  primaryResidenceValue: 0,
  otherPropertyValue: 0,
  primaryResidenceRate: 0,
  otherPropertyRate: 0
};

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
        primaryResidenceValue: 400_000,
        otherPropertyValue: 150_000,
        startDebt: 80_000
      },
      FIXED_NOW
    );
    expect(points[0].netWorth).toBe(100_000 + 25_000 + 50_000 + 10_000 + 400_000 + 150_000 - 80_000);
  });

  it("compounds primary residence at its own rate and ignores spending shortfalls", () => {
    // No income, no cash, no starting assets, no return — only a pure −120k/yr drag
    // on financial assets. Residence must still compound at 4% and contribute fully.
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        cashBalance: 0,
        annualIncome: 0,
        monthlySpending: 10_000,
        nominalReturn: 0,
        primaryResidenceValue: 500_000,
        primaryResidenceRate: 0.04
      },
      FIXED_NOW
    );
    const residenceAt10 = 500_000 * 1.04 ** 10;
    const assetsAt10 = -10_000 * 12 * 10;
    money(points[10].netWorth, residenceAt10 + assetsAt10, 0.5);
  });

  it("grows primary residence and other property at independent rates", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        annualIncome: 0,
        monthlySpending: 0,
        primaryResidenceValue: 100_000,
        primaryResidenceRate: 0.02,
        otherPropertyValue: 100_000,
        otherPropertyRate: 0.05
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
    // Year 0 and every subsequent year: assets stay at 100k (afterReturn + 0),
    // cash stays at 50k, NW = 150k at every point.
    for (const p of points) {
      expect(p.netWorth).toBe(150_000);
    }
  });

  it("does not draw down residence or other property during deep shortfall", () => {
    // Zero cash, zero assets, zero income, spending > 0. Residence and other
    // property must still compound; assets may go negative, but the property
    // buckets must equal their deterministic compounded values.
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        cashBalance: 0,
        annualIncome: 0,
        monthlySpending: 2_000,
        nominalReturn: 0,
        primaryResidenceValue: 300_000,
        primaryResidenceRate: 0.03,
        otherPropertyValue: 200_000,
        otherPropertyRate: 0.02
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
    // Year 0: assets 0, no NW. Year 1: rental 20k compounds (rate 0) → 20k added to assets.
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
    // Year 1: rental grows once to 11k → assets 11k.
    // Year 2: rental grows to 12.1k → assets 11k + 12.1k = 23.1k.
    // Year 3: rental 13.31k → assets 36.41k.
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

  it("deposits the windfall into the investment portfolio on the matching calendar year", () => {
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        cashBalance: 0,
        annualIncome: 0,
        monthlySpending: 0,
        nominalReturn: 0,
        windfallAmount: 100_000,
        windfallYear: FIXED_NOW.getFullYear() + 3
      },
      FIXED_NOW
    );
    // Years 0..2: nothing happens.
    for (let i = 0; i <= 2; i += 1) expect(points[i].netWorth).toBe(0);
    // Year 3: windfall lands. Year 4+: stays in assets (no return, no flows).
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
        windfallAmount: 100_000,
        windfallYear: FIXED_NOW.getFullYear() + 2
      },
      FIXED_NOW
    );
    // Year 2: windfall lands at year-end → 100k.
    // Year 3: 100k * 1.1 = 110k. Year 4: 121k.
    money(points[2].netWorth, 100_000);
    money(points[3].netWorth, 110_000);
    money(points[4].netWorth, 121_000);
  });

  it("ignores a windfall year outside the projection horizon", () => {
    const before = projectNetWorth(
      {
        ...BASE_INPUTS,
        horizonYears: MIN_HORIZON_YEARS,
        windfallAmount: 100_000,
        windfallYear: FIXED_NOW.getFullYear() - 5
      },
      FIXED_NOW
    );
    const after = projectNetWorth(
      {
        ...BASE_INPUTS,
        horizonYears: MIN_HORIZON_YEARS,
        windfallAmount: 100_000,
        windfallYear: FIXED_NOW.getFullYear() + MIN_HORIZON_YEARS + 5
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
        windfallAmount: 0,
        windfallYear: FIXED_NOW.getFullYear() + 5
      },
      FIXED_NOW
    );
    const without = projectNetWorth(BASE_INPUTS, FIXED_NOW);
    for (let i = 0; i < without.length; i += 1) {
      money(withZero[i].netWorth, without[i].netWorth);
    }
  });

  it("lands the windfall in assets, not cash (cash unchanged for the windfall year)", () => {
    // Set up so netFlow = 0 every year (salary matches spending, no rental). Then
    // cashBalance is untouched by the flows; if the windfall ever went to cash it
    // would raise NW starting at the windfall year by less than the full amount
    // (since cash has no return). Here we use nominalReturn = 0 and a cash
    // starting balance so we can assert cash stays exactly at its start value
    // for every projection year.
    const points = projectNetWorth(
      {
        ...BASE_INPUTS,
        startAssets: 0,
        cashBalance: 50_000,
        annualIncome: 12_000,
        monthlySpending: 1_000,
        nominalReturn: 0,
        windfallAmount: 25_000,
        windfallYear: FIXED_NOW.getFullYear() + 4
      },
      FIXED_NOW
    );
    // Year 0..3: only cash (50k), assets 0.
    for (let i = 0; i <= 3; i += 1) expect(points[i].netWorth).toBe(50_000);
    // Year 4: windfall lands in assets. Cash still 50k, assets now 25k.
    expect(points[4].netWorth).toBe(75_000);
    // Year 5: no return, no flow change → stays at 75k.
    expect(points[5].netWorth).toBe(75_000);
  });

  it("excludes rental income from direct net-worth contribution", () => {
    // Rental income only flows through assets via the netFlow equation. If it
    // were added directly, year 0 NW would already reflect it (spoiler: it
    // shouldn't).
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
        primaryResidenceValue: 100_000,
        primaryResidenceRate: 0.1,
        otherPropertyValue: 100_000,
        otherPropertyRate: 0,
        startDebt: 50_000,
        annualIncome: 0,
        monthlySpending: 1_000,
        nominalReturn: 0.1
      },
      FIXED_NOW
    );
    // Year 0: 100 + 100 + 10 + 100 + 5 + 5 - 50 = 270k
    expect(points[0].netWorth).toBe(270_000);
    // Year 1: residence 110k, other 100k, afterReturn 110k, shortfall 12k drains
    // cash 10k → 0 and pulls 2k from assets → 108k. NW = 110+100+0+108+5+5-50 = 278k
    money(points[1].netWorth, 278_000);
    // Year 2: residence 121k, other 100k, afterReturn 118.8k, shortfall 12k all
    // from assets → 106.8k. NW = 121+100+0+106.8+5+5-50 = 287.8k
    money(points[2].netWorth, 287_800);
  });

  it("inflates salary and spending when inflationRate > 0", () => {
    // No return, no existing assets, pure flows. With inflation 2%, year 1
    // salary is 50_000 * 1.02 and spending is 12_000 * 1.02. netFlow =
    // 38_000 * 1.02 = 38_760. Without inflation (rate 0) it would be 38_000.
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
    // Cash is nominal and does not inflate. With no other flows and no return,
    // netWorth must equal starting cash at every year regardless of inflation.
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
        windfallAmount: 100_000,
        windfallYear: FIXED_NOW.getFullYear() + 10
      },
      FIXED_NOW
    );
    const expected = 100_000 * (1 + inflationRate) ** 10;
    money(points[10].netWorth, expected, 0.5);
  });
});

describe("deflateToToday", () => {
  const mk = (year: number, netWorth: number): ProjectionPoint => ({
    year,
    age: 40 + (year - 2026),
    netWorth
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
});
