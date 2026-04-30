import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlannerForm } from "./PlannerForm";
import {
  DEFAULT_PLAN_INPUTS,
  makeDefaultRealEstateHolding,
  makeDefaultRealEstateInvestment,
  type PlanInputs
} from "@app/core";
import { CurrencyProvider } from "@/features/currency/CurrencyContext";

function Host({
  onReset = vi.fn(),
  initialValue = DEFAULT_PLAN_INPUTS
}: {
  onReset?: () => void;
  initialValue?: PlanInputs;
} = {}) {
  const [value, setValue] = useState<PlanInputs>(initialValue);
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

// Find the deepest element whose flattened textContent matches `regex`.
// Useful for asserting on collapsed-pill summary text after the V2-C
// restyle, which renders value + label as two adjacent <span>s with
// only `gap-x-2` visual separation. `getByText`'s default per-text-node
// matching can't see across siblings, so we walk down to the most
// specific element that matches the joined text.
function getElementByJoinedText(regex: RegExp): HTMLElement {
  return screen.getByText((_, el) => {
    if (!el) return false;
    if (!regex.test(el.textContent ?? "")) return false;
    return !Array.from(el.children).some((c) =>
      regex.test(c.textContent ?? "")
    );
  });
}

function queryElementByJoinedText(regex: RegExp): HTMLElement | null {
  return screen.queryByText((_, el) => {
    if (!el) return false;
    if (!regex.test(el.textContent ?? "")) return false;
    return !Array.from(el.children).some((c) =>
      regex.test(c.textContent ?? "")
    );
  });
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

    // All three sub-pills (Liquid, Non-Liquid, Debt) start collapsed —
    // expand each to inspect its inner fields.
    await expand(/^Liquid$/i);
    const liquid = within(assets).getByTestId("subsection-liquid");
    expect(within(liquid).getByText("Liquid")).toBeInTheDocument();
    expect(within(liquid).getByLabelText("Financial Assets / Portfolio")).toBeInTheDocument();
    expect(within(liquid).getByLabelText("Cash Balance")).toBeInTheDocument();
    expect(within(liquid).getByText("Expected annual return")).toBeInTheDocument();

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

    // Assets & Debt subsections render as full-pill fieldsets matching the
    // life-event card visual (Task 5). Sanity-check each wrapper element.
    expect(liquid.tagName).toBe("FIELDSET");
    expect(nonLiquid.tagName).toBe("FIELDSET");
    expect(debt.tagName).toBe("FIELDSET");
  });

  it("Liquid subsection shows a formatted total (startAssets + cashBalance) plus the expected return rate in its collapsed-state summary", () => {
    render(<Host />);
    // Liquid defaults to closed (matches Non-Liquid + Debt), so the
    // summary is visible immediately. DEFAULT_PLAN_INPUTS has
    // startAssets=10_000, cashBalance=0, and nominalReturn=0.05 so the
    // collapsed summary should pin both the formatted total and the
    // "X.X% return on Portfolio" suffix (mirrors the parent
    // Assets and Debt summary so the rate stays visible while the
    // parent pill is open).
    const summary = screen.getByTestId("subsection-liquid-summary");
    expect(summary.textContent).toMatch(/10,000/);
    expect(summary.textContent).toMatch(/5\.0% return on Portfolio/);
    // Sanity-check it's not the em-dash empty fallback alone.
    expect(summary.textContent).not.toBe("—");
  });

  it("Liquid subsection summary keeps the return rate even when the bucket is empty", () => {
    render(
      <Host
        initialValue={{
          ...DEFAULT_PLAN_INPUTS,
          startAssets: 0,
          cashBalance: 0
        }}
      />
    );
    // With both Liquid sources zero, the headline collapses to the
    // em-dash placeholder but the rate must still be appended — same
    // convention as the parent Assets and Debt pill, which always shows
    // the rate even when net is 0.
    const summary = screen.getByTestId("subsection-liquid-summary");
    // After the V2-C restyle the value and label render as two spans
    // separated visually by `gap-x-2` (CSS, not a literal middle-dot),
    // so textContent concatenates the two segments directly.
    expect(summary.textContent).toBe("—5.0% return on Portfolio");
  });

  it("Non-Liquid subsection shows an em-dash in its collapsed-state summary when both buckets are zero (default fixture)", async () => {
    render(<Host />);
    // Non-Liquid defaults to closed and DEFAULT_PLAN_INPUTS has both
    // nonLiquidInvestments and otherFixedAssets at 0.
    const summary = screen.getByTestId("subsection-non-liquid-summary");
    expect(summary.textContent).toBe("—");
  });

  it("Debt subsection's default-state summary surfaces both segments: em-dash value and 'No outstanding debt.' label", async () => {
    render(<Host />);
    // Debt defaults to closed; the collapsed summary is visible immediately.
    // After the V2-C restyle the summary is one flex container with two
    // spans (value + label) joined by " · ", so we assert against the
    // flattened textContent rather than against per-line <div>s.
    const summary = screen.getByTestId("subsection-debt-summary");
    // Em-dash empty-bucket fallback (startDebt defaults to 0) followed
    // directly by the existing-debt edge-case wording — NOT the new-
    // debt wording ("No principal entered."), verifying the per-call
    // `messages` override on `formatDebtScheduleText`. The two spans
    // are separated visually by `gap-x-2` rather than a literal " · "
    // character, so textContent concatenates them with no separator.
    expect(summary.textContent).toBe("—No outstanding debt.");
  });

  it("Debt subsection's collapsed summary surfaces the same schedule text as the in-card paragraph once a principal is entered", async () => {
    const user = userEvent.setup();
    render(<Host />);
    // Expand Debt to type into the Debt amount input. The input label
    // collides with the subsection title, so scope by testid.
    await user.click(screen.getByRole("button", { name: /^Debt$/i }));
    const debt = screen.getByTestId("subsection-debt");
    const debtAmount = within(debt).getByLabelText("Debt") as HTMLInputElement;
    await user.clear(debtAmount);
    await user.type(debtAmount, "100000");
    await user.tab();

    // Capture the in-card paragraph text BEFORE collapsing — both lines
    // should agree byte-for-byte (the contract `formatDebtScheduleText`
    // enforces).
    const inCardSchedule = within(debt).getByTestId(
      "debt-schedule-summary"
    ).textContent!;
    expect(inCardSchedule).toMatch(/Annual repayment|Annual interest/);

    // Collapse Debt to inspect the collapsed summary. Post V2-C the
    // summary is one flex container with a value span + label span
    // separated visually by `gap-x-2` (no literal " · " in the DOM),
    // so we assert against the flattened textContent.
    await user.click(screen.getByRole("button", { name: /^Debt$/i }));
    const summary = screen.getByTestId("subsection-debt-summary");
    // Value: balance only (no "from <year>" — your spec). Locale
    // formatting varies, so assert a substring of 100,000.
    expect(summary.textContent).toMatch(/100/);
    // Label: identical to the in-card paragraph (the schedule helper
    // text is appended verbatim after the value span).
    expect(summary.textContent).toContain(inCardSchedule);
  });

  it("renders the Debt subsection with the coral (debt-lane) accent, distinct from the teal Liquid/Non-Liquid lanes", async () => {
    // The Debt subsection sits in its own coral lane (ACCENT.debt =
    // var(--coral)) so liabilities read distinctly from the teal asset
    // lanes that share the Assets & Debt category. Sister UI: the New
    // Debt life-event card and its + Add New Debt button (also coral).
    // Guards against accidental revert to teal — JSDOM preserves the
    // raw inline style attribute even when it contains color-mix(),
    // which JSDOM doesn't natively parse.
    render(<Host />);
    await expand(/^debt$/i);
    const debt = screen.getByTestId("subsection-debt");
    const inlineStyle = debt.getAttribute("style") ?? "";
    expect(inlineStyle).toContain("var(--coral)");
    expect(inlineStyle).not.toContain("var(--teal)");
  });

  it("renders only Annual Salary + Recurring monthly expenses in Income & Expenses (rental moved to holdings)", async () => {
    render(<Host />);
    await expand(/income & expenses/i);
    const fs = screen.getByText("Income & Expenses").closest("fieldset")!;
    expect(within(fs).getByLabelText("Annual Salary")).toBeInTheDocument();
    expect(within(fs).getByLabelText("Recurring monthly expenses")).toBeInTheDocument();
    // Global rental income/rate fields are gone; rental now lives on each
    // RealEstateHolding card under Real Estate.
    expect(within(fs).queryByLabelText("Annual Rental Income")).toBeNull();
    expect(
      within(fs).queryByText("Rental income annual appreciation")
    ).toBeNull();
  });

  it("shows the annualised total below Recurring monthly expenses and updates as the user types", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/income & expenses/i);
    const fs = screen.getByText("Income & Expenses").closest("fieldset")!;

    // Default state: monthlySpending is 0 -> annual total is 0.
    expect(within(fs).getByText("Annual total: €0")).toBeInTheDocument();

    // Typing 5000 into the field should drive the helper to 12 * 5000.
    const monthly = within(fs).getByLabelText(
      "Recurring monthly expenses"
    ) as HTMLInputElement;
    await user.clear(monthly);
    await user.type(monthly, "5000");
    expect(within(fs).getByText("Annual total: €60,000")).toBeInTheDocument();
  });

  it("renders an empty Life Events category with all three Add buttons by default", async () => {
    render(<Host />);
    await expand(/life events/i);
    const fs = screen.getByText("Life Events").closest("fieldset")!;
    // No event card or card-internal field rendered before any are added.
    expect(within(fs).queryByTestId("windfall-card-0")).toBeNull();
    expect(within(fs).queryByTestId("re-investment-card-0")).toBeNull();
    expect(within(fs).queryByTestId("new-debt-card-0")).toBeNull();
    expect(within(fs).queryByLabelText("Amount")).toBeNull();
    expect(within(fs).queryByLabelText("Principal")).toBeNull();
    expect(
      within(fs).getByRole("button", { name: /^\+ add windfall$/i })
    ).toBeInTheDocument();
    expect(
      within(fs).getByRole("button", {
        name: /^\+ add real estate investment$/i
      })
    ).toBeInTheDocument();
    expect(
      within(fs).getByRole("button", { name: /^\+ add new debt$/i })
    ).toBeInTheDocument();
  });

  it("renders sub-pill chevrons in the top-right corner (matching the parent pill pattern), not inline next to the title", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);

    // Add a Windfall card so we have a sub-pill (size=\"sm\") to inspect.
    await user.click(
      within(screen.getByText("Life Events").closest("fieldset")!).getByRole(
        "button",
        { name: /^\+ add windfall$/i }
      )
    );
    const card = screen.getByTestId("windfall-card-0");

    // After the editable-label refactor, per-card pills (Windfall and
    // siblings) render the title as an `<input>` in the legend instead
    // of a `<button>`. The toggle accessibility moves to the corner
    // chevron, which becomes a real focusable button labeled
    // `Expand <label>` / `Collapse <label>`. The legend has no chevron
    // sibling inside it — the chevron sits in the top-right corner of
    // the fieldset, mirroring the parent-pill positioning pattern
    // (`absolute right-3 top-[-9px|-10px]`). Sub-pills are nudged 1px
    // down (top-[-9px]) so the smaller chevron sits visually centered
    // on the pill's top border; parent pills use top-[-10px] for the
    // larger chevron.
    const labelInput = within(card).getByRole("textbox", {
      name: /Edit label, defaults to "Windfall 1"/i
    });
    // Newly-added cards mount EXPANDED (newlyAddedIds), so the chevron
    // aria-label reads `Collapse Windfall 1`. The legend contains the
    // pencil-edit SVG but NOT the chevron triangle — the chevron sits
    // outside the legend in the top-right corner of the fieldset.
    expect(labelInput.closest("legend")?.querySelector("svg")).not.toBeNull();
    const chevronButton = within(card).getByRole("button", {
      name: /^Collapse Windfall 1$/i
    });
    expect(chevronButton.className).toContain("absolute");
    expect(chevronButton.className).toContain("right-3");
    expect(chevronButton.className).toContain("top-[-9px]");
    expect(chevronButton.getAttribute("aria-expanded")).toBe("true");
    expect(chevronButton.querySelector("svg")).not.toBeNull();
    // Chevron is a real toggle button (NOT aria-hidden, NOT tabIndex=-1)
    // because the legend input replaced the previous keyboard-toggle
    // button — the chevron is now the only kbd/SR way to open/close
    // the card.
    expect(chevronButton.getAttribute("aria-hidden")).toBeNull();
    expect(chevronButton.getAttribute("tabIndex")).toBe("0");
  });

  it("auto-expands a freshly-added life-event card and shows a one-line summary on collapsed cards", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);

    // Click +Add Windfall. The card should mount EXPANDED (newly-added,
    // tracked in PlannerForm's local newlyAddedIds) so the user can fill
    // it in immediately — no extra click-to-expand needed.
    const lifeEvents = screen.getByText("Life Events").closest("fieldset")!;
    await user.click(
      within(lifeEvents).getByRole("button", { name: /^\+ add windfall$/i })
    );
    const card = screen.getByTestId("windfall-card-0");
    expect(within(card).getByLabelText("Amount")).toBeInTheDocument();
    // No collapsed-state summary visible while expanded.
    expect(
      within(card).queryByTestId("windfall-card-0-summary")
    ).toBeNull();

    // Collapse the card via its corner chevron toggle (the only
    // toggle button on per-card pills since the legend became an
    // editable label input). Fields disappear and a single-line
    // summary appears in their place. Default amount is 0, so the
    // summary falls back to "Year <year>" rather than "€0 in ...".
    await user.click(
      within(card).getByRole("button", { name: /^Collapse Windfall 1$/i })
    );
    expect(within(card).queryByLabelText("Amount")).toBeNull();
    const summary = within(card).getByTestId("windfall-card-0-summary");
    expect(summary).toBeInTheDocument();
    expect(summary.textContent).toMatch(/^Year \d{4}$/);
  });

  it("does not render windfall fields anywhere by default", async () => {
    render(<Host />);
    // Across the whole form, no windfall card and no card-internal Amount field
    // exist before the user clicks Add Windfall.
    expect(screen.queryByTestId("windfall-card-0")).toBeNull();
    // Open Income & Expenses and Life Events to confirm explicitly.
    await expand(/income & expenses/i);
    await expand(/life events/i);
    expect(screen.queryByLabelText(/^Amount$/)).toBeNull();
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
    // Liquid sub-pill is collapsed by default; expand to reach Cash Balance.
    await expand(/^Liquid$/i);
    const field = screen.getByLabelText("Cash Balance") as HTMLInputElement;
    await user.clear(field);
    await user.type(field, "75000");
    expect(field.value).toBe("75,000");
  });

  it("moves a windfall card's year slider", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(screen.getByRole("button", { name: /^\+ add windfall$/i }));
    const card = screen.getByTestId("windfall-card-0");
    const slider = within(card).getByLabelText("Year") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "2045" } });
    expect(slider.value).toBe("2045");
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

  it("starts with all three Assets & Debt sub-pills (Liquid / Non-Liquid / Debt) collapsed by default", () => {
    render(<Host />);
    // All three sub-pills now match the Non-Liquid pattern: collapsed
    // by default, click the legend toggle to expand.
    expect(screen.getByRole("button", { name: /^liquid$/i })).toHaveAttribute(
      "aria-expanded",
      "false"
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

  it("opens a collapsed parent pill when the user clicks anywhere on its body (not just the header button)", async () => {
    const user = userEvent.setup();
    render(<Host />);
    // Macro defaults closed and renders its inflation summary in the
    // collapsed body. Click the summary div directly (NOT the legend
    // button) and assert the pill expanded — proves the click bubbled
    // up to the fieldset's open-on-click handler.
    const macroBtn = screen.getByRole("button", { name: /macro assumptions/i });
    expect(macroBtn).toHaveAttribute("aria-expanded", "false");
    const summary = screen.getByText(/Inflation 2\.0%/);
    await user.click(summary);
    expect(macroBtn).toHaveAttribute("aria-expanded", "true");
    // Inflation slider's label is now visible inside the expanded body
    // (the SliderRow label "Inflation" renders next to the value).
    const macro = screen.getByText("Macro assumptions").closest("fieldset")!;
    expect(within(macro).getByText("Inflation")).toBeInTheDocument();
  });

  it("opens a collapsed sub-pill when the user clicks anywhere on its body (summary div, not the header button)", async () => {
    const user = userEvent.setup();
    render(<Host />);
    // Liquid sub-pill defaults closed inside the (default-open) Assets
    // and Debt parent. Click the summary div by testid — bypasses the
    // legend button — and assert the sub-pill expanded.
    const liquidBtn = screen.getByRole("button", { name: /^Liquid$/i });
    expect(liquidBtn).toHaveAttribute("aria-expanded", "false");
    const summary = screen.getByTestId("subsection-liquid-summary");
    await user.click(summary);
    expect(liquidBtn).toHaveAttribute("aria-expanded", "true");
    // Liquid's "Financial Assets / Portfolio" input is now in the DOM.
    expect(
      screen.getByLabelText("Financial Assets / Portfolio")
    ).toBeInTheDocument();
  });

  it("does NOT collapse an open parent pill (or its open child) when the user clicks inside the parent body", async () => {
    const user = userEvent.setup();
    render(<Host />);
    // Pre-state: Assets and Debt is open by default; expand Liquid so
    // we have an open child inside an open parent.
    await expand(/^Liquid$/i);
    const parentBtn = screen.getByRole("button", { name: /assets and debt/i });
    const liquidBtn = screen.getByRole("button", { name: /^Liquid$/i });
    expect(parentBtn).toHaveAttribute("aria-expanded", "true");
    expect(liquidBtn).toHaveAttribute("aria-expanded", "true");

    // Click on a non-toggle element inside the open parent: the
    // Liquid sub-pill's own fieldset (an open pill, so its handler is
    // undefined) and a label inside it. Both clicks should bubble all
    // the way up to the parent fieldset without toggling anything,
    // because each open pill's own onClick is intentionally undefined.
    const liquidFieldset = screen.getByTestId("subsection-liquid");
    await user.click(liquidFieldset);
    expect(parentBtn).toHaveAttribute("aria-expanded", "true");
    expect(liquidBtn).toHaveAttribute("aria-expanded", "true");

    const portfolioLabel = screen.getByText("Financial Assets / Portfolio");
    await user.click(portfolioLabel);
    expect(parentBtn).toHaveAttribute("aria-expanded", "true");
    expect(liquidBtn).toHaveAttribute("aria-expanded", "true");
  });

  it("shows at-a-glance summaries on each collapsed category", () => {
    render(<Host />);
    // Income & Expenses, Real Estate, Life Events, and Macro assumptions all
    // start collapsed, so their summaries should be visible. We avoid
    // hard-coding the currency symbol because the default depends on the
    // locale set by CurrencyProvider. Defaults are zero, so each summary
    // reflects an empty plan.
    // After V2-C, the value span ("…0/yr income") and label span
    // ("…0/mo expenses") render side-by-side without a literal " · "
    // between them — visual separation comes from `gap-x-2`. Use the
    // joined-text helper because `getByText` won't match across two
    // adjacent text nodes.
    expect(
      getElementByJoinedText(/.{1,3}0\/yr income.{1,3}0\/mo expenses/)
    ).toBeInTheDocument();
    // Real estate summary is the em-dash placeholder when both values are 0.
    // Scope to the Real Estate category fieldset since other empty
    // sub-pill summaries (Non-Liquid, Debt headline) also use em-dash.
    const realEstate = screen.getByText("Real Estate").closest("fieldset")!;
    expect(within(realEstate).getByText("\u2014")).toBeInTheDocument();
    expect(screen.getByText("None scheduled")).toBeInTheDocument();
    expect(screen.getByText(/Inflation 2\.0%/)).toBeInTheDocument();
  });

  it("hides a category's summary while it is expanded and shows it once collapsed", async () => {
    const user = userEvent.setup();
    render(<Host />);
    // Assets and Debt starts open, so its 'Net' summary should not be
    // in the DOM. Post V2-C the value + label spans render with
    // visual `gap-x-2` separation rather than a literal middle-dot,
    // so the regex matches the concatenated textContent of the
    // summary div via the joined-text helper.
    expect(
      queryElementByJoinedText(/^Net .{1,3}10K5\.0% return on Portfolio$/)
    ).toBeNull();
    // Collapse it; the summary should appear in its header row, including
    // the Expected annual return appended after the net headline.
    await user.click(screen.getByRole("button", { name: /assets and debt/i }));
    expect(
      getElementByJoinedText(/^Net .{1,3}10K5\.0% return on Portfolio$/)
    ).toBeInTheDocument();
  });

  it("updates the Assets and Debt summary when the Expected annual return changes", async () => {
    const user = userEvent.setup();
    render(<Host />);
    // The Expected annual return slider lives in the Liquid sub-pill, which
    // starts collapsed. Expand it, bump the slider, then collapse the
    // parent Assets and Debt pill so the summary line is rendered in its
    // header. The slider is a native range input with aria-label = its
    // SliderSpec label ("Expected annual return").
    await expand(/^Liquid$/i);
    const slider = screen.getByLabelText("Expected annual return") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "0.07" } });
    await user.click(screen.getByRole("button", { name: /assets and debt/i }));
    // Post V2-C the value + label spans render with visual `gap-x-2`
    // separation rather than a literal middle-dot, so the regex
    // matches the concatenated textContent of the summary div via
    // the joined-text helper.
    expect(
      getElementByJoinedText(/^Net .{1,3}10K7\.0% return on Portfolio$/)
    ).toBeInTheDocument();
  });

  it("updates the Life Events summary when a windfall amount is entered", async () => {
    const user = userEvent.setup();
    render(<Host />);
    expect(screen.getByText("None scheduled")).toBeInTheDocument();

    await expand(/life events/i);
    await user.click(screen.getByRole("button", { name: /^\+ add windfall$/i }));
    const card = screen.getByTestId("windfall-card-0");
    const amount = within(card).getByLabelText("Amount") as HTMLInputElement;
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

  it("renders a freshly-added windfall card's Year slider with an 'in 5 years' helper at the default", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(screen.getByRole("button", { name: /^\+ add windfall$/i }));
    const card = screen.getByTestId("windfall-card-0");
    const slider = within(card).getByLabelText("Year") as HTMLInputElement;
    expect(slider.type).toBe("range");
    const currentYear = new Date().getFullYear();
    expect(slider.value).toBe(String(currentYear + 5));
    expect(within(card).getByText(String(currentYear + 5))).toBeInTheDocument();
    expect(within(card).getByText("in 5 years")).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: /^\+ add windfall$/i }));
    const wfCard = screen.getByTestId("windfall-card-0");
    const amount = within(wfCard).getByLabelText("Amount") as HTMLInputElement;
    await user.clear(amount);
    await user.type(amount, "50000");
    await user.tab();
    await user.click(
      screen.getByRole("button", { name: /add real estate investment/i })
    );

    // Post V2-C the value + label spans render with visual `gap-x-2`
    // separation rather than a literal middle-dot, so the joined-text
    // helper walks down to the summary div whose flattened textContent
    // matches the regex (default `getByText` can't match across two
    // sibling text nodes).
    await user.click(screen.getByRole("button", { name: /life events/i }));
    expect(
      getElementByJoinedText(
        /Windfall .{1,3}50K in \d{4}1 real estate investment/i
      )
    ).toBeInTheDocument();
  });
});

