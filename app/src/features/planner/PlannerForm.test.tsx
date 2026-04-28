import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
  it("renders all top-level category headings", () => {
    render(<Host />);
    expect(screen.getByText("About you")).toBeInTheDocument();
    expect(screen.getByText("Assets and Debt")).toBeInTheDocument();
    expect(screen.getByText("Income & Expenses")).toBeInTheDocument();
    expect(screen.getByText("Real Estate")).toBeInTheDocument();
    expect(screen.getByText("Life Events")).toBeInTheDocument();
    expect(screen.getByText("Macro assumptions")).toBeInTheDocument();
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

  it("renders an empty Real Estate category with only the Add button by default", async () => {
    render(<Host />);
    await expand(/real estate/i);
    const realEstate = screen.getByText("Real Estate").closest("fieldset")!;
    expect(within(realEstate).queryByTestId("re-holding-card-0")).toBeNull();
    expect(
      within(realEstate).getByRole("button", { name: /^\+ add real estate$/i })
    ).toBeInTheDocument();
  });

  it("renders the Projection horizon slider inside the About you fieldset", () => {
    render(<Host />);
    const aboutYou = screen.getByText("About you").closest("fieldset")!;
    expect(within(aboutYou).getByText("Projection horizon")).toBeInTheDocument();
    expect(within(aboutYou).getByLabelText("Date of birth")).toBeInTheDocument();
  });

  it("renders the Retirement age slider inside the About you fieldset", () => {
    render(<Host />);
    const aboutYou = screen.getByText("About you").closest("fieldset")!;
    expect(within(aboutYou).getByText("Retirement age")).toBeInTheDocument();
  });

  it("shows an About you summary mentioning the retirement age once collapsed", async () => {
    const user = userEvent.setup();
    render(<Host />);
    // About you starts open; collapse it so the summary pill renders.
    await user.click(screen.getByRole("button", { name: /about you/i }));
    expect(screen.getByText(/Retire at 65/)).toBeInTheDocument();
  });

  it("renders the Inflation slider inside the Macro assumptions category", async () => {
    render(<Host />);
    await expand(/macro assumptions/i);
    const macro = screen.getByText("Macro assumptions").closest("fieldset")!;
    expect(within(macro).getByText("Inflation")).toBeInTheDocument();
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

  it("moves the Windfall year slider", async () => {
    render(<Host />);
    await expand(/life events/i);
    const field = screen.getByLabelText("Windfall year") as HTMLInputElement;
    fireEvent.change(field, { target: { value: "2045" } });
    expect(field.value).toBe("2045");
  });

  it("invokes onReset when the reset button is clicked", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<Host onReset={onReset} />);
    await user.click(screen.getByRole("button", { name: /reset to defaults/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("starts with About you and Assets and Debt open and the other categories closed", () => {
    render(<Host />);
    expect(screen.getByRole("button", { name: /about you/i })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
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
    expect(screen.getByRole("button", { name: /macro assumptions/i })).toHaveAttribute(
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
    // The principal defaults to 0 (no schedule renders) and the loan end
    // year defaults to currentYear + 5, so we just seed a non-zero balance
    // and push the end year out a bit further via the slider to give the
    // schedule summary something concrete to display.
    const debtField = within(debt).getByLabelText("Debt") as HTMLInputElement;
    await user.clear(debtField);
    await user.type(debtField, "50000");
    await user.tab();

    const endYear = within(debt).getByLabelText("Loan end year") as HTMLInputElement;
    fireEvent.change(endYear, {
      target: { value: String(new Date().getFullYear() + 15) }
    });

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
    // When expanded, the category exposes its Add control even with no
    // holdings yet — that's the only thing that should be in the DOM here.
    expect(
      screen.getByRole("button", { name: /^\+ add real estate$/i })
    ).toBeInTheDocument();
    await user.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: /^\+ add real estate$/i })
    ).toBeNull();
  });

  it("shows at-a-glance summaries on each collapsed category", () => {
    render(<Host />);
    // Income & Expenses, Real Estate, Life Events, and Macro assumptions all
    // start collapsed, so their summaries should be visible. We avoid
    // hard-coding the currency symbol because the default depends on the
    // locale set by CurrencyProvider. Defaults are zero, so each summary
    // reflects an empty plan.
    expect(
      screen.getByText(/.{1,3}0\/yr income · .{1,3}0\/mo expenses/)
    ).toBeInTheDocument();
    // Real estate summary is the em-dash placeholder when both values are 0.
    expect(screen.getByText("\u2014")).toBeInTheDocument();
    expect(screen.getByText("None scheduled")).toBeInTheDocument();
    expect(screen.getByText(/Inflation 2\.0%/)).toBeInTheDocument();
  });

  it("hides a category's summary while it is expanded and shows it once collapsed", async () => {
    const user = userEvent.setup();
    render(<Host />);
    // Assets and Debt starts open, so its 'Net' summary should not be in the DOM.
    expect(screen.queryByText(/^Net .{1,3}10K$/)).toBeNull();
    // Collapse it; the summary should appear in its header row.
    await user.click(screen.getByRole("button", { name: /assets and debt/i }));
    expect(screen.getByText(/^Net .{1,3}10K$/)).toBeInTheDocument();
  });

  it("updates the Life Events summary when a windfall amount is entered", async () => {
    const user = userEvent.setup();
    render(<Host />);
    expect(screen.getByText("None scheduled")).toBeInTheDocument();

    await expand(/life events/i);
    const amount = screen.getByLabelText("Windfall amount") as HTMLInputElement;
    await user.clear(amount);
    await user.type(amount, "50000");
    await user.tab();

    // Collapse Life Events again so the summary is rendered in the header.
    await user.click(screen.getByRole("button", { name: /life events/i }));
    expect(screen.getByText(/Windfall .{1,3}50K in/)).toBeInTheDocument();
    expect(screen.queryByText("None scheduled")).toBeNull();
  });

  it("renders the Reset button at the top of the form", () => {
    render(<Host />);
    const btn = screen.getByRole("button", { name: /reset to defaults/i });
    // The reset control should not be tucked inside any of the category
    // fieldsets; it lives in the form's header row.
    expect(btn.closest("fieldset")).toBeNull();
  });

  it("renders a Liquidity year slider after each Non-Liquid amount field with a 'this year' helper at the default", async () => {
    render(<Host />);
    await expand(/non-liquid/i);
    const nonLiquid = screen.getByTestId("subsection-non-liquid");
    // One slider per non-liquid bucket (Private Equity + Other Fixed Assets).
    expect(within(nonLiquid).getAllByText("Liquidity year")).toHaveLength(2);
    // Defaults to the current year, so the helper reads "this year" twice.
    expect(within(nonLiquid).getAllByText("this year")).toHaveLength(2);
  });

  it("updates the Liquidity year value display and helper when the slider moves", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/non-liquid/i);
    const nonLiquid = screen.getByTestId("subsection-non-liquid");

    // Seed a non-zero principal so the slider has something to liquidate. The
    // value isn't asserted; this just exercises the realistic flow.
    const pe = within(nonLiquid).getByLabelText("Private Equity") as HTMLInputElement;
    await user.clear(pe);
    await user.type(pe, "100000");

    // The Non-Liquid subsection has two sliders in DOM order: the first is
    // nonLiquidLiquidityYear (paired with Private Equity), the second is
    // otherFixedLiquidityYear. Drive the first one to currentYear + 12.
    const sliders = within(nonLiquid).getAllByRole("slider");
    expect(sliders).toHaveLength(2);
    const currentYear = new Date().getFullYear();
    const targetYear = currentYear + 12;
    fireEvent.change(sliders[0], { target: { value: String(targetYear) } });

    // Raw-year display reads the new year, and the helper reads "in N years".
    expect(within(nonLiquid).getByText(String(targetYear))).toBeInTheDocument();
    expect(within(nonLiquid).getByText("in 12 years")).toBeInTheDocument();
    // The other slider stays at its default helper, so "this year" still shows once.
    expect(within(nonLiquid).getAllByText("this year")).toHaveLength(1);
  });

  it("uses singular 'in 1 year' when the slider is one year out", async () => {
    render(<Host />);
    await expand(/non-liquid/i);
    const nonLiquid = screen.getByTestId("subsection-non-liquid");
    const sliders = within(nonLiquid).getAllByRole("slider");
    const currentYear = new Date().getFullYear();
    fireEvent.change(sliders[0], { target: { value: String(currentYear + 1) } });
    expect(within(nonLiquid).getByText("in 1 year")).toBeInTheDocument();
  });

  it("renders the Loan end year as a slider with an 'in 5 years' helper at the default", async () => {
    render(<Host />);
    await expand(/^debt$/i);
    const debt = screen.getByTestId("subsection-debt");
    const slider = within(debt).getByLabelText("Loan end year") as HTMLInputElement;
    expect(slider.type).toBe("range");
    // Default is currentYear + 5, so the raw-year display and helper match.
    const currentYear = new Date().getFullYear();
    expect(slider.value).toBe(String(currentYear + 5));
    expect(within(debt).getByText(String(currentYear + 5))).toBeInTheDocument();
    expect(within(debt).getByText("in 5 years")).toBeInTheDocument();
  });

  it("renders the Windfall year as a slider with an 'in 5 years' helper at the default", async () => {
    render(<Host />);
    await expand(/life events/i);
    const fs = screen.getByText("Life Events").closest("fieldset")!;
    const slider = within(fs).getByLabelText("Windfall year") as HTMLInputElement;
    expect(slider.type).toBe("range");
    const currentYear = new Date().getFullYear();
    expect(slider.value).toBe(String(currentYear + 5));
    expect(within(fs).getByText(String(currentYear + 5))).toBeInTheDocument();
    expect(within(fs).getByText("in 5 years")).toBeInTheDocument();
  });
});

describe("Real estate investment events", () => {
  it("renders no investment cards by default", async () => {
    render(<Host />);
    await expand(/life events/i);
    expect(screen.queryByTestId("re-investment-card-0")).toBeNull();
    expect(
      screen.getByRole("button", { name: /add real estate investment/i })
    ).toBeInTheDocument();
  });

  it("adds a new investment card with all five fields when the add button is clicked", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(
      screen.getByRole("button", { name: /add real estate investment/i })
    );
    const card = screen.getByTestId("re-investment-card-0");
    expect(within(card).getByLabelText("Purchase amount")).toBeInTheDocument();
    expect(within(card).getByLabelText("Annual rental income")).toBeInTheDocument();
    expect(within(card).getByText("Purchase year")).toBeInTheDocument();
    expect(
      within(card).getByText("Rental income annual appreciation")
    ).toBeInTheDocument();
    expect(within(card).getByText("Annual appreciation rate")).toBeInTheDocument();
  });

  it("orders the card fields: Purchase amount, Purchase year, Appreciation, Rental income, Rental appreciation", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(
      screen.getByRole("button", { name: /add real estate investment/i })
    );

    const card = screen.getByTestId("re-investment-card-0");
    // The DOM order of the field labels is the visual order of the fields.
    // We grab everything that doubles as a field label (CurrencyField uses
    // aria-label, SliderRow renders the label as plain text inside its row)
    // and check the slice we control.
    const labels = [
      within(card).getByLabelText("Purchase amount"),
      within(card).getByText("Purchase year"),
      within(card).getByText("Annual appreciation rate"),
      within(card).getByLabelText("Annual rental income"),
      within(card).getByText("Rental income annual appreciation")
    ];
    for (let i = 1; i < labels.length; i += 1) {
      // Node.compareDocumentPosition flag 4 = "preceding sibling/ancestor",
      // i.e. labels[i-1] comes before labels[i] in document order.
      expect(
        labels[i - 1].compareDocumentPosition(labels[i]) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }
  });

  it("stacks multiple investment cards independently", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    const addBtn = screen.getByRole("button", {
      name: /add real estate investment/i
    });
    await user.click(addBtn);
    await user.click(addBtn);
    expect(screen.getByTestId("re-investment-card-0")).toBeInTheDocument();
    expect(screen.getByTestId("re-investment-card-1")).toBeInTheDocument();
  });

  it("updates the purchase amount of a specific card without affecting siblings", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    const addBtn = screen.getByRole("button", {
      name: /add real estate investment/i
    });
    await user.click(addBtn);
    await user.click(addBtn);

    const cardA = screen.getByTestId("re-investment-card-0");
    const cardB = screen.getByTestId("re-investment-card-1");
    const amountA = within(cardA).getByLabelText(
      "Purchase amount"
    ) as HTMLInputElement;
    const amountB = within(cardB).getByLabelText(
      "Purchase amount"
    ) as HTMLInputElement;

    await user.clear(amountA);
    await user.type(amountA, "250000");
    await user.tab();

    expect(amountA.value).toBe("250,000");
    expect(amountB.value).toBe("0");
  });

  it("removes a specific card when its remove button is clicked", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    const addBtn = screen.getByRole("button", {
      name: /add real estate investment/i
    });
    await user.click(addBtn);
    await user.click(addBtn);
    expect(screen.getByTestId("re-investment-card-1")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /remove real estate investment 1/i })
    );

    // After removal of the first card, the remaining one re-indexes to 0.
    expect(screen.getByTestId("re-investment-card-0")).toBeInTheDocument();
    expect(screen.queryByTestId("re-investment-card-1")).toBeNull();
  });

  it("includes the investment count in the collapsed Life Events summary", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(
      screen.getByRole("button", { name: /add real estate investment/i })
    );
    await user.click(screen.getByRole("button", { name: /life events/i }));
    expect(
      screen.getByText(/1 real estate investment/i)
    ).toBeInTheDocument();
  });

  it("shows the inflation-adjusted purchase price next to the relative year in the helper text", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(
      screen.getByRole("button", { name: /add real estate investment/i })
    );

    const card = screen.getByTestId("re-investment-card-0");
    const amount = within(card).getByLabelText(
      "Purchase amount"
    ) as HTMLInputElement;
    await user.clear(amount);
    await user.type(amount, "1000000");
    await user.tab();

    const yearsToPurchase = 4;
    const yearSlider = within(card).getByLabelText(
      "Purchase year"
    ) as HTMLInputElement;
    fireEvent.change(yearSlider, {
      target: { value: String(new Date().getFullYear() + yearsToPurchase) }
    });

    // The helper must surface the *nominal* (inflation-adjusted) cost the
    // engine actually deducts at purchase year, not the today's-money input.
    // We don't hard-code the currency symbol (it depends on the locale set
    // by CurrencyProvider), but the inflated thousands + relative-year
    // phrase must both appear in the helper line.
    const inflated = Math.round(
      1_000_000 * (1 + DEFAULT_PLAN_INPUTS.inflationRate) ** yearsToPurchase
    );
    const formatted = inflated.toLocaleString("en-US");
    expect(formatted).not.toBe("1,000,000"); // sanity-check: non-zero inflation default
    expect(
      within(card).getByText(new RegExp(`${formatted} in ${yearsToPurchase} years`))
    ).toBeInTheDocument();
  });

  it("falls back to just the relative year when no purchase amount has been entered yet", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(
      screen.getByRole("button", { name: /add real estate investment/i })
    );
    const card = screen.getByTestId("re-investment-card-0");
    // Default purchase year = current year + 5, so the helper reads "in 5 years".
    expect(within(card).getByText("in 5 years")).toBeInTheDocument();
    // No formatted price appears anywhere in the card while amount is 0.
    expect(within(card).queryByText(/[0-9],[0-9]/)).toBeNull();
  });

  it("combines the windfall and investment count into a single summary line", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);

    const amount = screen.getByLabelText("Windfall amount") as HTMLInputElement;
    await user.clear(amount);
    await user.type(amount, "50000");
    await user.tab();
    await user.click(
      screen.getByRole("button", { name: /add real estate investment/i })
    );

    await user.click(screen.getByRole("button", { name: /life events/i }));
    expect(
      screen.getByText(/Windfall .{1,3}50K in.+1 real estate investment/i)
    ).toBeInTheDocument();
  });
});

