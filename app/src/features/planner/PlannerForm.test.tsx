import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlannerForm } from "./PlannerForm";
import { DEFAULT_PLAN_INPUTS, type PlanInputs } from "./types";
import { CurrencyProvider } from "@/features/currency/CurrencyContext";

function Host({ onReset = vi.fn() }: { onReset?: () => void } = {}) {
  const [value, setValue] = useState<PlanInputs>(DEFAULT_PLAN_INPUTS);
  return (
    <CurrencyProvider>
      <PlannerForm value={value} onChange={setValue} onReset={onReset} />
    </CurrencyProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("PlannerForm layout", () => {
  it("renders the three top-level category headings", () => {
    render(<Host />);
    expect(screen.getByText("Assets and Debt")).toBeInTheDocument();
    expect(screen.getByText("Income & Expenses")).toBeInTheDocument();
    expect(screen.getByText("Real Estate")).toBeInTheDocument();
  });

  it("no longer renders a 'Financial' category heading", () => {
    render(<Host />);
    expect(screen.queryByText("Financial")).toBeNull();
  });

  it("groups Liquid / Non-Liquid / Debt inside Assets and Debt with the right fields", () => {
    render(<Host />);
    const assets = screen.getByText("Assets and Debt").closest("fieldset")!;

    const liquid = within(assets).getByTestId("subsection-liquid");
    expect(within(liquid).getByText("Liquid")).toBeInTheDocument();
    expect(within(liquid).getByLabelText("Financial Assets / Portfolio")).toBeInTheDocument();
    expect(within(liquid).getByLabelText("Cash Balance")).toBeInTheDocument();
    expect(within(liquid).getByText("Expected annual return")).toBeInTheDocument();

    const nonLiquid = within(assets).getByTestId("subsection-non-liquid");
    expect(within(nonLiquid).getByText("Non-Liquid")).toBeInTheDocument();
    expect(within(nonLiquid).getByLabelText("Private Equity")).toBeInTheDocument();
    expect(within(nonLiquid).getByLabelText("Other Fixed Assets")).toBeInTheDocument();

    const debt = within(assets).getByTestId("subsection-debt");
    // The subsection header and the field label both read "Debt", so we target
    // the input via its accessible name and rely on the testid to confirm the
    // subsection itself renders.
    expect(within(debt).getByLabelText("Debt")).toBeInTheDocument();
  });

  it("renders every Income & Expenses field including the new ones", () => {
    render(<Host />);
    const fs = screen.getByText("Income & Expenses").closest("fieldset")!;
    expect(within(fs).getByLabelText("Annual Salary")).toBeInTheDocument();
    expect(within(fs).getByLabelText("Annual Rental Income")).toBeInTheDocument();
    expect(within(fs).getByText("Rental income annual appreciation")).toBeInTheDocument();
    expect(within(fs).getByLabelText("Windfall amount")).toBeInTheDocument();
    expect(within(fs).getByLabelText("Windfall year")).toBeInTheDocument();
    expect(within(fs).getByLabelText("Recurring monthly expenses")).toBeInTheDocument();
  });

  it("renders every Real Estate field and both appreciation sliders inside the category", () => {
    render(<Host />);
    const realEstate = screen.getByText("Real Estate").closest("fieldset")!;
    expect(within(realEstate).getByLabelText("Primary Residence value")).toBeInTheDocument();
    expect(within(realEstate).getByLabelText("Other Property value")).toBeInTheDocument();
    expect(within(realEstate).getAllByText("Annual appreciation rate")).toHaveLength(2);
  });

  it("keeps the Projection horizon slider outside all three categories", () => {
    render(<Host />);
    const horizonLabel = screen.getByText("Projection horizon");
    expect(horizonLabel.closest("fieldset")).toBeNull();
  });

  it("no longer renders the Name field on the planner page", () => {
    render(<Host />);
    expect(screen.queryByLabelText("Name")).toBeNull();
  });

  it("updates the Cash Balance field when the user types", async () => {
    const user = userEvent.setup();
    render(<Host />);
    const field = screen.getByLabelText("Cash Balance") as HTMLInputElement;
    await user.clear(field);
    await user.type(field, "75000");
    expect(field.value).toBe("75,000");
  });

  it("updates the Windfall year field when the user types", async () => {
    const user = userEvent.setup();
    render(<Host />);
    const field = screen.getByLabelText("Windfall year") as HTMLInputElement;
    await user.clear(field);
    await user.type(field, "2045");
    expect(field.value).toBe("2045");
  });

  it("invokes onReset when the reset button is clicked", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<Host onReset={onReset} />);
    await user.click(screen.getByRole("button", { name: /reset to defaults/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