describe("Windfall events", () => {
  it("renders no windfall cards by default", async () => {
    render(<Host />);
    await expand(/life events/i);
    expect(screen.queryByTestId("windfall-card-0")).toBeNull();
    expect(
      screen.getByRole("button", { name: /^\+ add windfall$/i })
    ).toBeInTheDocument();
  });

  it("adds a card with Amount + Year fields when the Add button is clicked", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(screen.getByRole("button", { name: /^\+ add windfall$/i }));
    const card = screen.getByTestId("windfall-card-0");
    expect(within(card).getByLabelText("Amount")).toBeInTheDocument();
    expect(within(card).getByLabelText("Year")).toBeInTheDocument();
    // Default amount is 0 and the year is currentYear + 5.
    const amount = within(card).getByLabelText("Amount") as HTMLInputElement;
    const year = within(card).getByLabelText("Year") as HTMLInputElement;
    expect(amount.value).toBe("0");
    expect(year.value).toBe(String(new Date().getFullYear() + 5));
  });

  it("stacks multiple windfall cards independently", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    const addBtn = screen.getByRole("button", { name: /^\+ add windfall$/i });
    await user.click(addBtn);
    await user.click(addBtn);
    expect(screen.getByTestId("windfall-card-0")).toBeInTheDocument();
    expect(screen.getByTestId("windfall-card-1")).toBeInTheDocument();
  });

  it("updates the amount of a specific card without affecting siblings", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    const addBtn = screen.getByRole("button", { name: /^\+ add windfall$/i });
    await user.click(addBtn);
    await user.click(addBtn);

    const cardA = screen.getByTestId("windfall-card-0");
    const cardB = screen.getByTestId("windfall-card-1");
    const amountA = within(cardA).getByLabelText("Amount") as HTMLInputElement;
    const amountB = within(cardB).getByLabelText("Amount") as HTMLInputElement;

    await user.clear(amountA);
    await user.type(amountA, "75000");
    await user.tab();

    expect(amountA.value).toBe("75,000");
    expect(amountB.value).toBe("0");
  });

  it("removes a specific card when its remove button is clicked", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    const addBtn = screen.getByRole("button", { name: /^\+ add windfall$/i });
    await user.click(addBtn);
    await user.click(addBtn);
    expect(screen.getByTestId("windfall-card-1")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /remove windfall 1/i })
    );

    // After removal of the first card, the remaining one re-indexes to 0.
    expect(screen.getByTestId("windfall-card-0")).toBeInTheDocument();
    expect(screen.queryByTestId("windfall-card-1")).toBeNull();
  });

  it("collapses to a count when more than one windfall is added", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    const addBtn = screen.getByRole("button", { name: /^\+ add windfall$/i });
    await user.click(addBtn);
    await user.click(addBtn);
    // Collapse Life Events so the summary line renders in the header.
    await user.click(screen.getByRole("button", { name: /life events/i }));
    expect(screen.getByText(/2 windfalls/)).toBeInTheDocument();
  });

  it("shows the inflation-adjusted future value next to the relative year in the helper text", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(screen.getByRole("button", { name: /^\+ add windfall$/i }));

    const card = screen.getByTestId("windfall-card-0");
    const amount = within(card).getByLabelText("Amount") as HTMLInputElement;
    await user.clear(amount);
    await user.type(amount, "10000");
    await user.tab();

    const yearsToLanding = 5;
    const yearSlider = within(card).getByLabelText("Year") as HTMLInputElement;
    fireEvent.change(yearSlider, {
      target: { value: String(new Date().getFullYear() + yearsToLanding) }
    });

    // Helper must surface the *nominal* (inflation-adjusted) deposit the
    // engine actually credits at landing year, not the today's-money input.
    // We don't hard-code the currency symbol (it depends on the locale set
    // by CurrencyProvider); just match the inflated thousands + relative
    // phrase. format() rounds to whole units for amounts >= 1000.
    const inflated = Math.round(
      10_000 * (1 + DEFAULT_PLAN_INPUTS.inflationRate) ** yearsToLanding
    );
    const formatted = inflated.toLocaleString("en-US");
    expect(formatted).not.toBe("10,000"); // sanity-check: non-zero inflation default
    expect(
      within(card).getByText(new RegExp(`${formatted} in ${yearsToLanding} years`))
    ).toBeInTheDocument();
  });

  it("falls back to just the relative year when no windfall amount has been entered yet", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(screen.getByRole("button", { name: /^\+ add windfall$/i }));
    const card = screen.getByTestId("windfall-card-0");
    // Default year = current year + 5, so the helper reads "in 5 years".
    expect(within(card).getByText("in 5 years")).toBeInTheDocument();
    // No formatted amount appears anywhere in the card while amount is 0.
    expect(within(card).queryByText(/[0-9],[0-9]/)).toBeNull();
  });

  it("renders windfalls before real estate investments inside Life Events", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(screen.getByRole("button", { name: /^\+ add windfall$/i }));
    await user.click(
      screen.getByRole("button", { name: /add real estate investment/i })
    );
    const wfCard = screen.getByTestId("windfall-card-0");
    const reCard = screen.getByTestId("re-investment-card-0");
    // Windfall card precedes RE investment card in document order.
    expect(
      wfCard.compareDocumentPosition(reCard) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
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

  it("adds a card with Value + appreciation + Annual rental income + rental appreciation when the Add button is clicked", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/real estate/i);
    await user.click(
      screen.getByRole("button", { name: /^\+ add real estate$/i })
    );
    const card = screen.getByTestId("re-holding-card-0");
    expect(within(card).getByLabelText("Value")).toBeInTheDocument();
    expect(within(card).getByText("Annual appreciation rate")).toBeInTheDocument();
    expect(within(card).getByLabelText("Annual rental income")).toBeInTheDocument();
    expect(
      within(card).getByText("Rental income annual appreciation")
    ).toBeInTheDocument();
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
    // collapsed Real Estate header. Scope to the Real Estate fieldset
    // since other empty sub-pill summaries also use em-dash.
    const realEstate = screen.getByText("Real Estate").closest("fieldset")!;
    expect(within(realEstate).getByText("\u2014")).toBeInTheDocument();

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
    expect(within(realEstate).queryByText("\u2014")).toBeNull();
    expect(screen.getByText(/450K/)).toBeInTheDocument();
  });

  // Regression for the migration to CollapsiblePill: each holding card
  // is now itself a sub-pill that mounts EXPANDED on +Add (newly-added
  // ID is tracked in PlannerForm's local set) and collapses to a single
  // summary line combining current value and annual rental income.
  it("auto-expands a freshly-added holding and shows the value + rent summary on collapse", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/real estate/i);
    await user.click(
      screen.getByRole("button", { name: /^\+ add real estate$/i })
    );
    const card = screen.getByTestId("re-holding-card-0");
    // Card mounts expanded: inner fields are visible immediately and no
    // collapsed-state summary is rendered.
    expect(within(card).getByLabelText("Value")).toBeInTheDocument();
    expect(within(card).queryByTestId("re-holding-card-0-summary")).toBeNull();

    // Fill in both a value and an annual rental income so the joined
    // form of the summary (value as the bold span + "rent/yr" as the
    // soft label span) fires.
    const valueField = within(card).getByLabelText("Value") as HTMLInputElement;
    await user.clear(valueField);
    await user.type(valueField, "450000");
    await user.tab();
    const rentField = within(card).getByLabelText(
      "Annual rental income"
    ) as HTMLInputElement;
    await user.clear(rentField);
    await user.type(rentField, "12000");
    await user.tab();

    // Collapse via the corner chevron (the only toggle button on per-
    // card pills since the legend became an editable label input).
    // Anchor on the chevron's aria-label so we don't catch the
    // sibling Remove button or the parent category header.
    await user.click(
      within(card).getByRole("button", { name: /^Collapse Real Estate 1$/i })
    );
    expect(within(card).queryByLabelText("Value")).toBeNull();
    const summary = within(card).getByTestId("re-holding-card-0-summary");
    // Post V2-C the value and label render as separate spans with
    // `gap-x-2` visual separation (no literal " · " in the DOM), so
    // textContent concatenates the two segments directly.
    expect(summary.textContent).toMatch(/450,000/);
    expect(summary.textContent).toMatch(/12,000 rent\/yr/);

    // Re-expand via the chevron — its aria-label flips to
    // `Expand Real Estate 1` while collapsed. Confirms the toggle
    // round-trips and the fields return with the values we typed in
    // still preserved.
    await user.click(
      within(card).getByRole("button", { name: /^Expand Real Estate 1$/i })
    );
    const reopenedValue = within(card).getByLabelText("Value") as HTMLInputElement;
    expect(reopenedValue.value).toBe("450,000");
  });

  // Loaded holdings (page reload, hydrated from storage, anything that
  // wasn't added during this PlannerForm mount) default to COLLAPSED so
  // the form doesn't dump every saved property's fields on the user.
  it("loaded holdings default to collapsed and show the value-only summary when rent is 0", async () => {
    const seeded: PlanInputs = {
      ...DEFAULT_PLAN_INPUTS,
      realEstateHoldings: [
        {
          ...makeDefaultRealEstateHolding(),
          value: 600000,
          annualRentalIncome: 0
        }
      ]
    };
    function SeededHost() {
      const [v, setV] = useState<PlanInputs>(seeded);
      return (
        <CurrencyProvider>
          <PlannerForm value={v} onChange={setV} onReset={vi.fn()} />
        </CurrencyProvider>
      );
    }
    render(<SeededHost />);
    await expand(/real estate/i);
    const card = screen.getByTestId("re-holding-card-0");
    // Card is collapsed: inner fields hidden, summary present and
    // showing the value-only form (no "rent/yr" label span because
    // annualRentalIncome is 0). Post V2-C the value-only summary is
    // a single bold-navy span with no label sibling, so textContent
    // contains just the value text.
    expect(within(card).queryByLabelText("Value")).toBeNull();
    const summary = within(card).getByTestId("re-holding-card-0-summary");
    expect(summary.textContent).toMatch(/600,000/);
    expect(summary.textContent).not.toContain("rent/yr");
  });
});

