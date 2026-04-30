"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { CurrencyField } from "./CurrencyField";
import { FramedField } from "./FramedField";
import { RangeSliderRow } from "./RangeSlider";
import { useCurrency } from "@/features/currency/CurrencyContext";
import {
  DEBT_REPAYMENT_TYPES,
  MAX_APPRECIATION,
  MAX_DEBT_INTEREST_RATE,
  MAX_HORIZON_YEARS,
  MAX_RETIREMENT_AGE,
  MIN_APPRECIATION,
  MIN_DEBT_INTEREST_RATE,
  MIN_HORIZON_YEARS,
  MIN_RETIREMENT_AGE,
  computeOverTimeAnnualPayment,
  makeDefaultNewDebtEvent,
  makeDefaultRealEstateHolding,
  makeDefaultRealEstateInvestment,
  makeDefaultWindfallEvent,
  type DebtRepaymentType,
  type LifeEvent,
  type NewDebtEvent,
  type PlanInputs,
  type RealEstateHolding,
  type RealEstateInvestmentEvent,
  type WindfallEvent
} from "@app/core";

type Props = {
  value: PlanInputs;
  onChange: (next: PlanInputs) => void;
  onReset: () => void;
};

type SliderKey =
  | "nominalReturn"
  | "inflationRate"
  | "horizonYears"
  | "retirementAge"
  | "debtInterestRate"
  | "debtEndYear"
  | "nonLiquidLiquidityYear"
  | "otherFixedLiquidityYear";

type SliderSpec = {
  // The spec is metadata only — `key` is not used by `SliderRow` itself
  // (the consumer wires its own `onChange`). Top-level sliders use a
  // `SliderKey` literal so their wiring stays narrow; card-internal
  // sliders pass arbitrary identifiers. We accept the wider `string`
  // here so per-card specs aren't forced to alias a PlanInputs field.
  key: SliderKey | string;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
};

const percent = (v: number) => `${(v * 100).toFixed(1)}%`;
const years = (v: number) => `${v} year${v === 1 ? "" : "s"}`;
const age = (v: number) => `${v}`;
const rawYear = (v: number) => String(v);

// Human-readable description of a calendar year relative to "now". Used as
// helper text under year-based sliders so users don't have to subtract in
// their head.
const yearsFromNow = (year: number, now: number): string => {
  const d = year - now;
  if (d === 0) return "this year";
  if (d === 1) return "in 1 year";
  if (d > 1) return `in ${d} years`;
  if (d === -1) return "1 year ago";
  return `${-d} years ago`;
};

const NOMINAL_RETURN_SLIDER: SliderSpec = {
  key: "nominalReturn",
  label: "Expected annual return",
  min: -0.05,
  max: 0.15,
  step: 0.001,
  format: percent
};

const INFLATION_SLIDER: SliderSpec = {
  key: "inflationRate",
  label: "Inflation",
  min: 0,
  max: 0.08,
  step: 0.001,
  format: percent
};

const HORIZON_SLIDER: SliderSpec = {
  key: "horizonYears",
  label: "Projection horizon",
  min: MIN_HORIZON_YEARS,
  max: MAX_HORIZON_YEARS,
  step: 1,
  format: years
};

const RETIREMENT_AGE_SLIDER: SliderSpec = {
  key: "retirementAge",
  label: "Retirement age",
  min: MIN_RETIREMENT_AGE,
  max: MAX_RETIREMENT_AGE,
  step: 1,
  format: age
};

const DEBT_INTEREST_RATE_SLIDER: SliderSpec = {
  key: "debtInterestRate",
  label: "Annual interest rate",
  min: MIN_DEBT_INTEREST_RATE,
  max: MAX_DEBT_INTEREST_RATE,
  step: 0.001,
  format: percent
};

type AmountKey =
  | "startAssets"
  | "startDebt"
  | "monthlySpending"
  | "annualIncome"
  | "cashBalance"
  | "nonLiquidInvestments"
  | "otherFixedAssets";

type AmountSpec = {
  key: AmountKey;
  label: string;
  min: number;
  max: number;
};

const LIQUID_AMOUNTS: AmountSpec[] = [
  { key: "startAssets", label: "Financial Assets / Portfolio", min: 0, max: 100_000_000 },
  { key: "cashBalance", label: "Cash Balance", min: 0, max: 50_000_000 }
];

const NON_LIQUID_AMOUNTS: AmountSpec[] = [
  { key: "nonLiquidInvestments", label: "Private Equity", min: 0, max: 100_000_000 },
  { key: "otherFixedAssets", label: "Other Fixed Assets", min: 0, max: 100_000_000 }
];

const DEBT_AMOUNTS: AmountSpec[] = [
  { key: "startDebt", label: "Debt", min: 0, max: 50_000_000 }
];

const INCOME_EXPENSE_AMOUNTS: AmountSpec[] = [
  { key: "annualIncome", label: "Annual Salary", min: 0, max: 10_000_000 }
];

const ACCENT = {
  aboutYou: "var(--navy-soft)",
  assetsDebt: "var(--teal)",
  // `debt` is its own lane so the Debt subsection (and the New Debt
  // life-event card / + Add New Debt button) read as liabilities,
  // visually distinct from the teal Liquid/Non-Liquid asset lanes.
  // Coral was previously the Income & Expenses accent, which has now
  // moved to the new emerald lane.
  debt: "var(--coral)",
  incomeExpenses: "var(--emerald)",
  realEstate: "var(--gold)",
  lifeEvents: "var(--violet)",
  macro: "var(--slate)"
} as const;

function summarizeAboutYou(v: PlanInputs): string {
  return `Retire at ${v.retirementAge} · ${v.horizonYears}y horizon`;
}

function summarizeAssetsDebt(
  v: PlanInputs,
  formatCompact: (n: number) => string
): string {
  const net =
    v.startAssets +
    v.cashBalance +
    v.nonLiquidInvestments +
    v.otherFixedAssets -
    v.startDebt;
  return `Net ${formatCompact(net)} · ${percent(v.nominalReturn)} return on Portfolio`;
}

function summarizeIncomeExpenses(
  v: PlanInputs,
  formatCompact: (n: number) => string
): string {
  return `${formatCompact(v.annualIncome)}/yr income · ${formatCompact(v.monthlySpending)}/mo expenses`;
}

function summarizeRealEstate(
  v: PlanInputs,
  formatCompact: (n: number) => string
): string {
  const total = v.realEstateHoldings.reduce((sum, h) => sum + h.value, 0);
  return total > 0 ? formatCompact(total) : "—";
}

// Single-line totals for the three Assets & Debt sub-pills, surfaced in
// each subsection's collapsed-pill summary. The parent pill title gives
// context (Liquid / Non-Liquid / Debt), so we omit a label and just
// show the formatted total. Em-dash fallback when the bucket is empty
// mirrors the convention in `summarizeRealEstate`.
function summarizeLiquidSubsection(
  v: PlanInputs,
  format: (n: number) => string
): string {
  const total = v.startAssets + v.cashBalance;
  const totalText = total > 0 ? format(total) : "—";
  return `${totalText} · ${percent(v.nominalReturn)} return on Portfolio`;
}

function summarizeNonLiquidSubsection(
  v: PlanInputs,
  format: (n: number) => string
): string {
  const total = v.nonLiquidInvestments + v.otherFixedAssets;
  return total > 0 ? format(total) : "—";
}

