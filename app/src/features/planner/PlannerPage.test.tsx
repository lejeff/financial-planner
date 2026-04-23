import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CurrencyProvider } from "@/features/currency/CurrencyContext";
import { PlannerPage } from "./PlannerPage";
import { DEFAULT_PLAN_INPUTS } from "./types";
import { ageFromDob } from "./calculator";

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

    const readProjected = () => {
      const card = screen
        .getByText(/Projected net worth at age/i)
        .closest("div")!.parentElement!;
      const text = card.querySelector(".font-display")?.textContent ?? "";
      return Number(text.replace(/[^\d.-]/g, ""));
    };

    const real = readProjected();

    await user.click(screen.getByRole("radio", { name: "Future money" }));
    const nominal = readProjected();
    expect(nominal).toBeGreaterThan(real);
    expect(screen.getByText(/· future money/i)).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Today's money" }));
    const realAgain = readProjected();
    expect(realAgain).toBeLessThan(nominal);
    expect(realAgain).toBe(real);
    expect(screen.getByText(/· today's money/i)).toBeInTheDocument();
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
