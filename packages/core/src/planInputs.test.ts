import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAN_INPUTS,
  LifeEventSchema,
  PlanInputsSchema,
  RealEstateHoldingSchema,
  RealEstateInvestmentEventSchema,
  WindfallEventSchema,
  makeDefaultRealEstateHolding,
  makeDefaultRealEstateInvestment,
  makeDefaultWindfallEvent
} from "./planInputs";

describe("PlanInputsSchema", () => {
  it("accepts the default plan inputs", () => {
    expect(() => PlanInputsSchema.parse(DEFAULT_PLAN_INPUTS)).not.toThrow();
  });

  it("rejects a malformed dateOfBirth", () => {
    const bad = { ...DEFAULT_PLAN_INPUTS, dateOfBirth: "not-a-date" };
    expect(() => PlanInputsSchema.parse(bad)).toThrow();
  });

  it("rejects negative monetary fields", () => {
    const bad = { ...DEFAULT_PLAN_INPUTS, startAssets: -1 };
    expect(() => PlanInputsSchema.parse(bad)).toThrow();
  });

  it("rejects a horizon below MIN_HORIZON_YEARS", () => {
    const bad = { ...DEFAULT_PLAN_INPUTS, horizonYears: 9 };
    expect(() => PlanInputsSchema.parse(bad)).toThrow();
  });

  it("rejects a horizon above MAX_HORIZON_YEARS", () => {
    const bad = { ...DEFAULT_PLAN_INPUTS, horizonYears: 81 };
    expect(() => PlanInputsSchema.parse(bad)).toThrow();
  });

  it("rejects non-finite numbers", () => {
    const bad = { ...DEFAULT_PLAN_INPUTS, nominalReturn: Number.POSITIVE_INFINITY };
    expect(() => PlanInputsSchema.parse(bad)).toThrow();
  });

  it("rejects an unknown debtRepaymentType", () => {
    const bad = { ...DEFAULT_PLAN_INPUTS, debtRepaymentType: "monthly" };
    expect(() => PlanInputsSchema.parse(bad)).toThrow();
  });

  it("rejects a negative debtInterestRate", () => {
    const bad = { ...DEFAULT_PLAN_INPUTS, debtInterestRate: -0.01 };
    expect(() => PlanInputsSchema.parse(bad)).toThrow();
  });

  it("rejects a debtInterestRate above the max", () => {
    const bad = { ...DEFAULT_PLAN_INPUTS, debtInterestRate: 0.21 };
    expect(() => PlanInputsSchema.parse(bad)).toThrow();
  });

  it("rejects a retirementAge below the minimum", () => {
    const bad = { ...DEFAULT_PLAN_INPUTS, retirementAge: 17 };
    expect(() => PlanInputsSchema.parse(bad)).toThrow();
  });

  it("rejects a retirementAge above the maximum", () => {
    const bad = { ...DEFAULT_PLAN_INPUTS, retirementAge: 101 };
    expect(() => PlanInputsSchema.parse(bad)).toThrow();
  });

  it("strips unknown fields by default (type is a structural superset)", () => {
    // Zod's default behavior is to strip unknown keys, so this is a sanity check
    // that the schema doesn't blow up when legacy localStorage payloads carry
    // extra fields from a future version.
    const withExtra = { ...DEFAULT_PLAN_INPUTS, extraField: "ignored" };
    const parsed = PlanInputsSchema.parse(withExtra);
    expect(parsed).not.toHaveProperty("extraField");
  });

  it("defaults to an empty events array", () => {
    expect(DEFAULT_PLAN_INPUTS.events).toEqual([]);
  });

  it("accepts a plan with one real estate investment event", () => {
    const event = makeDefaultRealEstateInvestment();
    const inputs = { ...DEFAULT_PLAN_INPUTS, events: [event] };
    expect(() => PlanInputsSchema.parse(inputs)).not.toThrow();
  });

  it("accepts a plan with one windfall event", () => {
    const event = makeDefaultWindfallEvent();
    const inputs = { ...DEFAULT_PLAN_INPUTS, events: [event] };
    expect(() => PlanInputsSchema.parse(inputs)).not.toThrow();
  });

  it("accepts a plan mixing windfall and real estate investment events", () => {
    const inputs = {
      ...DEFAULT_PLAN_INPUTS,
      events: [makeDefaultWindfallEvent(), makeDefaultRealEstateInvestment()]
    };
    expect(() => PlanInputsSchema.parse(inputs)).not.toThrow();
  });

  it("rejects a non-array events field", () => {
    const bad = { ...DEFAULT_PLAN_INPUTS, events: "nope" };
    expect(() => PlanInputsSchema.parse(bad)).toThrow();
  });

  it("defaults to an empty realEstateHoldings array", () => {
    expect(DEFAULT_PLAN_INPUTS.realEstateHoldings).toEqual([]);
  });

  it("accepts a plan with one real estate holding", () => {
    const holding = makeDefaultRealEstateHolding();
    const inputs = { ...DEFAULT_PLAN_INPUTS, realEstateHoldings: [holding] };
    expect(() => PlanInputsSchema.parse(inputs)).not.toThrow();
  });

  it("rejects a non-array realEstateHoldings field", () => {
    const bad = { ...DEFAULT_PLAN_INPUTS, realEstateHoldings: "nope" };
    expect(() => PlanInputsSchema.parse(bad)).toThrow();
  });
});

