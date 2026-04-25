import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN_INPUTS, PlanInputsSchema } from "./planInputs";

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

  it("strips unknown fields by default (type is a structural superset)", () => {
    // Zod's default behavior is to strip unknown keys, so this is a sanity check
    // that the schema doesn't blow up when legacy localStorage payloads carry
    // extra fields from a future version.
    const withExtra = { ...DEFAULT_PLAN_INPUTS, extraField: "ignored" };
    const parsed = PlanInputsSchema.parse(withExtra);
    expect(parsed).not.toHaveProperty("extraField");
  });
});