function summarizeDebtSubsectionHeadline(
  v: PlanInputs,
  format: (n: number) => string
): string {
  return v.startDebt > 0 ? format(v.startDebt) : "—";
}

function summarizeLifeEvents(
  v: PlanInputs,
  formatCompact: (n: number) => string
): string {
  const windfalls = v.events.filter(
    (e): e is WindfallEvent => e.type === "windfall"
  );
  const reCount = v.events.filter((e) => e.type === "realEstateInvestment").length;
  const newDebtCount = v.events.filter((e) => e.type === "newDebt").length;
  const parts: string[] = [];
  // When there's exactly one windfall, surface its amount + year inline
  // (preserves the "Windfall $50K in 2031" line the form had before it
  // became list-based). Multiple windfalls collapse to a count to keep the
  // collapsed-pill summary single-line.
  if (windfalls.length === 1) {
    const wf = windfalls[0]!;
    if (wf.amount > 0) {
      parts.push(`Windfall ${formatCompact(wf.amount)} in ${wf.year}`);
    } else {
      parts.push("1 windfall");
    }
  } else if (windfalls.length > 1) {
    parts.push(`${windfalls.length} windfalls`);
  }
  if (reCount > 0) {
    parts.push(`${reCount} real estate investment${reCount === 1 ? "" : "s"}`);
  }
  if (newDebtCount > 0) {
    parts.push(`${newDebtCount} new debt${newDebtCount === 1 ? "" : "s"}`);
  }
  return parts.length === 0 ? "None scheduled" : parts.join(" · ");
}

function summarizeMacro(v: PlanInputs): string {
  return `Inflation ${(v.inflationRate * 100).toFixed(1)}%`;
}

// Per-card summary lines shown when a life-event card is collapsed.
// They're intentionally short (one line) and lead with the displayed
// amount — the value the engine actually uses, which is the entered
// value inflated to the landing year when `inflateAmount` is on, and
// the raw entered value when it's off. This matches the convention the
// in-card year-slider helpers use, so the headline and the helper line
// always agree. When the amount is zero (a freshly-added blank card),
// fall back to a year-only hint so the line never reads "€0 in 2031".
function summarizeWindfallCard(
  event: WindfallEvent,
  displayedAmount: number,
  format: (n: number) => string
): string {
  if (displayedAmount > 0) return `${format(displayedAmount)} in ${event.year}`;
  return `Year ${event.year}`;
}

function summarizeRealEstateInvestmentCard(
  event: RealEstateInvestmentEvent,
  displayedAmount: number,
  format: (n: number) => string
): string {
  if (displayedAmount > 0)
    return `${format(displayedAmount)} in ${event.purchaseYear}`;
  return `Year ${event.purchaseYear}`;
}

function summarizeNewDebtCard(
  event: NewDebtEvent,
  displayedPrincipal: number,
  format: (n: number) => string
): string {
  if (displayedPrincipal > 0)
    return `${format(displayedPrincipal)} from ${event.startYear}`;
  return `From ${event.startYear}`;
}

// Existing real-estate holdings have no start year and no inflation
// toggle (they're assets the user already owns), so the summary just
// surfaces the two facts that drive the projection: current value and
// annual rental income. We join them with a middle-dot when both are
// present, fall back to whichever side is non-zero, and use an em-dash
// (matching the Liquid/Non-Liquid empty state) when the card hasn't
// been filled in yet.
function summarizeRealEstateHoldingCard(
  holding: RealEstateHolding,
  format: (n: number) => string
): string {
  const valuePart = holding.value > 0 ? format(holding.value) : null;
  const rentPart =
    holding.annualRentalIncome > 0
      ? `${format(holding.annualRentalIncome)} rent/yr`
      : null;
  if (valuePart && rentPart) return `${valuePart} \u00b7 ${rentPart}`;
  if (valuePart) return valuePart;
  if (rentPart) return rentPart;
  return "\u2014";
}