describe("RealEstateInvestmentEventSchema", () => {
  const valid = makeDefaultRealEstateInvestment();

  it("accepts a freshly-built default event", () => {
    expect(() => RealEstateInvestmentEventSchema.parse(valid)).not.toThrow();
  });

  it("rejects a missing id", () => {
    const { id: _id, ...rest } = valid;
    expect(() => RealEstateInvestmentEventSchema.parse(rest)).toThrow();
  });

  it("rejects an empty id", () => {
    expect(() =>
      RealEstateInvestmentEventSchema.parse({ ...valid, id: "" })
    ).toThrow();
  });

  it("rejects a wrong type literal", () => {
    expect(() =>
      RealEstateInvestmentEventSchema.parse({ ...valid, type: "lottery" })
    ).toThrow();
  });

  it("rejects a negative purchaseAmount", () => {
    expect(() =>
      RealEstateInvestmentEventSchema.parse({ ...valid, purchaseAmount: -1 })
    ).toThrow();
  });

  it("rejects a non-integer purchaseYear", () => {
    expect(() =>
      RealEstateInvestmentEventSchema.parse({ ...valid, purchaseYear: 2030.5 })
    ).toThrow();
  });

  it("rejects an appreciationRate outside the global rate bounds", () => {
    expect(() =>
      RealEstateInvestmentEventSchema.parse({ ...valid, appreciationRate: 5 })
    ).toThrow();
    expect(() =>
      RealEstateInvestmentEventSchema.parse({ ...valid, appreciationRate: -5 })
    ).toThrow();
  });

  it("rejects a non-finite rentalIncomeRate", () => {
    expect(() =>
      RealEstateInvestmentEventSchema.parse({
        ...valid,
        rentalIncomeRate: Number.NaN
      })
    ).toThrow();
  });
});

describe("LifeEventSchema", () => {
  it("discriminates a real estate investment by type", () => {
    const re = makeDefaultRealEstateInvestment();
    const parsed = LifeEventSchema.parse(re);
    expect(parsed.type).toBe("realEstateInvestment");
  });

  it("discriminates a windfall by type", () => {
    const wf = makeDefaultWindfallEvent();
    const parsed = LifeEventSchema.parse(wf);
    expect(parsed.type).toBe("windfall");
  });

  it("rejects an unknown type variant", () => {
    expect(() =>
      LifeEventSchema.parse({
        id: "x",
        type: "lottery",
        amount: 1
      })
    ).toThrow();
  });
});

describe("makeDefaultRealEstateInvestment", () => {
  it("produces a unique id on every call", () => {
    const a = makeDefaultRealEstateInvestment();
    const b = makeDefaultRealEstateInvestment();
    expect(a.id).not.toBe(b.id);
  });

  it("seeds the purchase year five years from now", () => {
    const event = makeDefaultRealEstateInvestment();
    expect(event.purchaseYear).toBe(new Date().getFullYear() + 5);
  });

  it("defaults both rates to 0 so a fresh card reads as a blank slate", () => {
    const event = makeDefaultRealEstateInvestment();
    expect(event.appreciationRate).toBe(0);
    expect(event.rentalIncomeRate).toBe(0);
  });
});