describe("New debt events", () => {
  it("renders no new-debt cards by default", async () => {
    render(<Host />);
    await expand(/life events/i);
    expect(screen.queryByTestId("new-debt-card-0")).toBeNull();
    expect(
      screen.getByRole("button", { name: /^\+ add new debt$/i })
    ).toBeInTheDocument();
  });

  it("adds a card with Principal + interest rate + repayment + a single dual-handle Loan period range slider when Add is clicked", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(screen.getByRole("button", { name: /^\+ add new debt$/i }));
    const card = screen.getByTestId("new-debt-card-0");
    expect(within(card).getByLabelText("Principal")).toBeInTheDocument();
    expect(within(card).getByText("Annual interest rate")).toBeInTheDocument();
    expect(
      within(card).getByLabelText(/repayment type for new debt 1/i)
    ).toBeInTheDocument();
    // The two old "Start year" / "Loan end year" sliders collapse to a
    // single "Loan period" range slider with two thumbs.
    expect(within(card).getByText("Loan period")).toBeInTheDocument();
    expect(within(card).queryByText("Start year")).toBeNull();
    expect(within(card).queryByText("Loan end year")).toBeNull();
    // Two thumbs (Radix Slider exposes role="slider" per thumb), plus
    // the existing Annual interest rate single-handle slider = 3 total.
    const sliders = within(card).getAllByRole("slider");
    expect(sliders).toHaveLength(3);
    expect(
      within(card).getByLabelText(/start year for new debt 1/i)
    ).toBeInTheDocument();
    expect(
      within(card).getByLabelText(/loan end year for new debt 1/i)
    ).toBeInTheDocument();
    // Defaults: principal 0, startYear current+5, endYear current+10
    // → helpers carry the relative-time prefix when principal is 0.
    expect(within(card).getByText(/^Start: in 5 years$/)).toBeInTheDocument();
    expect(within(card).getByText(/^End: in 10 years$/)).toBeInTheDocument();
    const principal = within(card).getByLabelText("Principal") as HTMLInputElement;
    expect(principal.value).toBe("0");
  });

  it("swaps the End helper prefix to 'Lump sum repayment:' (and the end-thumb aria-label to 'Lump sum repayment year') when repayment is set to inFine", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(screen.getByRole("button", { name: /^\+ add new debt$/i }));
    const card = screen.getByTestId("new-debt-card-0");
    const select = within(card).getByLabelText(
      /repayment type for new debt 1/i
    ) as HTMLSelectElement;
    await user.selectOptions(select, "inFine");
    // Helper text under the slider gets the inFine prefix; the Start helper
    // is still present and unaffected.
    expect(
      within(card).getByText(/^Lump sum repayment: in 10 years$/)
    ).toBeInTheDocument();
    expect(within(card).queryByText(/^End: /)).toBeNull();
    expect(within(card).getByText(/^Start: in 5 years$/)).toBeInTheDocument();
    // Per-thumb aria-label also swaps so screen readers announce the
    // new semantic role of the second handle.
    expect(
      within(card).getByLabelText(/lump sum repayment year for new debt 1/i)
    ).toBeInTheDocument();
    expect(
      within(card).queryByLabelText(/loan end year for new debt 1/i)
    ).toBeNull();
  });

  it("enforces start <= end on the Loan period range slider (the start thumb cannot cross the end thumb)", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(screen.getByRole("button", { name: /^\+ add new debt$/i }));
    const card = screen.getByTestId("new-debt-card-0");
    // Defaults: startYear = current+5, endYear = current+10 → 5 steps
    // between thumbs. Pressing ArrowRight on the start thumb 50 times
    // should advance it up to the end thumb's value but not past it
    // (Radix's default with minStepsBetweenThumbs=0 clamps at equality).
    const startThumb = within(card).getByLabelText(
      /start year for new debt 1/i
    );
    const endThumb = within(card).getByLabelText(/loan end year for new debt 1/i);
    const endValue = Number(endThumb.getAttribute("aria-valuenow"));
    expect(endValue).toBeGreaterThan(0);
    startThumb.focus();
    for (let i = 0; i < 50; i++) {
      await user.keyboard("{ArrowRight}");
    }
    const finalStartValue = Number(startThumb.getAttribute("aria-valuenow"));
    expect(finalStartValue).toBeLessThanOrEqual(endValue);
    expect(finalStartValue).toBe(endValue);
  });

  it("stacks multiple new-debt cards independently", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    const addBtn = screen.getByRole("button", { name: /^\+ add new debt$/i });
    await user.click(addBtn);
    await user.click(addBtn);
    expect(screen.getByTestId("new-debt-card-0")).toBeInTheDocument();
    expect(screen.getByTestId("new-debt-card-1")).toBeInTheDocument();
  });

  it("updates a specific card's principal without affecting siblings", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    const addBtn = screen.getByRole("button", { name: /^\+ add new debt$/i });
    await user.click(addBtn);
    await user.click(addBtn);
    const cardA = screen.getByTestId("new-debt-card-0");
    const cardB = screen.getByTestId("new-debt-card-1");
    const principalA = within(cardA).getByLabelText("Principal") as HTMLInputElement;
    const principalB = within(cardB).getByLabelText("Principal") as HTMLInputElement;

    await user.clear(principalA);
    await user.type(principalA, "200000");
    await user.tab();

    expect(principalA.value).toBe("200,000");
    expect(principalB.value).toBe("0");
  });

  it("removes a specific card when its remove button is clicked", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    const addBtn = screen.getByRole("button", { name: /^\+ add new debt$/i });
    await user.click(addBtn);
    await user.click(addBtn);
    expect(screen.getByTestId("new-debt-card-1")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /remove new debt 1/i })
    );

    // After removal of the first card, the remaining one re-indexes to 0.
    expect(screen.getByTestId("new-debt-card-0")).toBeInTheDocument();
    expect(screen.queryByTestId("new-debt-card-1")).toBeNull();
  });

  it("includes the new-debt count in the collapsed Life Events summary", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    const addBtn = screen.getByRole("button", { name: /^\+ add new debt$/i });
    await user.click(addBtn);
    await user.click(addBtn);
    // Collapse Life Events so the summary pill renders.
    await user.click(screen.getByRole("button", { name: /^life events$/i }));
    expect(screen.getByText(/2 new debts/i)).toBeInTheDocument();
  });

  it("shows the inflation-adjusted principal in the Start year helper when principal > 0", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(screen.getByRole("button", { name: /^\+ add new debt$/i }));
    const card = screen.getByTestId("new-debt-card-0");
    const principal = within(card).getByLabelText("Principal") as HTMLInputElement;

    // Default startYear = currentYear + 5; default inflation = 2%.
    // With principal = 100K, inflated = 100_000 * 1.02^5 ≈ 110,408.
    await user.clear(principal);
    await user.type(principal, "100000");
    await user.tab();

    // Helper line keeps the "Start:" prefix and combines the inflated
    // value with the relative-time phrase, e.g. "Start: €110K in 5 years".
    expect(
      within(card).getByText(/^Start: .*11.*in 5 years$/)
    ).toBeInTheDocument();
  });

  it("falls back to 'Start: <relative phrase>' (no currency) in the Start helper when principal is 0", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(screen.getByRole("button", { name: /^\+ add new debt$/i }));
    const card = screen.getByTestId("new-debt-card-0");
    expect(within(card).getByText("Start: in 5 years")).toBeInTheDocument();
  });

  it("renders a two-line collapsed summary on the New Debt card: headline (inflated principal + start year) on top, schedule helper line below", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(screen.getByRole("button", { name: /^\+ add new debt$/i }));
    const card = screen.getByTestId("new-debt-card-0");
    const principal = within(card).getByLabelText("Principal") as HTMLInputElement;
    await user.clear(principal);
    await user.type(principal, "100000");
    await user.tab();

    // Capture the in-card schedule helper text BEFORE collapsing — we'll
    // assert the collapsed summary surfaces the same string verbatim,
    // which is the contract `formatNewDebtScheduleText` enforces.
    const inCardSchedule = within(card).getByTestId(
      "new-debt-schedule-summary-0"
    ).textContent!;
    expect(inCardSchedule).toMatch(/Annual repayment/);

    // Collapse via the corner chevron (the only toggle button on per-
    // card pills since the legend became an editable label input).
    // Anchor on the chevron's aria-label to avoid catching the sibling
    // "Remove new debt 1" button.
    await user.click(
      within(card).getByRole("button", { name: /^Collapse New Debt 1$/i })
    );

    // Post V2-C the summary is one flex container with a value span +
    // label span separated visually by `gap-x-2` (no literal " · " in
    // the DOM), so we assert against the flattened textContent rather
    // than against per-line <div>s.
    const summary = within(card).getByTestId("new-debt-card-0-summary");
    // Headline (value): with default inflateAmount=true, principal=100K
    // and startYear = currentYear+5 at 2% inflation, the displayed
    // amount lands around €110,408. Assert the year format and a "11"
    // substring (matches "110,408" / "€110.4K" etc.) instead of "100"
    // so we lock in that the headline tracks the inflated value.
    expect(summary.textContent).toMatch(/from \d{4}/);
    expect(summary.textContent).toMatch(/11/);
    expect(summary.textContent).not.toMatch(/100,000|100000/);
    // Label: identical to the in-card schedule paragraph (the schedule
    // helper text is appended verbatim after the value span).
    expect(summary.textContent).toContain(inCardSchedule);
  });

  it("collapsed New Debt headline drops back to the entered face value when 'Adjust amount for inflation' is unchecked", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(screen.getByRole("button", { name: /^\+ add new debt$/i }));
    const card = screen.getByTestId("new-debt-card-0");
    const principal = within(card).getByLabelText("Principal") as HTMLInputElement;
    await user.clear(principal);
    await user.type(principal, "100000");
    await user.tab();

    // Toggle inflateAmount OFF — face value should now flow through to
    // both the in-card helper AND the collapsed summary headline.
    const toggle = within(card).getByLabelText(
      /adjust amount for inflation \(new debt 1\)/i
    ) as HTMLInputElement;
    await user.click(toggle);
    expect(toggle.checked).toBe(false);

    // Collapse via the corner chevron and inspect the headline.
    await user.click(
      within(card).getByRole("button", { name: /^Collapse New Debt 1$/i })
    );
    // Post V2-C the summary flattens to a single string joined by
    // SUMMARY_SEP; the headline now shows the raw entered amount
    // (100,000) and never the inflated ~110K.
    const summary = within(card).getByTestId("new-debt-card-0-summary");
    expect(summary.textContent).toMatch(/100/);
    expect(summary.textContent).not.toMatch(/110/);
  });
});

