import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CurrencyProvider } from "@/features/currency/CurrencyContext";
import { PlannerPage } from "./PlannerPage";
import { DEFAULT_PLAN_INPUTS, ageFromDob } from "@app/core";

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

describe("PlannerPage", () => {
  it("renders the three summary cards with default values", () => {
    renderPage();
    const expectedAge = ageFromDob(DEFAULT_PLAN_INPUTS.dateOfBirth);
    expect(screen.getByText("Current age")).toBeInTheDocument();
    expect(screen.getByText(expectedAge.toString())).toBeInTheDocument();
    expect(
      screen.getByText(
        new RegExp(`Projected net worth at age ${expectedAge + DEFAULT_PLAN_INPUTS.horizonYears}`)
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Projection ends")).toBeInTheDocument();
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
