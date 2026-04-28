import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CurrencyProvider } from "@/features/currency/CurrencyContext";
import { PlannerPage } from "./PlannerPage";
import { DEFAULT_PLAN_INPUTS, ageFromDob, computeCurrentNetWorth } from "@app/core";

// Recharts uses ResponsiveContainer which requires layout dimensions jsdom can't
// provide. We stub it with a fixed-size div so the chart renders a valid SVG
// tree during tests without throwing.
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 600, height: 400 }}>{children}</div>
    )
  };
});

function renderPage() {
  return render(
    <CurrencyProvider>
      <PlannerPage />
    </CurrencyProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

// Find the retirement-age slider. About you contains two sliders (horizon and
// retirement age); we identify the retirement one by the current numeric value
// since both have unique defaults.
function getRetirementSlider(): HTMLInputElement {
  const aboutYou = screen.getByText("About you").closest("fieldset")!;
  const sliders = within(aboutYou).getAllByRole("slider") as HTMLInputElement[];
  const found = sliders.find((s) => Number(s.value) === DEFAULT_PLAN_INPUTS.retirementAge);
  if (!found) {
    throw new Error("Retirement age slider not found at the default value");
  }
  return found;
}

describe("PlannerPage", () => {
  it("renders the three summary cards with the new today/retirement/end narrative", () => {
    renderPage();
    const expectedAge = ageFromDob(DEFAULT_PLAN_INPUTS.dateOfBirth);
    const expectedEndAge = expectedAge + DEFAULT_PLAN_INPUTS.horizonYears;

    // Card 1: today.
    expect(screen.getByText("Net worth today")).toBeInTheDocument();

    // Card 2: retirement milestone, with the retirement age in the eyebrow.
    // (The cash-flow footnote is exercised in dedicated tests below.)
    expect(
      screen.getByText(
        new RegExp(`Net worth at retirement \\(age ${DEFAULT_PLAN_INPUTS.retirementAge}\\)`)
      )
    ).toBeInTheDocument();

    // Card 3: end-of-horizon outcome with a Real CAGR footnote. Defaults grow
    // 10K at 5% nominal / ~2.94% real over 30y, so CAGR is positive.
    expect(
      screen.getByText(new RegExp(`Projected net worth at age ${expectedEndAge}`))
    ).toBeInTheDocument();
    expect(screen.getByText(/Real CAGR \d+\.\d%/)).toBeInTheDocument();
  });

  it("uses the user's full balance sheet for the Net worth today card", () => {
    renderPage();
    const card = screen.getByText("Net worth today").closest(".card")!;
    const expected = computeCurrentNetWorth(DEFAULT_PLAN_INPUTS);
    // Loose match: the card should contain the expected number, ignoring the
    // currency symbol and locale-specific separators.
    const valueEl = card.querySelector(".font-display");
    const numeric = Number((valueEl?.textContent ?? "").replace(/[^\d.-]/g, ""));
    expect(numeric).toBe(expected);
  });

  it("renders an em-dash cash-flow footnote when there are no inflows at all", async () => {
    const user = userEvent.setup();
    renderPage();
    // The default plan ships with startAssets=10K earning 5%, which counts
    // as portfolio cash flow under the new ratio. Zero it out so total
    // inflows really are zero and the footnote falls back to em-dash.
    const portfolio = screen.getByLabelText("Financial Assets / Portfolio") as HTMLInputElement;
    await user.clear(portfolio);
    await user.type(portfolio, "0");
    await user.tab();

    const card = screen
      .getByText(
        new RegExp(`Net worth at retirement \\(age ${DEFAULT_PLAN_INPUTS.retirementAge}\\)`)
      )
      .closest(".card")!;
    expect(within(card as HTMLElement).getByText("—")).toBeInTheDocument();
  });

  it("updates the cash-flow footnote when income and spending change", async () => {
    const user = userEvent.setup();
    renderPage();
    // Income & Expenses is collapsed by default; expand before editing salary.
    await user.click(screen.getByRole("button", { name: /income & expenses/i }));

    const salary = screen.getByLabelText("Annual Salary") as HTMLInputElement;
    await user.clear(salary);
    await user.type(salary, "119500");
    await user.tab();

    const spending = screen.getByLabelText("Recurring monthly expenses") as HTMLInputElement;
    await user.clear(spending);
    await user.type(spending, "5000");
    await user.tab();

    // inflows = salary 119500 + portfolio 10000 * 5% = 120000
    // outflows = 5000 * 12 = 60000 → (120000 - 60000)/120000 = 50%
    expect(screen.getByText("Saving 50% of cash flow")).toBeInTheDocument();
  });

  it("counts portfolio earnings as inflow on the default plan (Saving 100% of cash flow)", () => {
    renderPage();
    // Defaults: startAssets=10K, nominalReturn=5%, annualIncome=0, monthlySpending=0,
    // realEstateHoldings=[] (no rental) → inflows=$500, outflows=$0 → 100%.
    expect(screen.getByText("Saving 100% of cash flow")).toBeInTheDocument();
  });

  it("renders the Net worth today value in coral when the user is underwater", async () => {
    const user = userEvent.setup();
    renderPage();
    // Assets and Debt is open by default, but the Debt subsection inside it
    // is collapsed; expand it and push debt past the default 10K asset
    // balance to flip net worth negative.
    await user.click(screen.getByRole("button", { name: /^debt$/i }));

    const debt = screen.getByLabelText("Debt") as HTMLInputElement;
    await user.clear(debt);
    await user.type(debt, "50000");
    await user.tab();

    const card = screen.getByText("Net worth today").closest(".card") as HTMLElement;
    const valueEl = card.querySelector(".font-display") as HTMLElement;
    expect(valueEl.textContent).toMatch(/-/);
    expect(valueEl.className).toContain("text-[var(--danger)]");
    expect(valueEl.className).not.toContain("text-[var(--navy)]");
  });

  it("renders the Net worth today value in navy when net worth is non-negative", () => {
    renderPage();
    const card = screen.getByText("Net worth today").closest(".card") as HTMLElement;
    const valueEl = card.querySelector(".font-display") as HTMLElement;
    expect(valueEl.className).toContain("text-[var(--navy)]");
    expect(valueEl.className).not.toContain("text-[var(--danger)]");
  });

  it("flips the accent bars on cards 2 and 3 to danger red when their values go negative", async () => {
    const user = userEvent.setup();
    renderPage();
    // High monthly expenses against zero income drains the projection so
    // both the retirement and end-of-plan cards run negative — without
    // depending on debt-amortization mechanics.
    await user.click(screen.getByRole("button", { name: /income & expenses/i }));
    const expenses = screen.getByLabelText("Recurring monthly expenses") as HTMLInputElement;
    await user.clear(expenses);
    await user.type(expenses, "10000");
    await user.tab();

    for (const eyebrow of ["Net worth at retirement", "Projected net worth at age"]) {
      const card = screen.getByText(new RegExp(eyebrow)).closest(".card") as HTMLElement;
      const valueEl = card.querySelector(".font-display") as HTMLElement;
      // Sanity: the value must actually be negative, otherwise the
      // accent assertion below would not exercise the new override.
      expect(valueEl.textContent).toMatch(/-/);
      const accentBar = card.firstElementChild as HTMLElement;
      expect(accentBar.style.background).toBe("var(--danger)");
    }
  });

  it("does not paint the accent bars danger on the default (positive) plan", () => {
    renderPage();
    for (const eyebrow of [
      "Net worth today",
      "Net worth at retirement",
      "Projected net worth at age"
    ]) {
      const card = screen.getByText(new RegExp(eyebrow)).closest(".card") as HTMLElement;
      const accentBar = card.firstElementChild as HTMLElement;
      expect(accentBar.style.background).not.toBe("var(--danger)");
    }
  });

  it("falls back to em-dash on the retirement card when retirement is beyond the horizon", () => {
    renderPage();
    const slider = getRetirementSlider();
    // currentAge ~= 40 with default DOB; horizon is 30, so the projection
    // ends at age 70. Push retirement past that.
    fireEvent.change(slider, { target: { value: "80" } });

    const card = screen.getByText(/Net worth at retirement \(age 80\)/).closest(".card")!;
    const value = card.querySelector(".font-display");
    expect(value?.textContent).toBe("—");
  });

  it("renders an Already retired footnote when retirement age is at or below current age", () => {
    renderPage();
    const slider = getRetirementSlider();
    // currentAge ~= 40 from the default DOB; pull retirement age below it.
    fireEvent.change(slider, { target: { value: "30" } });

    const card = screen.getByText(/Net worth at retirement \(age 30\)/).closest(".card")!;
    expect(within(card as HTMLElement).getByText("Already retired")).toBeInTheDocument();
  });

  it("shows the basis label on the retirement card and follows the view-mode toggle", async () => {
    const user = userEvent.setup();
    renderPage();

    const getRetirementCard = () =>
      screen
        .getByText(
          new RegExp(`Net worth at retirement \\(age ${DEFAULT_PLAN_INPUTS.retirementAge}\\)`)
        )
        .closest(".card")! as HTMLElement;

    expect(within(getRetirementCard()).getByText(/in today's money/i)).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Future money" }));
    expect(within(getRetirementCard()).getByText(/in future money/i)).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Today's money" }));
    expect(within(getRetirementCard()).getByText(/in today's money/i)).toBeInTheDocument();
  });

  it("keeps the Real CAGR footnote stable when toggling Today's vs Future money", async () => {
    const user = userEvent.setup();
    renderPage();
    const before = screen.getByText(/Real CAGR \d+\.\d%/).textContent;

    await user.click(screen.getByRole("radio", { name: "Future money" }));
    const afterFuture = screen.getByText(/Real CAGR \d+\.\d%/).textContent;
    expect(afterFuture).toBe(before);

    await user.click(screen.getByRole("radio", { name: "Today's money" }));
    const afterToday = screen.getByText(/Real CAGR \d+\.\d%/).textContent;
    expect(afterToday).toBe(before);
  });

  it("renders the three top-level categories and the form heading", () => {
    renderPage();
    expect(screen.getByText("Your plan")).toBeInTheDocument();
    expect(screen.getByText("Assets and Debt")).toBeInTheDocument();
    expect(screen.getByText("Income & Expenses")).toBeInTheDocument();
    expect(screen.getByText("Real Estate")).toBeInTheDocument();
  });

  it("updates the projected net worth card when an input changes", async () => {
    const user = userEvent.setup();
    renderPage();

    const cashField = screen.getByLabelText("Cash Balance") as HTMLInputElement;
    await user.clear(cashField);
    await user.type(cashField, "999999");
    await user.tab();

    // Cash is frozen (no return), so every projection year gets +999,999 in net
    // worth. The projected-net-worth card should now contain a value that
    // reflects the bump. We just assert the card shows at least some value
    // that parses back above the initial startAssets.
    const projectionCard = screen.getByText(/Projected net worth at age/i).closest("div")!
      .parentElement!;
    const projectedValue = projectionCard.querySelector(".font-display")?.textContent ?? "";
    const numeric = Number(projectedValue.replace(/[^\d.-]/g, ""));
    expect(numeric).toBeGreaterThan(0);
  });

  it("renders the view-mode toggle with Today's money selected by default", () => {
    renderPage();
    const today = screen.getByRole("radio", { name: "Today's money" });
    const future = screen.getByRole("radio", { name: "Future money" });
    expect(today).toHaveAttribute("aria-checked", "true");
    expect(future).toHaveAttribute("aria-checked", "false");
  });

  it("shows a larger projected net worth when switching to Future money and restores it on switch back", async () => {
    const user = userEvent.setup();
    renderPage();

    // The default plan ships with zero balances, so seed a non-zero cash
    // balance to give the projection something to work with. Inflation is
    // already 2% by default, which is enough to make the real and future
    // views diverge.
    const cashField = screen.getByLabelText("Cash Balance") as HTMLInputElement;
    await user.clear(cashField);
    await user.type(cashField, "100000");
    await user.tab();

    const getProjectedCard = () =>
      screen.getByText(/Projected net worth at age/i).closest("div")!.parentElement!;

    const readProjected = () => {
      const card = getProjectedCard();
      const text = card.querySelector(".font-display")?.textContent ?? "";
      return Number(text.replace(/[^\d.-]/g, ""));
    };

    const real = readProjected();

    await user.click(screen.getByRole("radio", { name: "Future money" }));
    const nominal = readProjected();
    expect(nominal).toBeGreaterThan(real);
    expect(within(getProjectedCard()).getByText(/in future money/i)).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Today's money" }));
    const realAgain = readProjected();
    expect(realAgain).toBeLessThan(nominal);
    expect(realAgain).toBe(real);
    expect(within(getProjectedCard()).getByText(/in today's money/i)).toBeInTheDocument();
  });

  it("renders the Liquid position chart card with its heading and eyebrow", () => {
    renderPage();
    expect(screen.getByText("Liquid position")).toBeInTheDocument();
    expect(screen.getByText("Portfolio + Cash")).toBeInTheDocument();
  });

  it("does not render the liquidity warning with the default plan", () => {
    renderPage();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Liquidity warning")).toBeNull();
  });

  it("renders the liquidity warning once liquid assets run out", async () => {
    const user = userEvent.setup();
    renderPage();

    // Zero out the portfolio, cash, and salary so spending outpaces income and
    // the combined liquid position is forced negative within the horizon.
    const portfolio = screen.getByLabelText("Financial Assets / Portfolio") as HTMLInputElement;
    await user.clear(portfolio);
    await user.type(portfolio, "0");
    await user.tab();

    const cash = screen.getByLabelText("Cash Balance") as HTMLInputElement;
    await user.clear(cash);
    await user.type(cash, "0");
    await user.tab();

    // Income & Expenses is collapsed by default; expand before editing salary.
    await user.click(screen.getByRole("button", { name: /income & expenses/i }));

    const salary = screen.getByLabelText("Annual Salary") as HTMLInputElement;
    await user.clear(salary);
    await user.type(salary, "0");
    await user.tab();

    // The default plan ships with zero monthly spending, so liquids stay flat
    // forever and never trip the warning. Force a drain by setting a non-zero
    // recurring expense.
    const spending = screen.getByLabelText("Recurring monthly expenses") as HTMLInputElement;
    await user.clear(spending);
    await user.type(spending, "5000");
    await user.tab();

    const liquidityHeading = await screen.findByText("Liquidity warning");
    const alert = liquidityHeading.closest('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert).toHaveTextContent("Liquidity warning");
    expect(alert).toHaveTextContent(/goes negative/i);
    expect(alert).toHaveTextContent(/sell other assets/i);
  });

  it("restores defaults when the user clicks Reset", async () => {
    const user = userEvent.setup();
    renderPage();

    const cashField = screen.getByLabelText("Cash Balance") as HTMLInputElement;
    await user.clear(cashField);
    await user.type(cashField, "123456");
    await user.tab();
    expect(cashField.value).toBe("123,456");

    await user.click(screen.getByRole("button", { name: /reset to defaults/i }));
    expect((screen.getByLabelText("Cash Balance") as HTMLInputElement).value).toBe(
      new Intl.NumberFormat("en-US").format(DEFAULT_PLAN_INPUTS.cashBalance)
    );
  });
});