export function PlannerForm({ value, onChange, onReset }: Props) {
  const { format, formatCompact } = useCurrency();
  const update = <K extends keyof PlanInputs>(key: K, next: PlanInputs[K]) => {
    onChange({ ...value, [key]: next });
  };

  const updateEvent = (id: string, patch: Partial<LifeEvent>) => {
    onChange({
      ...value,
      events: value.events.map((e) =>
        e.id === id ? ({ ...e, ...patch } as LifeEvent) : e
      )
    });
  };

  const removeEvent = (id: string) => {
    onChange({ ...value, events: value.events.filter((e) => e.id !== id) });
  };

  // Tracks IDs of life-event cards added during this PlannerForm mount.
  // Cards default to COLLAPSED (matching the Non-Liquid sub-pill UX)
  // EXCEPT for ones the user just created via +Add — those auto-expand
  // so the user can fill them in immediately. After a page reload the
  // set resets, so all loaded cards are collapsed by default.
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());

  const markAndAdd = (newEvent: LifeEvent) => {
    setNewlyAddedIds((prev) => {
      const next = new Set(prev);
      next.add(newEvent.id);
      return next;
    });
    onChange({ ...value, events: [...value.events, newEvent] });
  };

  // Real-estate holdings live on a separate top-level array (they're
  // assets the user already owns, not life events), but we want the
  // same auto-expand-on-add UX. IDs are UUIDs so the shared
  // newlyAddedIds Set won't collide with event IDs.
  const markAndAddHolding = (newHolding: RealEstateHolding) => {
    setNewlyAddedIds((prev) => {
      const next = new Set(prev);
      next.add(newHolding.id);
      return next;
    });
    onChange({
      ...value,
      realEstateHoldings: [...value.realEstateHoldings, newHolding]
    });
  };

  const addRealEstateInvestment = () => {
    markAndAdd(makeDefaultRealEstateInvestment());
  };

  const addWindfallEvent = () => {
    markAndAdd(makeDefaultWindfallEvent());
  };

  const addNewDebtEvent = () => {
    markAndAdd(makeDefaultNewDebtEvent());
  };

  const reInvestments = value.events.filter(
    (e): e is RealEstateInvestmentEvent => e.type === "realEstateInvestment"
  );

  const windfalls = value.events.filter(
    (e): e is WindfallEvent => e.type === "windfall"
  );

  const newDebts = value.events.filter(
    (e): e is NewDebtEvent => e.type === "newDebt"
  );

  const updateHolding = (id: string, patch: Partial<RealEstateHolding>) => {
    onChange({
      ...value,
      realEstateHoldings: value.realEstateHoldings.map((h) =>
        h.id === id ? { ...h, ...patch } : h
      )
    });
  };

  const removeHolding = (id: string) => {
    onChange({
      ...value,
      realEstateHoldings: value.realEstateHoldings.filter((h) => h.id !== id)
    });
  };

  const addRealEstateHolding = () => {
    markAndAddHolding(makeDefaultRealEstateHolding());
  };

  // Recomputed per render so the helper text under the year sliders stays
  // in sync if the page sits open across a year boundary. The projection
  // itself uses the `now` argument passed to `projectNetWorth` for
  // testability — this is purely UI.
  const currentYear = new Date().getFullYear();
  const yearSliderMin = currentYear;
  const yearSliderMax = currentYear + MAX_HORIZON_YEARS;

  const NON_LIQUID_LIQUIDITY_YEAR_SLIDER: SliderSpec = {
    key: "nonLiquidLiquidityYear",
    label: "Liquidity year",
    min: yearSliderMin,
    max: yearSliderMax,
    step: 1,
    format: rawYear
  };

  const OTHER_FIXED_LIQUIDITY_YEAR_SLIDER: SliderSpec = {
    key: "otherFixedLiquidityYear",
    label: "Liquidity year",
    min: yearSliderMin,
    max: yearSliderMax,
    step: 1,
    format: rawYear
  };

  // The loan-end label flips between "Loan end year" and "Lump sum
  // repayment year" depending on the repayment type, so the spec is built
  // per render.
  const debtEndYearLabel =
    value.debtRepaymentType === "inFine" ? "Lump sum repayment year" : "Loan end year";

  const DEBT_END_YEAR_SLIDER: SliderSpec = {
    key: "debtEndYear",
    label: debtEndYearLabel,
    min: yearSliderMin,
    max: yearSliderMax,
    step: 1,
    format: rawYear
  };

  const renderAmounts = (specs: AmountSpec[]) => (
    <div className="space-y-4">
      {specs.map((spec) => (
        <CurrencyField
          key={spec.key}
          label={spec.label}
          value={value[spec.key]}
          onChange={(next) => update(spec.key, next)}
          min={spec.min}
          max={spec.max}
        />
      ))}
    </div>
  );

  return (
    <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-[var(--navy)]">Your plan</h2>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">Amounts in today&apos;s money</p>
        </div>
        <button type="button" onClick={onReset} className="btn-ghost">
          <ResetIcon />
          Reset to defaults
        </button>
      </div>

      <div className="space-y-3">
        <CollapsibleCategory
          title="About you"
          accent={ACCENT.aboutYou}
          icon={<IconPerson />}
          summary={summarizeAboutYou(value)}
          defaultOpen
        >
          <FramedField label="Date of birth">
            <input
              type="date"
              value={value.dateOfBirth}
              onChange={(event) => update("dateOfBirth", event.target.value)}
              className="field-input"
              aria-label="Date of birth"
            />
          </FramedField>
          <SliderRow
            spec={RETIREMENT_AGE_SLIDER}
            value={value.retirementAge}
            onChange={(next) => update("retirementAge", next)}
          />
          <SliderRow
            spec={HORIZON_SLIDER}
            value={value.horizonYears}
            onChange={(next) => update("horizonYears", next)}
          />
        </CollapsibleCategory>

        <CollapsibleCategory
          title="Assets and Debt"
          accent={ACCENT.assetsDebt}
          icon={<IconBriefcase />}
          summary={summarizeAssetsDebt(value, formatCompact)}
          defaultOpen
        >
          <CollapsibleSubsection
            title="Liquid"
            accent={ACCENT.assetsDebt}
            testId="subsection-liquid"
            summary={summarizeLiquidSubsection(value, format)}
          >
            {renderAmounts([LIQUID_AMOUNTS[0]])}
            <SliderRow
              spec={NOMINAL_RETURN_SLIDER}
              value={value.nominalReturn}
              onChange={(next) => update("nominalReturn", next)}
            />
            {renderAmounts([LIQUID_AMOUNTS[1]])}
          </CollapsibleSubsection>

          <CollapsibleSubsection
            title="Non-Liquid"
            accent={ACCENT.assetsDebt}
            testId="subsection-non-liquid"
            summary={summarizeNonLiquidSubsection(value, format)}
          >
            {/* Each non-liquid bucket pairs an amount field with a liquidity
                year slider; at that year the projection moves the value into
                the liquid portfolio so it begins compounding. */}
            <div className="space-y-4">
              <CurrencyField
                label={NON_LIQUID_AMOUNTS[0].label}
                value={value.nonLiquidInvestments}
                onChange={(next) => update("nonLiquidInvestments", next)}
                min={NON_LIQUID_AMOUNTS[0].min}
                max={NON_LIQUID_AMOUNTS[0].max}
              />
              <SliderRow
                spec={NON_LIQUID_LIQUIDITY_YEAR_SLIDER}
                value={value.nonLiquidLiquidityYear}
                onChange={(next) => update("nonLiquidLiquidityYear", next)}
                helper={yearsFromNow(value.nonLiquidLiquidityYear, currentYear)}
              />
              <CurrencyField
                label={NON_LIQUID_AMOUNTS[1].label}
                value={value.otherFixedAssets}
                onChange={(next) => update("otherFixedAssets", next)}
                min={NON_LIQUID_AMOUNTS[1].min}
                max={NON_LIQUID_AMOUNTS[1].max}
              />
              <SliderRow
                spec={OTHER_FIXED_LIQUIDITY_YEAR_SLIDER}
                value={value.otherFixedLiquidityYear}
                onChange={(next) => update("otherFixedLiquidityYear", next)}
                helper={yearsFromNow(value.otherFixedLiquidityYear, currentYear)}
              />
            </div>
          </CollapsibleSubsection>

          <CollapsibleSubsection
            title="Debt"
            accent={ACCENT.debt}
            testId="subsection-debt"
            // Two-segment collapsed summary mirroring the New Debt life-
            // event card: balance as the value (no "from <year>" since
            // the debt is already active), schedule helper as the label,
            // joined by SUMMARY_SEP so CollapsiblePill renders them as
            // bold value + smaller soft label and wraps the schedule
            // line to a second flex row when it overflows.
            summary={
              summarizeDebtSubsectionHeadline(value, format) +
              SUMMARY_SEP +
              formatDebtScheduleText({
                principal: value.startDebt,
                interestRate: value.debtInterestRate,
                repaymentType: value.debtRepaymentType,
                startYear: currentYear,
                endYear: value.debtEndYear,
                format,
                messages: EXISTING_DEBT_SCHEDULE_MESSAGES
              })
            }
          >
            {renderAmounts(DEBT_AMOUNTS)}
            <SliderRow
              spec={DEBT_INTEREST_RATE_SLIDER}
              value={value.debtInterestRate}
              onChange={(next) => update("debtInterestRate", next)}
            />
            <FramedField label="Repayment type">
              <select
                value={value.debtRepaymentType}
                onChange={(event) =>
                  update("debtRepaymentType", event.target.value as DebtRepaymentType)
                }
                className="field-input"
                aria-label="Repayment type"
              >
                <option value="overTime">Over Time</option>
                <option value="inFine">In Fine</option>
              </select>
            </FramedField>
            <SliderRow
              spec={DEBT_END_YEAR_SLIDER}
              value={value.debtEndYear}
              onChange={(next) => update("debtEndYear", next)}
              helper={yearsFromNow(value.debtEndYear, currentYear)}
            />
            <DebtScheduleSummary value={value} format={format} />
          </CollapsibleSubsection>
        </CollapsibleCategory>

        <CollapsibleCategory
          title="Income & Expenses"
          accent={ACCENT.incomeExpenses}
          icon={<IconDollar />}
          summary={summarizeIncomeExpenses(value, formatCompact)}
        >
          {renderAmounts(INCOME_EXPENSE_AMOUNTS)}
          <CurrencyField
            label="Recurring monthly expenses"
            value={value.monthlySpending}
            onChange={(next) => update("monthlySpending", next)}
            min={0}
            max={1_000_000}
            helper={`Annual total: ${format(value.monthlySpending * 12)}`}
          />
        </CollapsibleCategory>

        <CollapsibleCategory
          title="Real Estate"
          accent={ACCENT.realEstate}
          icon={<IconHouse />}
          summary={summarizeRealEstate(value, formatCompact)}
        >
          {value.realEstateHoldings.length === 0 ? (
            // Empty state: render just the Add button in a fixed-height flex
            // box so it sits optically centered inside the collapsed pill,
            // independent of the wrapper's own block padding/margin quirks.
            <div
              className="flex items-center justify-center"
              style={{ minHeight: "48px", marginTop: "-16px", marginBottom: "-12px" }}
            >
              <button
                type="button"
                onClick={addRealEstateHolding}
                className="btn-ghost w-full justify-center"
                style={{
                  borderColor: ACCENT.realEstate,
                  color: ACCENT.realEstate,
                  // Nudge the button up 4px to optically center it; the
                  // legend's visual weight at the top makes the geometric
                  // center read slightly low otherwise.
                  transform: "translateY(-4px)"
                }}
              >
                + Add Real Estate
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {value.realEstateHoldings.map((holding, index) => (
                <RealEstateHoldingCard
                  key={holding.id}
                  holding={holding}
                  index={index}
                  accent={ACCENT.realEstate}
                  defaultOpen={newlyAddedIds.has(holding.id)}
                  onChange={(patch) => updateHolding(holding.id, patch)}
                  onRemove={() => removeHolding(holding.id)}
                />
              ))}
              <button
                type="button"
                onClick={addRealEstateHolding}
                className="btn-ghost w-full justify-center"
                style={{
                  borderColor: ACCENT.realEstate,
                  color: ACCENT.realEstate
                }}
              >
                + Add Real Estate
              </button>
            </div>
          )}
        </CollapsibleCategory>

        <CollapsibleCategory
          title="Life Events"
          accent={ACCENT.lifeEvents}
          icon={<IconSparkle />}
          summary={summarizeLifeEvents(value, formatCompact)}
        >
          <div className="space-y-3">
            {windfalls.map((event, index) => (
              <WindfallEventCard
                key={event.id}
                event={event}
                index={index}
                accent={ACCENT.assetsDebt}
                defaultOpen={newlyAddedIds.has(event.id)}
                yearMin={yearSliderMin}
                yearMax={yearSliderMax}
                currentYear={currentYear}
                inflationRate={value.inflationRate}
                onChange={(patch) => updateEvent(event.id, patch)}
                onRemove={() => removeEvent(event.id)}
              />
            ))}
            <button
              type="button"
              onClick={addWindfallEvent}
              className="btn-ghost w-full justify-center"
              style={{ borderColor: ACCENT.assetsDebt, color: ACCENT.assetsDebt }}
            >
              + Add Windfall
            </button>
          </div>

          <div className="space-y-3 pt-2">
            {reInvestments.map((event, index) => (
              <RealEstateInvestmentCard
                key={event.id}
                event={event}
                index={index}
                accent={ACCENT.realEstate}
                defaultOpen={newlyAddedIds.has(event.id)}
                yearMin={yearSliderMin}
                yearMax={yearSliderMax}
                currentYear={currentYear}
                inflationRate={value.inflationRate}
                onChange={(patch) => updateEvent(event.id, patch)}
                onRemove={() => removeEvent(event.id)}
              />
            ))}
            <button
              type="button"
              onClick={addRealEstateInvestment}
              className="btn-ghost w-full justify-center"
              style={{ borderColor: ACCENT.realEstate, color: ACCENT.realEstate }}
            >
              + Add Real Estate Investment
            </button>
          </div>

          <div className="space-y-3 pt-2">
            {newDebts.map((event, index) => (
              <NewDebtEventCard
                key={event.id}
                event={event}
                index={index}
                accent={ACCENT.debt}
                defaultOpen={newlyAddedIds.has(event.id)}
                yearMin={yearSliderMin}
                yearMax={yearSliderMax}
                currentYear={currentYear}
                inflationRate={value.inflationRate}
                onChange={(patch) => updateEvent(event.id, patch)}
                onRemove={() => removeEvent(event.id)}
              />
            ))}
            <button
              type="button"
              onClick={addNewDebtEvent}
              className="btn-ghost w-full justify-center"
              style={{ borderColor: ACCENT.debt, color: ACCENT.debt }}
            >
              + Add New Debt
            </button>
          </div>
        </CollapsibleCategory>

        <CollapsibleCategory
          title="Macro assumptions"
          accent={ACCENT.macro}
          icon={<IconGauge />}
          summary={summarizeMacro(value)}
        >
          <SliderRow
            spec={INFLATION_SLIDER}
            value={value.inflationRate}
            onChange={(next) => update("inflationRate", next)}
          />
        </CollapsibleCategory>
      </div>
    </form>
  );
}

