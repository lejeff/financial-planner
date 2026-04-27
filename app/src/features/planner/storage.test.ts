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
