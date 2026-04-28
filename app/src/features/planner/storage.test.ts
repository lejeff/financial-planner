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

    expect(loadInputs().events).toEqual([validEvent]);
  });

  it("preserves a valid stored windfall event on load", () => {
    // Round-trip the second LifeEvent variant through the same defensive
    // EventsSchema parse the storage layer applies on load.
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

    expect(loadInputs().events).toEqual([windfall]);
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

    expect(loadInputs().events).toEqual([windfall, reInvestment]);
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

    expect(loadInputs().realEstateHoldings).toEqual([validHolding]);
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