// Middle-dot separator used between value and label in every collapsed
// pill summary string. Keeping it as a module-level constant lets the
// summary helpers, the Debt + New Debt multi-segment summaries, and the
// CollapsiblePill renderer all agree on the exact same character.
const SUMMARY_SEP = " \u00b7 "; // " · "

// Splits a summary string into its leading value (before the first
// middle-dot) and its trailing label (everything after). Splitting on
// the FIRST occurrence only is intentional: the Debt In Fine schedule
// line itself contains a " · " (`Annual interest payment: €X · Lump sum
// of €Y in 2030.`), and we want that inner dot preserved inside the
// label rather than splitting on it. Single-segment summaries (`$540K`,
// `—`, `Inflation 2.5%`) come back with `label === null` so the
// renderer skips the label span entirely.
function splitSummary(s: string): { value: string; label: string | null } {
  const i = s.indexOf(SUMMARY_SEP);
  if (i === -1) return { value: s, label: null };
  return { value: s.slice(0, i), label: s.slice(i + SUMMARY_SEP.length) };
}

// Shared collapsible-pill primitive used by both the top-level category
// pills (size="lg", e.g. Assets & Debt) and the inner sub-pills
// (size="sm", e.g. Liquid / Non-Liquid / life-event cards). Visual
// differences (radius, padding, border softness, legend font, icon slot,
// chevron placement) collapse to a `size` switch so that behaviour
// (toggle state, --accent cascade, panel ARIA wiring, summary slot) is
// authored once. Public wrappers below preserve the original component
// names so call sites are unchanged.
function CollapsiblePill({
  title,
  icon,
  accent,
  defaultOpen = false,
  testId,
  summary,
  size,
  editableTitle,
  children
}: {
  title: string;
  icon?: ReactNode;
  accent: string;
  defaultOpen?: boolean;
  testId?: string;
  /** One-line (or multi-line) summary shown below the legend when
   *  collapsed. Use a ReactNode (e.g. two stacked <div>s) for multi-line. */
  summary?: ReactNode;
  size: "lg" | "sm";
  /** When provided, the legend renders an editable text input + a
   *  small pencil button instead of the static toggle button. The
   *  pill's open/close behaviour shifts to the corner chevron (which
   *  becomes a real, keyboard-focusable button) and the existing
   *  click-on-collapsed-body expander. Used by stackable per-card
   *  pills (Windfall, RE Investment, New Debt, RE Holding) so the
   *  user can rename each card from its legend. `value` is the stored
   *  label string (empty = use auto-numbered fallback);
   *  `defaultLabel` is the auto-numbered text shown as a placeholder
   *  when `value` is empty. */
  editableTitle?: {
    value: string;
    onChange: (next: string) => void;
    defaultLabel: string;
  };
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const isLg = size === "lg";
  const labelInputRef = useRef<HTMLInputElement>(null);

  // Per-size visual deltas. Behaviour is identical across sizes; only
  // styling changes. Both sizes use the same open/closed vertical
  // padding asymmetry: tight `pt-1 pb-2` when collapsed so the summary
  // hugs the legend at a consistent baseline across parent + child
  // pills, roomier `py-3/4` when open so the body content has air. Only
  // border-radius and horizontal padding scale down for the child.
  const verticalPadding = open
    ? "py-3 md:py-4"
    : "pb-2 pt-1 md:pb-3 md:pt-1";
  const baseFieldsetClass = isLg
    ? `relative rounded-[1.25rem] border bg-[var(--surface)] px-4 md:px-5 ${verticalPadding}`
    : `relative rounded-[1rem] border bg-[var(--surface)] px-3 md:px-4 ${verticalPadding}`;
  const fieldsetClass = open
    ? baseFieldsetClass
    : `${baseFieldsetClass} cursor-pointer`;

  // Parent pills get a solid accent border; child pills use a softer
  // 50% mix so they read as nested rather than competing with the
  // parent's outline.
  const borderColor = isLg
    ? accent
    : `color-mix(in oklab, ${accent} 50%, transparent)`;

  const legendClass = isLg ? "px-1" : "px-1 text-[12px] font-semibold";
  const legendButtonClass = isLg
    ? "flex items-center gap-2.5 text-left text-sm font-semibold"
    : "flex items-center gap-1.5";

  // V2-C size hierarchy: bold 16px navy value + 13px soft-slate label,
  // baseline-aligned and left-justified in a flex row. Long labels
  // (e.g. the Debt In Fine schedule) wrap to a new flex row via
  // `flex-wrap` rather than crowding the value. Replaces the previous
  // single-tone `--ink-muted` summary that read as placeholder text.
  // The wrapper class is shared across pill sizes so collapsed sub-
  // pills and parent categories carry the same typographic hierarchy.
  const summaryWrapperClass =
    "pt-1 text-left flex flex-wrap items-baseline gap-x-2 gap-y-0.5";

  return (
    <fieldset
      className={fieldsetClass}
      data-testid={testId}
      // Click-to-expand: a collapsed pill opens on any click inside its
      // border. The handler is intentionally `undefined` while open so
      // bubbled clicks from children (sub-pills, inputs, sliders,
      // buttons) can never collapse the parent. The legend button and
      // corner chevron remain the only ways to collapse.
      onClick={open ? undefined : () => setOpen(true)}
      // Set --accent on the pill container so descendant inputs /
      // sliders pick up the section's accent in the global :focus rules
      // and slider thumb rules (globals.css). Cascading via CSS custom
      // property keeps the focus highlight context-aware without each
      // input needing to know which section it lives in.
      style={{ borderColor, ["--accent" as string]: accent } as React.CSSProperties}
    >
      <legend className={legendClass} style={{ color: accent }}>
        {editableTitle ? (
          // Editable legend: text input + pencil affordance. The input
          // carries `aria-label` so screen readers know what they're
          // editing; the pencil is a separate button that focuses +
          // selects the input on click. Both stop click-propagation so
          // tapping either on a collapsed pill doesn't trigger the
          // body-level click-to-expand handler (which would steal
          // focus). Toggle accessibility moves to the corner chevron
          // below (promoted to a real button when `editableTitle` is
          // provided).
          <span className="inline-flex items-center gap-2">
            <input
              ref={labelInputRef}
              type="text"
              value={editableTitle.value}
              placeholder={editableTitle.defaultLabel}
              onChange={(e) => editableTitle.onChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") {
                  e.currentTarget.blur();
                }
              }}
              // `field-sizing: content` (CSS Working Draft, Chrome 123+,
              // Safari 17.4+, Firefox 134+) shrink-wraps the input to
              // its rendered text so the pencil sits flush against the
              // label end. The `size=` attribute is the fallback for
              // older browsers AND for the empty-value case where most
              // engines size to the placeholder via the `size` rule.
              size={Math.max(
                (editableTitle.value || editableTitle.defaultLabel).length,
                1
              )}
              className="rounded-sm border-0 bg-transparent px-0.5 text-[12px] font-semibold tabular-nums outline-none placeholder:opacity-70 hover:bg-[color-mix(in_oklab,var(--accent)_8%,transparent)] focus:underline max-w-[14rem] [field-sizing:content]"
              style={{ color: accent }}
              aria-label={`Edit label, defaults to "${editableTitle.defaultLabel}"`}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                labelInputRef.current?.focus();
                labelInputRef.current?.select();
              }}
              aria-label="Edit label"
              className="inline-flex shrink-0 opacity-60 hover:opacity-100"
              style={{ color: accent }}
            >
              <PencilIcon />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={panelId}
            className={legendButtonClass}
            style={{ color: accent }}
          >
            {isLg && icon ? (
              <span aria-hidden className="inline-flex shrink-0">
                {icon}
              </span>
            ) : null}
            <span>{title}</span>
          </button>
        )}
      </legend>
      {/* Top-right chevron toggle. Decorative when the legend itself
          is the keyboard / SR toggle (parent categories, sub-pills),
          but promoted to a real focusable button with `aria-expanded`
          + `aria-label` when the legend is an editable input (per-card
          pills via `editableTitle`) so keyboard / SR users still have
          a way to open/close the card. Sub-pills use the small chevron
          so it stays in proportion to the smaller pill and `text-[12px]`
          legend; parent pills use the default 14px size to match their
          `text-sm` legend. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-hidden={editableTitle ? undefined : "true"}
        tabIndex={editableTitle ? 0 : -1}
        aria-expanded={editableTitle ? open : undefined}
        aria-controls={editableTitle ? panelId : undefined}
        aria-label={
          editableTitle
            ? open
              ? `Collapse ${editableTitle.value || editableTitle.defaultLabel}`
              : `Expand ${editableTitle.value || editableTitle.defaultLabel}`
            : undefined
        }
        className={`absolute right-3 ${
          isLg ? "top-[-10px]" : "top-[-9px]"
        } inline-flex items-center bg-[var(--surface)] px-1 leading-none focus:outline-none md:right-4`}
        style={{ color: accent, transform: "translateY(-50%)" }}
      >
        <Chevron open={open} small={!isLg} />
      </button>
      {open ? (
        <div id={panelId} className="space-y-3 pt-1">
          {children}
        </div>
      ) : summary ? (
        <div
          data-testid={testId ? `${testId}-summary` : undefined}
          className={summaryWrapperClass}
        >
          {typeof summary === "string"
            ? (() => {
                const { value, label } = splitSummary(summary);
                return (
                  <>
                    <span className="text-[16px] font-bold tabular-nums text-[var(--ink)]">
                      {value}
                    </span>
                    {label ? (
                      <span className="text-[13px] tabular-nums text-[var(--ink-soft)]">
                        {label}
                      </span>
                    ) : null}
                  </>
                );
              })()
            : summary}
        </div>
      ) : null}
    </fieldset>
  );
}

type CollapsibleCategoryProps = {
  title: string;
  accent: string;
  icon: ReactNode;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

function CollapsibleCategory(props: CollapsibleCategoryProps) {
  return <CollapsiblePill {...props} size="lg" />;
}

function CollapsibleSubsection(props: {
  title: string;
  accent: string;
  defaultOpen?: boolean;
  testId: string;
  summary?: ReactNode;
  /** When provided, the legend renders an editable input + pencil
   *  button instead of the static toggle. Forwarded verbatim to
   *  `CollapsiblePill`. Used by the four stackable per-card pills
   *  (Windfall, RE Investment, New Debt, RE Holding). */
  editableTitle?: {
    value: string;
    onChange: (next: string) => void;
    defaultLabel: string;
  };
  children: ReactNode;
}) {
  return <CollapsiblePill {...props} size="sm" />;
}