describe("inflateAmount toggle", () => {
  // The "Adjust amount for inflation" checkbox sits below the Amount /
  // Principal field on every life-event card. Checked is the historical
  // default (today's-money input inflated to landing year); unchecking
  // makes the entered amount land at face value AND drops the
  // inflation-adjusted preview from the helper line.

  it("renders a checked toggle on a freshly-added Windfall card", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(screen.getByRole("button", { name: /^\+ add windfall$/i }));
    const card = screen.getByTestId("windfall-card-0");
    const toggle = within(card).getByLabelText(
      /adjust amount for inflation \(windfall 1\)/i
    ) as HTMLInputElement;
    expect(toggle.type).toBe("checkbox");
    expect(toggle.checked).toBe(true);
  });

  it("renders a checked toggle on a freshly-added Real Estate Investment card", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(
      screen.getByRole("button", { name: /add real estate investment/i })
    );
    const card = screen.getByTestId("re-investment-card-0");
    const toggle = within(card).getByLabelText(
      /adjust amount for inflation \(real estate investment 1\)/i
    ) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
  });

  it("renders a checked toggle on a freshly-added New Debt card", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(screen.getByRole("button", { name: /^\+ add new debt$/i }));
    const card = screen.getByTestId("new-debt-card-0");
    const toggle = within(card).getByLabelText(
      /adjust amount for inflation \(new debt 1\)/i
    ) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
  });

  it("swaps the Windfall's Year helper from the inflated preview to the face value when unchecked", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(screen.getByRole("button", { name: /^\+ add windfall$/i }));
    const card = screen.getByTestId("windfall-card-0");
    const amount = within(card).getByLabelText("Amount") as HTMLInputElement;
    await user.clear(amount);
    await user.type(amount, "10000");
    await user.tab();

    // Default inflation > 0 so the inflated preview shows up while the
    // toggle stays checked.
    const yearsToLanding = 5;
    const inflated = Math.round(
      10_000 * (1 + DEFAULT_PLAN_INPUTS.inflationRate) ** yearsToLanding
    );
    const inflatedFmt = inflated.toLocaleString("en-US");
    expect(inflatedFmt).not.toBe("10,000"); // sanity-check: non-zero default inflation
    expect(
      within(card).getByText(new RegExp(`${inflatedFmt} in ${yearsToLanding} years`))
    ).toBeInTheDocument();

    // Uncheck → helper should swap to the entered face value paired with
    // the same relative timing (e.g. "€10,000 in 5 years"). The inflated
    // figure should disappear from the card.
    const toggle = within(card).getByLabelText(
      /adjust amount for inflation \(windfall 1\)/i
    ) as HTMLInputElement;
    await user.click(toggle);
    expect(toggle.checked).toBe(false);
    expect(
      within(card).getByText(new RegExp(`10,000 in ${yearsToLanding} years`))
    ).toBeInTheDocument();
    expect(within(card).queryByText(new RegExp(inflatedFmt))).toBeNull();
  });

  it("swaps the Real Estate Investment's Purchase year helper from the inflated preview to the face value when unchecked", async () => {
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

    const yearsToPurchase = 5; // default purchase year = currentYear + 5
    const inflated = Math.round(
      1_000_000 * (1 + DEFAULT_PLAN_INPUTS.inflationRate) ** yearsToPurchase
    );
    const inflatedFmt = inflated.toLocaleString("en-US");
    expect(inflatedFmt).not.toBe("1,000,000"); // sanity-check: non-zero default inflation
    expect(
      within(card).getByText(new RegExp(`${inflatedFmt} in ${yearsToPurchase} years`))
    ).toBeInTheDocument();

    const toggle = within(card).getByLabelText(
      /adjust amount for inflation \(real estate investment 1\)/i
    ) as HTMLInputElement;
    await user.click(toggle);
    expect(toggle.checked).toBe(false);
    expect(
      within(card).getByText(new RegExp(`1,000,000 in ${yearsToPurchase} years`))
    ).toBeInTheDocument();
    expect(within(card).queryByText(new RegExp(inflatedFmt))).toBeNull();
  });

  it("swaps the New Debt's Start year helper from the inflated preview to the face value when unchecked", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(screen.getByRole("button", { name: /^\+ add new debt$/i }));
    const card = screen.getByTestId("new-debt-card-0");
    const principal = within(card).getByLabelText("Principal") as HTMLInputElement;

    await user.clear(principal);
    await user.type(principal, "100000");
    await user.tab();

    // Default startYear = currentYear + 5, default inflation = 2% → 100K *
    // 1.02^5 ≈ 110,408. Helper surfaces the inflated value while toggle
    // stays checked.
    expect(within(card).getByText(/110/)).toBeInTheDocument();

    const toggle = within(card).getByLabelText(
      /adjust amount for inflation \(new debt 1\)/i
    ) as HTMLInputElement;
    await user.click(toggle);
    expect(toggle.checked).toBe(false);
    // After unchecking, the helper pairs the entered face-value principal
    // with the same relative timing (e.g. "€100,000 in 5 years") instead
    // of the inflated preview.
    expect(within(card).getByText(/100,000 in 5 years/)).toBeInTheDocument();
    expect(within(card).queryByText(/110,408/)).toBeNull();
  });

  it("uses the entered principal (not inflated) in the New Debt schedule summary when unchecked", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(screen.getByRole("button", { name: /^\+ add new debt$/i }));
    const card = screen.getByTestId("new-debt-card-0");
    const principal = within(card).getByLabelText("Principal") as HTMLInputElement;
    await user.clear(principal);
    await user.type(principal, "100000");
    await user.tab();

    // Default overTime + interest 2% + 5-year window. Inflated principal
    // (toggle checked) = 100K * 1.02^5 ≈ 110,408 → annual repayment ≈
    // 23,420. Face-value principal (toggle unchecked) → annual repayment
    // ≈ 21,216 (for 100K @ 2% / 5y). We assert direction: the figure shown
    // before/after the toggle changes meaningfully.
    const summaryBefore = within(card).getByTestId(
      "new-debt-schedule-summary-0"
    ).textContent!;
    expect(summaryBefore).toMatch(/Annual repayment/i);

    const toggle = within(card).getByLabelText(
      /adjust amount for inflation \(new debt 1\)/i
    ) as HTMLInputElement;
    await user.click(toggle);

    const summaryAfter = within(card).getByTestId(
      "new-debt-schedule-summary-0"
    ).textContent!;
    expect(summaryAfter).toMatch(/Annual repayment/i);
    expect(summaryAfter).not.toBe(summaryBefore);
  });
});

