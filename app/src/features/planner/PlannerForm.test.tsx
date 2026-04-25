import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlannerForm } from "./PlannerForm";
import { DEFAULT_PLAN_INPUTS, type PlanInputs } from "@app/core";
import { CurrencyProvider } from "@/features/currency/CurrencyContext";

function Host({ onReset = vi.fn() }: { onReset?: () => void } = {}) {
  const [value, setValue] = useState<PlanInputs>(DEFAULT_PLAN_INPUTS);
  return (
    <CurrencyProvider>
      <PlannerForm value={value} onChange={setValue} onReset={onReset} />
    </CurrencyProvider>
  );
}

async function expand(name: RegExp | string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name }));
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

  it("groups Liquid / Non-Liquid / Debt inside Assets and Debt with the right fields", async () => {
    render(<Host />);
    const assets = screen.getByText("Assets and Debt").closest("fieldset")!;

    // Liquid is open by default.
    const liquid = within(assets).getByTestId("subsection-liquid");
    expect(within(liquid).getByText("Liquid")).toBeInTheDocument();
    expect(within(liquid).getByLabelText("Financial Assets / Portfolio")).toBeInTheDocument();
    expect(within(liquid).getByLabelText("Cash Balance")).toBeInTheDocument();
    expect(within(liquid).getByText("Expected annual return")).toBeInTheDocument();

    // Non-Liquid and Debt start collapsed — expand to inspect their fields.
    await expand(/non-liquid/i);
    const nonLiquid = within(assets).getByTestId("subsection-non-liquid");
    expect(within(nonLiquid).getByText("Non-Liquid")).toBeInTheDocument();
    expect(within(nonLiquid).getByLabelText("Private Equity")).toBeInTheDocument();
    expect(within(nonLiquid).getByLabelText("Other Fixed Assets")).toBeInTheDocument();

    await expand(/^debt$/i);
    const debt = within(assets).getByTestId("subsection-debt");
    // The subsection header and the field label both read "Debt"; rely on the
    // testid to scope to the subsection and the input's accessible name inside.
    expect(within(debt).getByLabelText("Debt")).toBeInTheDocument();
  });

  it("renders every Income & Expenses field including the new ones", async () => {
    render(<Host />);
    await expand(/income & expenses/i);
    const fs = screen.getByText("Income & Expenses").closest("fieldset")!;
    expect(within(fs).getByLabelText("Annual Salary")).toBeInTheDocument();
    expect(within(fs).getByLabelText("Annual Rental Income")).toBeInTheDocument();
    expect(within(fs).getByText("Rental income annual appreciation")).toBeInTheDocument();
    expect(within(fs).getByLabelText("Recurring monthly expenses")).toBeInTheDocument();
  });

  it("renders the Life Events fieldset with Windfall amount and year", async () => {
    render(<Host />);
    await expand(/life events/i);
    const fs = screen.getByText("Life Events").closest("fieldset")!;
    expect(within(fs).getByLabelText("Windfall amount")).toBeInTheDocument();
    expect(within(fs).getByLabelText("Windfall year")).toBeInTheDocument();
  });

  it("does not render Windfall fields inside Income & Expenses", async () => {
    render(<Host />);
    await expand(/income & expenses/i);
    const fs = screen.getByText("Income & Expenses").closest("fieldset")!;
    expect(within(fs).queryByLabelText("Windfall amount")).toBeNull();
    expect(within(fs).queryByLabelText("Windfall year")).toBeNull();
  });

  it("renders every Real Estate field and both appreciation sliders inside the category", async () => {
    render(<Host />);
    await expand(/real estate/i);
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

  it("renders the Inflation slider outside all three categories", () => {
    render(<Host />);
    const inflationLabel = screen.getByText("Inflation");
    expect(inflationLabel.closest("fieldset")).toBeNull();
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
    await expand(/life events/i);
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

  it("starts with Assets and Debt open and the other categories closed", () => {
    render(<Host />);
    expect(screen.getByRole("button", { name: /assets and debt/i })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByRole("button", { name: /income & expenses/i })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.getByRole("button", { name: /real estate/i })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.getByRole("button", { name: /life events/i })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("starts with Liquid open and Non-Liquid / Debt closed inside Assets and Debt", () => {
    render(<Host />);
    expect(screen.getByRole("button", { name: /^liquid$/i })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByRole("button", { name: /non-liquid/i })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.getByRole("button", { name: /^debt$/i })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("renders the new debt schedule controls inside the Debt subsection", async () => {
    render(<Host />);
    await expand(/^debt$/i);
    const debt = screen.getByTestId("subsection-debt");
    expect(within(debt).getByLabelText("Debt")).toBeInTheDocument();
    expect(within(debt).getByText("Annual interest rate")).toBeInTheDocument();
    expect(within(debt).getByLabelText("Repayment type")).toBeInTheDocument();
    // The end-year field's label depends on the repayment type; default is overTime.
    expect(within(debt).getByLabelText("Loan end year")).toBeInTheDocument();
    expect(within(debt).getByTestId("debt-schedule-summary")).toBeInTheDocument();
  });

  it("swaps the derived schedule text between Over Time and In Fine modes", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/^debt$/i);
    const debt = screen.getByTestId("subsection-debt");
    const summary = within(debt).getByTestId("debt-schedule-summary");
    expect(summary).toHaveTextContent(/Annual repayment \(capital \+ interest\)/);

    const select = within(debt).getByLabelText("Repayment type") as HTMLSelectElement;
    await user.selectOptions(select, "inFine");
    expect(summary).toHaveTextContent(/Annual interest payment/);
    expect(summary).toHaveTextContent(/Lump sum/);
    // The end-year field's label should also flip when switching to In Fine.
    expect(within(debt).getByLabelText("Lump sum repayment year")).toBeInTheDocument();
  });

  it("shows a no-debt summary when the principal is zero", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/^debt$/i);
    const debt = screen.getByTestId("subsection-debt");
    const debtField = within(debt).getByLabelText("Debt") as HTMLInputElement;
    await user.clear(debtField);
    await user.type(debtField, "0");
    await user.tab();
    expect(within(debt).getByTestId("debt-schedule-summary")).toHaveTextContent(
      /No outstanding debt/i
    );
  });

  it("toggles a category open and closed when the header is clicked", async () => {
    const user = userEvent.setup();
    render(<Host />);
    const btn = screen.getByRole("button", { name: /real estate/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    await user.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Primary Residence value")).toBeInTheDocument();
    await user.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Primary Residence value")).toBeNull();
  });
});
