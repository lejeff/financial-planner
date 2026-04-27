import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAN_INPUTS,
  LifeEventSchema,
  PlanInputsSchema,
  RealEstateInvestmentEventSchema,
  makeDefaultRealEstateInvestment
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

  it("rejects a non-array events field", () => {
    const bad = { ...DEFAULT_PLAN_INPUTS, events: "nope" };
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
      RealEstateInvestmentEventSchema.parse({ ...valid, type: "windfall" })
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
  it("discriminates by type", () => {
    const re = makeDefaultRealEstateInvestment();
    const parsed = LifeEventSchema.parse(re);
    expect(parsed.type).toBe("realEstateInvestment");
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