describe("Card label customization", () => {
  // Every stackable per-card pill (Windfall, Real Estate Investment,
  // New Debt, Real Estate Holding) renders an editable text input in
  // its legend instead of the static toggle button. The input shows
  // the auto-numbered default ("Windfall 1", etc.) as a placeholder
  // when the stored `label` is empty, so freshly-added cards keep
  // their identity. Typing into the input updates `event.label` /
  // `holding.label`; clearing it restores the placeholder. Toggle
  // accessibility moves to the corner chevron, which the
  // architectural test elsewhere already verifies.

  it("renders the auto-numbered default as the input placeholder on a freshly-added Windfall", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(screen.getByRole("button", { name: /^\+ add windfall$/i }));
    const card = screen.getByTestId("windfall-card-0");
    const input = within(card).getByRole("textbox", {
      name: /Edit label, defaults to "Windfall 1"/i
    }) as HTMLInputElement;
    // Empty value, default surfaced via `placeholder` so the user sees
    // "Windfall 1" but the underlying stored label is still "".
    expect(input.value).toBe("");
    expect(input.placeholder).toBe("Windfall 1");
  });

  it("propagates a typed Windfall label to the legend input AND survives a collapse + re-expand round-trip via the chevron", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(screen.getByRole("button", { name: /^\+ add windfall$/i }));
    const card = screen.getByTestId("windfall-card-0");

    const input = within(card).getByRole("textbox", {
      name: /Edit label, defaults to "Windfall 1"/i
    }) as HTMLInputElement;
    await user.click(input);
    await user.type(input, "Inheritance");
    expect(input.value).toBe("Inheritance");
    // The chevron's accessible name reflects the live label so SR users
    // hear "Collapse Inheritance" / "Expand Inheritance" once the user
    // has named the card.
    expect(
      within(card).getByRole("button", { name: /^Collapse Inheritance$/i })
    ).toBeInTheDocument();

    // Collapse + re-expand via the chevron — label persists across the
    // toggle (it lives on `event.label` in the parent state).
    await user.click(
      within(card).getByRole("button", { name: /^Collapse Inheritance$/i })
    );
    await user.click(
      within(card).getByRole("button", { name: /^Expand Inheritance$/i })
    );
    const reopenedInput = within(card).getByRole("textbox", {
      name: /Edit label, defaults to "Windfall 1"/i
    }) as HTMLInputElement;
    expect(reopenedInput.value).toBe("Inheritance");
  });

  it("falls back to the auto-numbered placeholder once the user clears a previously-typed label", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(
      screen.getByRole("button", { name: /add real estate investment/i })
    );
    const card = screen.getByTestId("re-investment-card-0");

    const input = within(card).getByRole("textbox", {
      name: /Edit label, defaults to "Real Estate Investment 1"/i
    }) as HTMLInputElement;
    await user.click(input);
    await user.type(input, "Beach house");
    expect(input.value).toBe("Beach house");

    // Clear the field — chevron aria-label reverts to the auto-numbered
    // default and the placeholder reappears (stored label is empty).
    await user.clear(input);
    expect(input.value).toBe("");
    expect(input.placeholder).toBe("Real Estate Investment 1");
    expect(
      within(card).getByRole("button", {
        name: /^Collapse Real Estate Investment 1$/i
      })
    ).toBeInTheDocument();
  });

  it("clicking the legend label input on a collapsed card does NOT expand the card (stopPropagation guards the click-to-expand body handler)", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/real estate/i);
    await user.click(
      screen.getByRole("button", { name: /^\+ add real estate$/i })
    );
    const card = screen.getByTestId("re-holding-card-0");

    // Collapse via chevron first, then click the legend input — the
    // body click-to-expand handler should NOT fire because the input
    // calls e.stopPropagation().
    await user.click(
      within(card).getByRole("button", { name: /^Collapse Real Estate 1$/i })
    );
    expect(within(card).queryByLabelText("Value")).toBeNull();

    const input = within(card).getByRole("textbox", {
      name: /Edit label, defaults to "Real Estate 1"/i
    });
    await user.click(input);
    // Card stays collapsed: still no Value field, and the chevron
    // continues to read "Expand …".
    expect(within(card).queryByLabelText("Value")).toBeNull();
    expect(
      within(card).getByRole("button", { name: /^Expand Real Estate 1$/i })
    ).toBeInTheDocument();
  });

  it("clicking the pencil edit affordance focuses + selects the legend input (and does NOT expand a collapsed card)", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await expand(/life events/i);
    await user.click(screen.getByRole("button", { name: /^\+ add new debt$/i }));
    const card = screen.getByTestId("new-debt-card-0");

    const input = within(card).getByRole("textbox", {
      name: /Edit label, defaults to "New Debt 1"/i
    }) as HTMLInputElement;
    await user.click(input);
    await user.type(input, "Mortgage");

    // Collapse and click the pencil. Focus moves back to the input
    // (so the user can immediately start editing) and the selection
    // covers the entire current value.
    await user.click(
      within(card).getByRole("button", { name: /^Collapse Mortgage$/i })
    );
    const pencil = within(card).getByRole("button", { name: /^Edit label$/i });
    await user.click(pencil);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("Mortgage".length);
    // Card remains collapsed: pencil click also stops propagation, so
    // the body click-to-expand handler does not fire.
    expect(within(card).queryByLabelText("Principal")).toBeNull();
  });

  it("seeded plans hydrate custom labels into the legend input on initial render (round-trips through PlanInputs state)", async () => {
    const seeded: PlanInputs = {
      ...DEFAULT_PLAN_INPUTS,
      events: [
        {
          ...makeDefaultRealEstateInvestment(),
          label: "Lake cabin"
        }
      ],
      realEstateHoldings: [
        {
          ...makeDefaultRealEstateHolding(),
          label: "Primary home"
        }
      ]
    };
    function SeededHost() {
      const [v, setV] = useState<PlanInputs>(seeded);
      return (
        <CurrencyProvider>
          <PlannerForm value={v} onChange={setV} onReset={vi.fn()} />
        </CurrencyProvider>
      );
    }
    render(<SeededHost />);

    // Both seeded labels surface in their respective legend inputs
    // straight away. The aria-label still references the auto-numbered
    // default (so SR users always know what the field is) but the
    // value is the user's stored string.
    await expand(/life events/i);
    // Anchor the parent-category Real Estate header — the seeded
    // holding's chevron also matches /real estate/i.
    await expand(/^Real Estate$/i);

    const reInvestCard = screen.getByTestId("re-investment-card-0");
    const reInvestInput = within(reInvestCard).getByRole("textbox", {
      name: /Edit label, defaults to "Real Estate Investment 1"/i
    }) as HTMLInputElement;
    expect(reInvestInput.value).toBe("Lake cabin");

    const holdingCard = screen.getByTestId("re-holding-card-0");
    const holdingInput = within(holdingCard).getByRole("textbox", {
      name: /Edit label, defaults to "Real Estate 1"/i
    }) as HTMLInputElement;
    expect(holdingInput.value).toBe("Primary home");
  });
});