function Chevron({ open, small = false }: { open: boolean; small?: boolean }) {
  const size = small ? 12 : 14;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={"transition-transform duration-150 " + (open ? "rotate-0" : "-rotate-90")}
    >
      <path
        d="M5 7l5 6 5-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Discreet edit affordance shown next to the editable label input on
// stackable cards (Windfall, Real Estate Investment, New Debt, Real
// Estate Holding). Sized to the smaller `12px` chevron so it sits in
// proportion with the sub-pill legend, accent-colored via
// `currentColor` from the parent button. Static SVG: pencil tip
// pointing top-right at the writing line.
function PencilIcon() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M3 17h4l9-9-4-4-9 9v4z M12 4l4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Per-call wording for the existing-Debt subsection. Hoisted so the
// in-card paragraph (`DebtScheduleSummary`) and the collapsed-summary
// line in the Debt subsection always read the same edge-case text.
const EXISTING_DEBT_SCHEDULE_MESSAGES = {
  noPrincipal: "No outstanding debt.",
  termInPast: "Loan end year is in the past — no scheduled payments."
} as const;

function DebtScheduleSummary({
  value,
  format
}: {
  value: PlanInputs;
  format: (v: number) => string;
}) {
  const currentYear = new Date().getFullYear();
  return (
    <p
      data-testid="debt-schedule-summary"
      className="text-xs leading-relaxed text-[var(--ink-muted)]"
    >
      {formatDebtScheduleText({
        principal: value.startDebt,
        interestRate: value.debtInterestRate,
        repaymentType: value.debtRepaymentType,
        startYear: currentYear,
        endYear: value.debtEndYear,
        format,
        messages: EXISTING_DEBT_SCHEDULE_MESSAGES
      })}
    </p>
  );
}

// Small inline checkbox + label sitting just under each life-event card's
// Amount field. Toggles whether the today's-money input is inflated to the
// landing year (current convention; mirrors the windfall / RE / new-debt
// inflator path in `projection.ts`) or whether the entered amount is
// treated as a nominal future-year value. Styled to match the helper text
// (small, muted) so it doesn't compete visually with the slider rows
// above and below it.
function InflateAmountToggle({
  checked,
  onChange,
  ariaLabel
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[var(--ink-muted)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={ariaLabel}
        className="h-3.5 w-3.5 cursor-pointer accent-[var(--navy)]"
      />
      Adjust amount for inflation
    </label>
  );
}

function RealEstateInvestmentCard({
  event,
  index,
  accent,
  defaultOpen,
  yearMin,
  yearMax,
  currentYear,
  inflationRate,
  onChange,
  onRemove
}: {
  event: RealEstateInvestmentEvent;
  index: number;
  accent: string;
  defaultOpen: boolean;
  yearMin: number;
  yearMax: number;
  currentYear: number;
  inflationRate: number;
  onChange: (patch: Partial<RealEstateInvestmentEvent>) => void;
  onRemove: () => void;
}) {
  const { format } = useCurrency();
  // Match the projection engine: today's-money inputs are inflated to the
  // landing year when `inflateAmount` is on. Clamp the exponent at 0 so a
  // past purchaseYear still shows the user's entered amount instead of a
  // deflated one.
  const yearsToPurchase = Math.max(0, event.purchaseYear - currentYear);
  const inflatedPurchaseAmount = event.inflateAmount
    ? event.purchaseAmount * (1 + inflationRate) ** yearsToPurchase
    : event.purchaseAmount;
  const purchaseYearSpec: SliderSpec = {
    key: "reInvestmentPurchaseYear",
    label: "Purchase year",
    min: yearMin,
    max: yearMax,
    step: 1,
    format: rawYear
  };

  const rentalRateSpec: SliderSpec = {
    key: "rentalIncomeRate",
    label: "Rental income annual appreciation",
    min: MIN_APPRECIATION,
    max: MAX_APPRECIATION,
    step: 0.001,
    format: percent
  };

  const appreciationRateSpec: SliderSpec = {
    key: "primaryResidenceRate",
    label: "Annual appreciation rate",
    min: MIN_APPRECIATION,
    max: MAX_APPRECIATION,
    step: 0.001,
    format: percent
  };

  return (
    <CollapsibleSubsection
      title={`Real Estate Investment ${index + 1}`}
      accent={accent}
      defaultOpen={defaultOpen}
      testId={`re-investment-card-${index}`}
      summary={summarizeRealEstateInvestmentCard(event, inflatedPurchaseAmount, format)}
      editableTitle={{
        value: event.label,
        onChange: (label) => onChange({ label }),
        defaultLabel: `Real Estate Investment ${index + 1}`
      }}
    >
      <CurrencyField
        label="Purchase amount"
        value={event.purchaseAmount}
        onChange={(next) => onChange({ purchaseAmount: next })}
        min={0}
        max={100_000_000}
      />
      <InflateAmountToggle
        checked={event.inflateAmount}
        onChange={(next) => onChange({ inflateAmount: next })}
        ariaLabel={`Adjust amount for inflation (Real Estate Investment ${index + 1})`}
      />
      <SliderRow
        spec={purchaseYearSpec}
        value={event.purchaseYear}
        onChange={(next) => onChange({ purchaseYear: next })}
        helper={
          // Always pair the amount the engine actually deducts from liquid
          // assets with the relative timing, e.g. "€1,104,081 in 5 years".
          // When `inflateAmount` is on we use the inflated nominal cost;
          // when off we use the entered face value. On a fresh blank-slate
          // card (purchaseAmount === 0) we drop back to just the relative
          // phrase so the helper doesn't read "€0 in 5 years".
          event.purchaseAmount > 0
            ? `${format(inflatedPurchaseAmount)} ${yearsFromNow(event.purchaseYear, currentYear)}`
            : yearsFromNow(event.purchaseYear, currentYear)
        }
      />
      <SliderRow
        spec={appreciationRateSpec}
        value={event.appreciationRate}
        onChange={(next) => onChange({ appreciationRate: next })}
      />
      <CurrencyField
        label="Annual rental income"
        value={event.annualRentalIncome}
        onChange={(next) => onChange({ annualRentalIncome: next })}
        min={0}
        max={10_000_000}
      />
      <SliderRow
        spec={rentalRateSpec}
        value={event.rentalIncomeRate}
        onChange={(next) => onChange({ rentalIncomeRate: next })}
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="btn-ghost text-[var(--ink-muted)]"
          aria-label={`Remove real estate investment ${index + 1}`}
        >
          Remove
        </button>
      </div>
    </CollapsibleSubsection>
  );
}

function WindfallEventCard({
  event,
  index,
  accent,
  defaultOpen,
  yearMin,
  yearMax,
  currentYear,
  inflationRate,
  onChange,
  onRemove
}: {
  event: WindfallEvent;
  index: number;
  accent: string;
  defaultOpen: boolean;
  yearMin: number;
  yearMax: number;
  currentYear: number;
  inflationRate: number;
  onChange: (patch: Partial<WindfallEvent>) => void;
  onRemove: () => void;
}) {
  const { format } = useCurrency();
  // Match the projection engine: today's-money inputs are inflated to the
  // landing year when `inflateAmount` is on. Clamp the exponent at 0 so a
  // past year still shows the user's entered amount instead of a deflated
  // one.
  const yearsToLanding = Math.max(0, event.year - currentYear);
  const inflatedAmount = event.inflateAmount
    ? event.amount * (1 + inflationRate) ** yearsToLanding
    : event.amount;
  const yearSpec: SliderSpec = {
    key: "windfallEventYear",
    label: "Year",
    min: yearMin,
    max: yearMax,
    step: 1,
    format: rawYear
  };

  return (
    <CollapsibleSubsection
      title={`Windfall ${index + 1}`}
      accent={accent}
      defaultOpen={defaultOpen}
      testId={`windfall-card-${index}`}
      summary={summarizeWindfallCard(event, inflatedAmount, format)}
      editableTitle={{
        value: event.label,
        onChange: (label) => onChange({ label }),
        defaultLabel: `Windfall ${index + 1}`
      }}
    >
      <CurrencyField
        label="Amount"
        value={event.amount}
        onChange={(next) => onChange({ amount: next })}
        min={0}
        max={100_000_000}
      />
      <InflateAmountToggle
        checked={event.inflateAmount}
        onChange={(next) => onChange({ inflateAmount: next })}
        ariaLabel={`Adjust amount for inflation (Windfall ${index + 1})`}
      />
      <SliderRow
        spec={yearSpec}
        value={event.year}
        onChange={(next) => onChange({ year: next })}
        helper={
          // Always pair the amount the engine actually adds to the
          // portfolio with the relative timing, e.g. "€11,314 in 5 years".
          // When `inflateAmount` is on we use the inflated nominal
          // deposit; when off we use the entered face value. On a fresh
          // blank-slate card (amount === 0) we drop back to just the
          // relative phrase so the helper doesn't read "€0 in 5 years".
          event.amount > 0
            ? `${format(inflatedAmount)} ${yearsFromNow(event.year, currentYear)}`
            : yearsFromNow(event.year, currentYear)
        }
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="btn-ghost text-[var(--ink-muted)]"
          aria-label={`Remove windfall ${index + 1}`}
        >
          Remove
        </button>
      </div>
    </CollapsibleSubsection>
  );
}

function NewDebtEventCard({
  event,
  index,
  accent,
  defaultOpen,
  yearMin,
  yearMax,
  currentYear,
  inflationRate,
  onChange,
  onRemove
}: {
  event: NewDebtEvent;
  index: number;
  accent: string;
  defaultOpen: boolean;
  yearMin: number;
  yearMax: number;
  currentYear: number;
  inflationRate: number;
  onChange: (patch: Partial<NewDebtEvent>) => void;
  onRemove: () => void;
}) {
  const { format } = useCurrency();
  // Match the projection engine: today's-money inputs are inflated to the
  // landing year when `inflateAmount` is on. Clamp the exponent at 0 so a
  // past startYear still shows the user's entered amount instead of a
  // deflated one.
  const yearsToStart = Math.max(0, event.startYear - currentYear);
  const inflatedPrincipal = event.inflateAmount
    ? event.principal * (1 + inflationRate) ** yearsToStart
    : event.principal;

  const interestRateSpec: SliderSpec = {
    key: "newDebtInterestRate",
    label: "Annual interest rate",
    min: MIN_DEBT_INTEREST_RATE,
    max: MAX_DEBT_INTEREST_RATE,
    step: 0.001,
    format: percent
  };

  const loanPeriodSpec: SliderSpec = {
    key: "newDebtLoanPeriod",
    label: "Loan period",
    min: yearMin,
    max: yearMax,
    step: 1,
    format: rawYear
  };
  const endYearAriaLabel =
    event.repaymentType === "inFine" ? "Lump sum repayment year" : "Loan end year";

  return (
    <CollapsibleSubsection
      title={`New Debt ${index + 1}`}
      accent={accent}
      defaultOpen={defaultOpen}
      testId={`new-debt-card-${index}`}
      editableTitle={{
        value: event.label,
        onChange: (label) => onChange({ label }),
        defaultLabel: `New Debt ${index + 1}`
      }}
      // Two-segment collapsed summary: headline (principal + start year)
      // as the value, schedule helper (same text the in-card paragraph
      // shows) as the label, joined by SUMMARY_SEP. CollapsiblePill
      // renders them as bold value + smaller soft label and wraps the
      // schedule line to a second flex row when it overflows.
      summary={
        summarizeNewDebtCard(event, inflatedPrincipal, format) +
        SUMMARY_SEP +
        formatNewDebtScheduleText(event, inflatedPrincipal, format)
      }
    >
      <CurrencyField
        label="Principal"
        value={event.principal}
        onChange={(next) => onChange({ principal: next })}
        min={0}
        max={100_000_000}
      />
      <InflateAmountToggle
        checked={event.inflateAmount}
        onChange={(next) => onChange({ inflateAmount: next })}
        ariaLabel={`Adjust amount for inflation (New Debt ${index + 1})`}
      />
      <SliderRow
        spec={interestRateSpec}
        value={event.interestRate}
        onChange={(next) => onChange({ interestRate: next })}
      />
      <FramedField label="Repayment type">
        <select
          value={event.repaymentType}
          onChange={(e) =>
            onChange({
              repaymentType: e.target.value as DebtRepaymentType
            })
          }
          className="field-input"
          aria-label={`Repayment type for new debt ${index + 1}`}
        >
          {DEBT_REPAYMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === "overTime" ? "Over Time" : "In Fine"}
            </option>
          ))}
        </select>
      </FramedField>
      <RangeSliderRow
        spec={loanPeriodSpec}
        value={[event.startYear, event.endYear]}
        onChange={([start, end]) => onChange({ startYear: start, endYear: end })}
        thumbAriaLabels={[
          `Start year for new debt ${index + 1}`,
          `${endYearAriaLabel} for new debt ${index + 1}`
        ]}
        helpers={[
          // Always pair the amount the engine actually deposits into
          // liquid with the relative timing, e.g. "Start: €220K in 3 years".
          // When `inflateAmount` is on we use the inflated nominal
          // disbursement; when off we use the entered face value. On a
          // fresh blank-slate card (principal === 0) we drop back to just
          // the relative phrase so the helper doesn't read "€0 in 3 years".
          event.principal > 0
            ? `Start: ${format(inflatedPrincipal)} ${yearsFromNow(event.startYear, currentYear)}`
            : `Start: ${yearsFromNow(event.startYear, currentYear)}`,
          // The end-line label echoes the existing dynamic "Loan end year" /
          // "Lump sum repayment year" swap from the legacy two-slider design.
          `${event.repaymentType === "inFine" ? "Lump sum repayment" : "End"}: ${yearsFromNow(event.endYear, currentYear)}`
        ]}
      />
      <NewDebtScheduleSummary
        event={event}
        index={index}
        inflatedPrincipal={inflatedPrincipal}
        format={format}
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="btn-ghost text-[var(--ink-muted)]"
          aria-label={`Remove new debt ${index + 1}`}
        >
          Remove
        </button>
      </div>
    </CollapsibleSubsection>
  );
}

