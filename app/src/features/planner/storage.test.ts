import { afterEach, describe, expect, it, vi } from "vitest";
import { clearInputs, loadInputs, saveInputs } from "@/features/planner/storage";
import { DEFAULT_PLAN_INPUTS } from "@app/core";

type FakeStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function stubStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  const storage: FakeStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    }
  };
  vi.stubGlobal("window", { localStorage: storage });
  return store;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadInputs", () => {
  it("returns defaults when nothing is stored", () => {
    stubStorage();
    expect(loadInputs()).toEqual(DEFAULT_PLAN_INPUTS);
  });

  it("fills missing fields with defaults when loading partial payloads", () => {
    const legacy = JSON.stringify({ name: "Jeff", startAssets: 50_000 });
    stubStorage({ "planner.inputs.v1": legacy });

    const loaded = loadInputs();

    expect(loaded.name).toBe("Jeff");
    expect(loaded.startAssets).toBe(50_000);
    expect(loaded.horizonYears).toBe(DEFAULT_PLAN_INPUTS.horizonYears);
    expect(loaded.nominalReturn).toBe(DEFAULT_PLAN_INPUTS.nominalReturn);
    expect(loaded.dateOfBirth).toBe(DEFAULT_PLAN_INPUTS.dateOfBirth);
  });

  it("returns defaults when stored JSON is corrupt", () => {
    stubStorage({ "planner.inputs.v1": "{ not json" });
    expect(loadInputs()).toEqual(DEFAULT_PLAN_INPUTS);
  });

  it("loads a legacy plan with global rentalIncome / rentalIncomeRate harmlessly", () => {
    // Pre-Task-2 plans persisted `rentalIncome` and `rentalIncomeRate` at
    // the top of PlanInputs. After the clean break the engine no longer
    // reads them. The user's other settings (and per-holding rental, if
    // any) survive untouched; the projection ignores the orphaned keys.
    const legacy = JSON.stringify({
      ...DEFAULT_PLAN_INPUTS,
      rentalIncome: 24_000,
      rentalIncomeRate: 0.03,
      annualIncome: 80_000,
      monthlySpending: 2_000
    });
    stubStorage({ "planner.inputs.v1": legacy });

    const loaded = loadInputs();
    expect(loaded.annualIncome).toBe(80_000);
    expect(loaded.monthlySpending).toBe(2_000);
    // realEstateHoldings stays at default ([]); legacy global rental
    // contributes nothing to the new per-holding wiring.
    expect(loaded.realEstateHoldings).toEqual([]);
  });

  it("hydrates a legacy plan (no events field) with an empty events array", () => {
    // Snapshot of a real legacy payload: every PlanInputs field but `events`.
    const legacy = JSON.stringify({
      ...DEFAULT_PLAN_INPUTS,
      events: undefined
    });
    stubStorage({ "planner.inputs.v1": legacy });

    expect(loadInputs().events).toEqual([]);
  });

  it("preserves a valid stored events array on load", () => {
    // Stored payload predates the inflateAmount toggle (Task 6) AND the
    // editable per-card label — Zod applies the schema-level
    // `.default(true)` and `.default("")` so the loaded event carries
    // the historical inflate-to-landing-year behavior and an empty
    // label that the form will render as the auto-numbered fallback.
    const validEvent = {
      id: "abc",
      type: "realEstateInvestment",
      purchaseAmount: 100_000,
      purchaseYear: 2030,
      appreciationRate: 0.03,
      annualRentalIncome: 12_000,
      rentalIncomeRate: 0.02
    };
    const stored = JSON.stringify({ ...DEFAULT_PLAN_INPUTS, events: [validEvent] });
    stubStorage({ "planner.inputs.v1": stored });

    expect(loadInputs().events).toEqual([
      { ...validEvent, inflateAmount: true, label: "" }
    ]);
  });

  it("preserves a valid stored windfall event on load", () => {
    // Round-trip the second LifeEvent variant through the same defensive
    // EventsSchema parse the storage layer applies on load. Legacy stored
    // events without inflateAmount hydrate with the schema default.
    const windfall = {
      id: "wf-1",
      type: "windfall",
      amount: 50_000,
      year: 2031
    };
    const stored = JSON.stringify({
      ...DEFAULT_PLAN_INPUTS,
      events: [windfall]
    });
    stubStorage({ "planner.inputs.v1": stored });

    expect(loadInputs().events).toEqual([
      { ...windfall, inflateAmount: true, label: "" }
    ]);
  });

  it("preserves a mix of windfall and realEstateInvestment events on load", () => {
    const windfall = { id: "wf-1", type: "windfall", amount: 25_000, year: 2030 };
    const reInvestment = {
      id: "re-1",
      type: "realEstateInvestment",
      purchaseAmount: 200_000,
      purchaseYear: 2032,
      appreciationRate: 0.02,
      annualRentalIncome: 6_000,
      rentalIncomeRate: 0.01
    };
    const stored = JSON.stringify({
      ...DEFAULT_PLAN_INPUTS,
      events: [windfall, reInvestment]
    });
    stubStorage({ "planner.inputs.v1": stored });

    expect(loadInputs().events).toEqual([
      { ...windfall, inflateAmount: true, label: "" },
      { ...reInvestment, inflateAmount: true, label: "" }
    ]);
  });

  it("preserves a valid stored newDebt event on load", () => {
    const newDebt = {
      id: "nd-1",
      type: "newDebt",
      principal: 200_000,
      interestRate: 0.04,
      repaymentType: "overTime",
      startYear: 2030,
      endYear: 2040
    };
    const stored = JSON.stringify({
      ...DEFAULT_PLAN_INPUTS,
      events: [newDebt]
    });
    stubStorage({ "planner.inputs.v1": stored });

    expect(loadInputs().events).toEqual([
      { ...newDebt, inflateAmount: true, label: "" }
    ]);
  });

  it("preserves a mix of all three life event variants on load", () => {
    const windfall = { id: "wf-1", type: "windfall", amount: 25_000, year: 2030 };
    const reInvestment = {
      id: "re-1",
      type: "realEstateInvestment",
      purchaseAmount: 200_000,
      purchaseYear: 2032,
      appreciationRate: 0.02,
      annualRentalIncome: 6_000,
      rentalIncomeRate: 0.01
    };
    const newDebt = {
      id: "nd-1",
      type: "newDebt",
      principal: 100_000,
      interestRate: 0.03,
      repaymentType: "inFine",
      startYear: 2031,
      endYear: 2036
    };
    const stored = JSON.stringify({
      ...DEFAULT_PLAN_INPUTS,
      events: [windfall, reInvestment, newDebt]
    });
    stubStorage({ "planner.inputs.v1": stored });

    expect(loadInputs().events).toEqual([
      { ...windfall, inflateAmount: true, label: "" },
      { ...reInvestment, inflateAmount: true, label: "" },
      { ...newDebt, inflateAmount: true, label: "" }
    ]);
  });

  it("hydrates legacy events without inflateAmount with the historical default (true)", () => {
    // Pre-Task-6 stored events had no `inflateAmount` field. The schema
    // applies `.default(true)` so they hydrate to the historical
    // inflate-to-landing-year behavior without losing the user's other
    // settings.
    const legacyWindfall = { id: "wf-1", type: "windfall", amount: 25_000, year: 2030 };
    const legacyReInvestment = {
      id: "re-1",
      type: "realEstateInvestment",
      purchaseAmount: 200_000,
      purchaseYear: 2032,
      appreciationRate: 0.02,
      annualRentalIncome: 6_000,
      rentalIncomeRate: 0.01
    };
    const legacyNewDebt = {
      id: "nd-1",
      type: "newDebt",
      principal: 100_000,
      interestRate: 0.03,
      repaymentType: "inFine",
      startYear: 2031,
      endYear: 2036
    };
    const stored = JSON.stringify({
      ...DEFAULT_PLAN_INPUTS,
      events: [legacyWindfall, legacyReInvestment, legacyNewDebt]
    });
    stubStorage({ "planner.inputs.v1": stored });

    const loaded = loadInputs();
    expect(loaded.events).toHaveLength(3);
    for (const e of loaded.events) {
      expect((e as { inflateAmount: boolean }).inflateAmount).toBe(true);
    }
  });

  it("preserves an explicit inflateAmount=false on a stored event", () => {
    const explicit = {
      id: "wf-1",
      type: "windfall",
      amount: 50_000,
      year: 2031,
      inflateAmount: false
    };
    const stored = JSON.stringify({
      ...DEFAULT_PLAN_INPUTS,
      events: [explicit]
    });
    stubStorage({ "planner.inputs.v1": stored });

    expect(loadInputs().events).toEqual([{ ...explicit, label: "" }]);
  });

  it("falls back to [] when stored events array is malformed (keeps other fields)", () => {
    const stored = JSON.stringify({
      ...DEFAULT_PLAN_INPUTS,
      startAssets: 250_000,
      events: [{ id: "x", type: "unknown", garbage: true }]
    });
    stubStorage({ "planner.inputs.v1": stored });

    const loaded = loadInputs();
    expect(loaded.events).toEqual([]);
    expect(loaded.startAssets).toBe(250_000);
  });

  it("hydrates a legacy plan (no realEstateHoldings field) with an empty holdings array", () => {
    // Mirrors the legacy-events case: a payload predating realEstateHoldings
    // (or saved with the old primaryResidence/otherProperty shape) hydrates
    // to [] without losing the user's other settings.
    const legacy = JSON.stringify({
      ...DEFAULT_PLAN_INPUTS,
      realEstateHoldings: undefined
    });
    stubStorage({ "planner.inputs.v1": legacy });

    expect(loadInputs().realEstateHoldings).toEqual([]);
  });

  it("preserves a valid stored realEstateHoldings array on load", () => {
    const validHolding = {
      id: "h1",
      type: "realEstateHolding",
      value: 450_000,
      appreciationRate: 0.025,
      annualRentalIncome: 18_000,
      rentalIncomeRate: 0.02
    };
    const stored = JSON.stringify({
      ...DEFAULT_PLAN_INPUTS,
      realEstateHoldings: [validHolding]
    });
    stubStorage({ "planner.inputs.v1": stored });

    expect(loadInputs().realEstateHoldings).toEqual([
      { ...validHolding, label: "" }
    ]);
  });

  it("falls back to [] when stored realEstateHoldings is malformed (keeps other fields)", () => {
    const stored = JSON.stringify({
      ...DEFAULT_PLAN_INPUTS,
      startAssets: 250_000,
      realEstateHoldings: [{ id: "x", type: "unknown", garbage: true }]
    });
    stubStorage({ "planner.inputs.v1": stored });

    const loaded = loadInputs();
    expect(loaded.realEstateHoldings).toEqual([]);
    expect(loaded.startAssets).toBe(250_000);
  });
});

describe("saveInputs and clearInputs", () => {
  it("persists inputs and reads them back", () => {
    stubStorage();
    const updated = { ...DEFAULT_PLAN_INPUTS, name: "Jeff", horizonYears: 45 };
    saveInputs(updated);
    expect(loadInputs()).toEqual(updated);
  });

  it("clears stored inputs", () => {
    stubStorage();
    saveInputs({ ...DEFAULT_PLAN_INPUTS, name: "Jeff" });
    clearInputs();
    expect(loadInputs()).toEqual(DEFAULT_PLAN_INPUTS);
  });
});