describe("Real estate holdings", () => {
  it("renders no holding cards by default and shows the Add button", async () => {
    render(<Host />);
    await expand(/real estate/i);
    expect(screen.queryByTestId("re-holding-card-0")).toBeNull();
    expect(
      screen.getByRole("button", { name: /^\+ add real estate$/i })
    ).toBeInTheDocument();
  });

  it("adds a card with Value + Annual appreciation rate when the Add button is clicked", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/real estate/i);
    await user.click(
      screen.getByRole("button", { name: /^\+ add real estate$/i })
    );
    const card = screen.getByTestId("re-holding-card-0");
    expect(within(card).getByLabelText("Value")).toBeInTheDocument();
    expect(within(card).getByText("Annual appreciation rate")).toBeInTheDocument();
  });

  it("stacks multiple holding cards independently", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/real estate/i);
    // Re-query the Add button before each click: the empty-state and
    // populated-state branches of the Real Estate category render the
    // button into different DOM trees, so the first click detaches the
    // node we'd otherwise have cached.
    const clickAdd = () =>
      user.click(
        screen.getByRole("button", { name: /^\+ add real estate$/i })
      );
    await clickAdd();
    await clickAdd();
    expect(screen.getByTestId("re-holding-card-0")).toBeInTheDocument();
    expect(screen.getByTestId("re-holding-card-1")).toBeInTheDocument();
  });

  it("updates the value of a specific card without affecting siblings", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/real estate/i);
    const clickAdd = () =>
      user.click(
        screen.getByRole("button", { name: /^\+ add real estate$/i })
      );
    await clickAdd();
    await clickAdd();

    const cardA = screen.getByTestId("re-holding-card-0");
    const cardB = screen.getByTestId("re-holding-card-1");
    const valueA = within(cardA).getByLabelText("Value") as HTMLInputElement;
    const valueB = within(cardB).getByLabelText("Value") as HTMLInputElement;

    await user.clear(valueA);
    await user.type(valueA, "300000");
    await user.tab();

    expect(valueA.value).toBe("300,000");
    expect(valueB.value).toBe("0");
  });

  it("removes a specific card when its remove button is clicked", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/real estate/i);
    const clickAdd = () =>
      user.click(
        screen.getByRole("button", { name: /^\+ add real estate$/i })
      );
    await clickAdd();
    await clickAdd();
    expect(screen.getByTestId("re-holding-card-1")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /remove real estate holding 1/i })
    );

    expect(screen.getByTestId("re-holding-card-0")).toBeInTheDocument();
    expect(screen.queryByTestId("re-holding-card-1")).toBeNull();
  });

  it("updates the collapsed Real Estate summary as cards are added and valued", async () => {
    const user = userEvent.setup();
    render(<Host />);
    // Default: empty holdings → em-dash placeholder shown next to the
    // collapsed Real Estate header.
    expect(screen.getByText("\u2014")).toBeInTheDocument();

    await expand(/real estate/i);
    await user.click(
      screen.getByRole("button", { name: /^\+ add real estate$/i })
    );
    const card = screen.getByTestId("re-holding-card-0");
    const value = within(card).getByLabelText("Value") as HTMLInputElement;
    await user.clear(value);
    await user.type(value, "450000");
    await user.tab();

    // Collapse Real Estate so the summary pill renders again. With cards
    // present, "real estate" matches the Add and Remove buttons too — pin
    // the regex to the category header's exact accessible name.
    await user.click(screen.getByRole("button", { name: /^real estate$/i }));
    expect(screen.queryByText("\u2014")).toBeNull();
    expect(screen.getByText(/450K/)).toBeInTheDocument();
  });
});