// Single source of truth for every "debt schedule helper" line in the
// form. Three call sites read from this:
//   1. `DebtScheduleSummary`          — in-card paragraph for the
//      existing-Debt subsection.
//   2. `NewDebtScheduleSummary`       — in-card paragraph for each
//      New Debt life-event card (via `formatNewDebtScheduleText`).
//   3. The collapsed-summary line     — both the existing-Debt
//      subsection and each collapsed New Debt card.
// Edge-case wording differs between existing-debt and new-debt
// contexts ("No outstanding debt." vs "No principal entered.", etc.),
// so callers pass per-call `messages`. The success branches are
// identical across all three.
function formatDebtScheduleText(args: {
  principal: number;
  interestRate: number;
  repaymentType: DebtRepaymentType;
  startYear: number;
  endYear: number;
  format: (n: number) => string;
  messages: { noPrincipal: string; termInPast: string };
}): string {
  const {
    principal,
    interestRate,
    repaymentType,
    startYear,
    endYear,
    format,
    messages
  } = args;
  const term = Math.max(0, endYear - startYear);
  if (principal <= 0) return messages.noPrincipal;
  if (term <= 0) return messages.termInPast;
  if (repaymentType === "overTime") {
    const annual = computeOverTimeAnnualPayment(principal, interestRate, term);
    const yearsLabel = `${term} year${term === 1 ? "" : "s"}`;
    return `Annual repayment (capital + interest): ${format(annual)} for ${yearsLabel}.`;
  }
  const annualInterest = principal * interestRate;
  return `Annual interest payment: ${format(annualInterest)} · Lump sum of ${format(principal)} in ${endYear}.`;
}