describe("RealEstateHoldingSchema", () => {
  const valid = makeDefaultRealEstateHolding();

  it("accepts a freshly-built default holding", () => {
    expect(() => RealEstateHoldingSchema.parse(valid)).not.toThrow();
  });

  it("rejects a missing id", () => {
    const { id: _id, ...rest } = valid;
    expect(() => RealEstateHoldingSchema.parse(rest)).toThrow();
  });

  it("rejects an empty id", () => {
    expect(() =>
      RealEstateHoldingSchema.parse({ ...valid, id: "" })
    ).toThrow();
  });

  it("rejects a wrong type literal", () => {
    expect(() =>
      RealEstateHoldingSchema.parse({ ...valid, type: "realEstateInvestment" })
    ).toThrow();
  });

  it("rejects a negative value", () => {
    expect(() =>
      RealEstateHoldingSchema.parse({ ...valid, value: -1 })
    ).toThrow();
  });

  it("rejects a non-finite value", () => {
    expect(() =>
      RealEstateHoldingSchema.parse({ ...valid, value: Number.POSITIVE_INFINITY })
    ).toThrow();
  });

  it("rejects an appreciationRate outside the global rate bounds", () => {
    expect(() =>
      RealEstateHoldingSchema.parse({ ...valid, appreciationRate: 5 })
    ).toThrow();
    expect(() =>
      RealEstateHoldingSchema.parse({ ...valid, appreciationRate: -5 })
    ).toThrow();
  });
});

describe("makeDefaultRealEstateHolding", () => {
  it("produces a unique id on every call", () => {
    const a = makeDefaultRealEstateHolding();
    const b = makeDefaultRealEstateHolding();
    expect(a.id).not.toBe(b.id);
  });

  it("defaults value and rate to 0 so a fresh card reads as a blank slate", () => {
    const holding = makeDefaultRealEstateHolding();
    expect(holding.value).toBe(0);
    expect(holding.appreciationRate).toBe(0);
  });

  it("uses the realEstateHolding type discriminator", () => {
    expect(makeDefaultRealEstateHolding().type).toBe("realEstateHolding");
  });
});

describe("WindfallEventSchema", () => {
  const valid = makeDefaultWindfallEvent();

  it("accepts a freshly-built default event", () => {
    expect(() => WindfallEventSchema.parse(valid)).not.toThrow();
  });

  it("rejects a missing id", () => {
    const { id: _id, ...rest } = valid;
    expect(() => WindfallEventSchema.parse(rest)).toThrow();
  });

  it("rejects an empty id", () => {
    expect(() => WindfallEventSchema.parse({ ...valid, id: "" })).toThrow();
  });

  it("rejects a wrong type literal", () => {
    expect(() =>
      WindfallEventSchema.parse({ ...valid, type: "realEstateInvestment" })
    ).toThrow();
  });

  it("rejects a negative amount", () => {
    expect(() => WindfallEventSchema.parse({ ...valid, amount: -1 })).toThrow();
  });

  it("rejects a non-finite amount", () => {
    expect(() =>
      WindfallEventSchema.parse({ ...valid, amount: Number.POSITIVE_INFINITY })
    ).toThrow();
  });

  it("rejects a non-integer year", () => {
    expect(() =>
      WindfallEventSchema.parse({ ...valid, year: 2030.5 })
    ).toThrow();
  });
});

describe("makeDefaultWindfallEvent", () => {
  it("produces a unique id on every call", () => {
    const a = makeDefaultWindfallEvent();
    const b = makeDefaultWindfallEvent();
    expect(a.id).not.toBe(b.id);
  });

  it("seeds the year five years from now", () => {
    const event = makeDefaultWindfallEvent();
    expect(event.year).toBe(new Date().getFullYear() + 5);
  });

  it("defaults amount to 0 so a fresh card reads as a blank slate", () => {
    expect(makeDefaultWindfallEvent().amount).toBe(0);
  });

  it("uses the windfall type discriminator", () => {
    expect(makeDefaultWindfallEvent().type).toBe("windfall");
  });
});