// Thin adapter for the New Debt life-event card. The "principal" it
// schedules on is the inflated principal — what the engine actually
// disburses at `startYear` — so the displayed payment matches the cash
// flow the user will see in the chart in nominal terms.
function formatNewDebtScheduleText(
  event: NewDebtEvent,
  inflatedPrincipal: number,
  format: (n: number) => string
): string {
  return formatDebtScheduleText({
    principal: inflatedPrincipal,
    interestRate: event.interestRate,
    repaymentType: event.repaymentType,
    startYear: event.startYear,
    endYear: event.endYear,
    format,
    messages: {
      noPrincipal: "No principal entered.",
      termInPast:
        "End year is at or before start year — no scheduled payments."
    }
  });
}

function NewDebtScheduleSummary({
  event,
  index,
  inflatedPrincipal,
  format
}: {
  event: NewDebtEvent;
  index: number;
  inflatedPrincipal: number;
  format: (v: number) => string;
}) {
  return (
    <p
      data-testid={`new-debt-schedule-summary-${index}`}
      className="text-xs leading-relaxed text-[var(--ink-muted)]"
    >
      {formatNewDebtScheduleText(event, inflatedPrincipal, format)}
    </p>
  );
}

function RealEstateHoldingCard({
  holding,
  index,
  accent,
  defaultOpen,
  onChange,
  onRemove
}: {
  holding: RealEstateHolding;
  index: number;
  accent: string;
  defaultOpen: boolean;
  onChange: (patch: Partial<RealEstateHolding>) => void;
  onRemove: () => void;
}) {
  const { format } = useCurrency();
  const appreciationRateSpec: SliderSpec = {
    key: "holdingAppreciationRate",
    label: "Annual appreciation rate",
    min: MIN_APPRECIATION,
    max: MAX_APPRECIATION,
    step: 0.001,
    format: percent
  };

  const rentalRateSpec: SliderSpec = {
    key: "holdingRentalIncomeRate",
    label: "Rental income annual appreciation",
    min: MIN_APPRECIATION,
    max: MAX_APPRECIATION,
    step: 0.001,
    format: percent
  };

  return (
    <CollapsibleSubsection
      title={`Real Estate ${index + 1}`}
      accent={accent}
      defaultOpen={defaultOpen}
      testId={`re-holding-card-${index}`}
      summary={summarizeRealEstateHoldingCard(holding, format)}
      editableTitle={{
        value: holding.label,
        onChange: (label) => onChange({ label }),
        defaultLabel: `Real Estate ${index + 1}`
      }}
    >
      <CurrencyField
        label="Value"
        value={holding.value}
        onChange={(next) => onChange({ value: next })}
        min={0}
        max={100_000_000}
      />
      <SliderRow
        spec={appreciationRateSpec}
        value={holding.appreciationRate}
        onChange={(next) => onChange({ appreciationRate: next })}
      />
      <CurrencyField
        label="Annual rental income"
        value={holding.annualRentalIncome}
        onChange={(next) => onChange({ annualRentalIncome: next })}
        min={0}
        max={10_000_000}
      />
      <SliderRow
        spec={rentalRateSpec}
        value={holding.rentalIncomeRate}
        onChange={(next) => onChange({ rentalIncomeRate: next })}
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="btn-ghost text-[var(--ink-muted)]"
          aria-label={`Remove real estate holding ${index + 1}`}
        >
          Remove
        </button>
      </div>
    </CollapsibleSubsection>
  );
}

function SliderRow({
  spec,
  value,
  onChange,
  helper
}: {
  spec: SliderSpec;
  value: number;
  onChange: (next: number) => void;
  // Optional muted line below the min/max labels. Useful for sliders whose
  // raw value (e.g. an absolute calendar year) benefits from a relative
  // contextualization ("in 12 years").
  helper?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-[var(--navy)]">{spec.label}</span>
        <span className="font-display text-base tabular-nums text-[var(--navy)]">
          {spec.format(value)}
        </span>
      </div>
      <input
        type="range"
        className="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={spec.label}
      />
      <div className="flex items-center justify-between text-[11px] text-[var(--ink-muted)]">
        <span>{spec.format(spec.min)}</span>
        <span>{spec.format(spec.max)}</span>
      </div>
      {helper ? (
        <div className="text-[11px] text-[var(--ink-muted)]">{helper}</div>
      ) : null}
    </div>
  );
}

const iconStrokeProps = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const
};

function IconPerson() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden {...iconStrokeProps}>
      <circle cx="10" cy="7" r="3" />
      <path d="M4 17a6 6 0 0 1 12 0" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden {...iconStrokeProps}>
      <rect x="3" y="6" width="14" height="10" rx="1.5" />
      <path d="M7 6V4.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 13 4.5V6" />
      <path d="M3 10h14" />
    </svg>
  );
}

function IconDollar() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden {...iconStrokeProps}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 5v10" />
      <path d="M12.5 7.5h-3.5a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 1 0 3H7.5" />
    </svg>
  );
}

function IconHouse() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden {...iconStrokeProps}>
      <path d="M3 9.5l7-6 7 6" />
      <path d="M5 9v7a1 1 0 0 0 1 1h3v-5h2v5h3a1 1 0 0 0 1-1V9" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden {...iconStrokeProps}>
      <path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6z" />
    </svg>
  );
}

function IconGauge() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden {...iconStrokeProps}>
      <path d="M3 14a7 7 0 0 1 14 0" />
      <path d="M10 14l3.5-3.5" />
      <circle cx="10" cy="14" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" aria-hidden {...iconStrokeProps}>
      <path d="M4 10a6 6 0 1 0 1.8-4.3" />
      <path d="M4 3v3.5h3.5" />
    </svg>
  );
}
