"use client";

import { useId, useState, type ReactNode } from "react";
import { CurrencyField } from "./CurrencyField";
import { FramedField } from "./FramedField";
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
  return `Net ${formatCompact(net)}`;
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

  const addRealEstateInvestment = () => {
    onChange({
      ...value,
      events: [...value.events, makeDefaultRealEstateInvestment()]
    });
  };

  const addWindfallEvent = () => {
    onChange({
      ...value,
      events: [...value.events, makeDefaultWindfallEvent()]
    });
  };

  const addNewDebtEvent = () => {
    onChange({
      ...value,
      events: [...value.events, makeDefaultNewDebtEvent()]
    });
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
    onChange({
      ...value,
      realEstateHoldings: [
        ...value.realEstateHoldings,
        makeDefaultRealEstateHolding()
      ]
    });
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
            defaultOpen
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

type CollapsibleCategoryProps = {
  title: string;
  accent: string;
  icon: ReactNode;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

function CollapsibleCategory({
  title,
  accent,
  icon,
  summary,
  defaultOpen = false,
  children
}: CollapsibleCategoryProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <fieldset
      className={`relative rounded-[1.25rem] border bg-[var(--surface)] px-4 md:px-5 ${
        open ? "py-3 md:py-4" : "pb-2 pt-1 md:pb-3 md:pt-1"
      }`}
      style={{ borderColor: accent }}
    >
      <legend className="px-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex items-center gap-2.5 text-left text-sm font-semibold"
          style={{ color: accent }}
        >
          <span aria-hidden className="inline-flex shrink-0">
            {icon}
          </span>
          <span>{title}</span>
        </button>
      </legend>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-hidden="true"
        tabIndex={-1}
        className="absolute right-3 top-[-10px] inline-flex items-center bg-[var(--surface)] px-1 leading-none focus:outline-none md:right-4"
        style={{ color: accent, transform: "translateY(-50%)" }}
      >
        <Chevron open={open} />
      </button>
      {open ? (
        <div id={panelId} className="space-y-3 pt-1">
          {children}
        </div>
      ) : summary ? (
        <div className="flex items-center pt-1 text-base font-medium tabular-nums text-[var(--ink-muted)]">
          {summary}
        </div>
      ) : null}
    </fieldset>
  );
}

function CollapsibleSubsection({
  title,
  accent,
  defaultOpen = false,
  testId,
  children
}: {
  title: string;
  accent: string;
  defaultOpen?: boolean;
  testId: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  // Visual parity with the life-event cards: full-pill border around the
  // subsection with the title (+ a chevron toggle) sitting in the corner
  // legend slot. The toggle is a button inside the legend so its
  // accessible name is the title — existing tests that expand subsections
  // by clicking `getByRole("button", { name: /title/i })` keep working.
  return (
    <fieldset
      className="relative rounded-[1rem] border bg-[var(--surface)] px-3 py-3 md:px-4"
      data-testid={testId}
      style={{ borderColor: `color-mix(in oklab, ${accent} 50%, transparent)` }}
    >
      <legend className="px-1 text-[12px] font-semibold" style={{ color: accent }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex items-center gap-1.5"
          style={{ color: accent }}
        >
          <span>{title}</span>
          <Chevron open={open} small />
        </button>
      </legend>
      {open ? (
        <div id={panelId} className="space-y-3 pt-1">
          {children}
        </div>
      ) : null}
    </fieldset>
  );
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

function DebtScheduleSummary({
  value,
  format
}: {
  value: PlanInputs;
  format: (v: number) => string;
}) {
  const currentYear = new Date().getFullYear();
  const remainingTerm = Math.max(0, value.debtEndYear - currentYear);
  const principal = value.startDebt;

  const text = (() => {
    if (principal <= 0) return "No outstanding debt.";
    if (remainingTerm <= 0) return "Loan end year is in the past — no scheduled payments.";

    if (value.debtRepaymentType === "overTime") {
      const annual = computeOverTimeAnnualPayment(principal, value.debtInterestRate, remainingTerm);
      const yearsLabel = `${remainingTerm} year${remainingTerm === 1 ? "" : "s"}`;
      return `Annual repayment (capital + interest): ${format(annual)} for ${yearsLabel}.`;
    }

    const annualInterest = principal * value.debtInterestRate;
    return `Annual interest payment: ${format(annualInterest)} · Lump sum of ${format(principal)} in ${value.debtEndYear}.`;
  })();

  return (
    <p
      data-testid="debt-schedule-summary"
      className="text-xs leading-relaxed text-[var(--ink-muted)]"
    >
      {text}
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
    <fieldset
      className="relative space-y-3 rounded-[1rem] border bg-[var(--surface)] px-3 py-3 md:px-4"
      style={{ borderColor: `color-mix(in oklab, ${accent} 50%, transparent)` }}
      data-testid={`re-investment-card-${index}`}
    >
      <legend className="px-1 text-[12px] font-semibold" style={{ color: accent }}>
        Real Estate Investment {index + 1}
      </legend>
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
    </fieldset>
  );
}

function WindfallEventCard({
  event,
  index,
  accent,
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
    <fieldset
      className="relative space-y-3 rounded-[1rem] border bg-[var(--surface)] px-3 py-3 md:px-4"
      style={{ borderColor: `color-mix(in oklab, ${accent} 50%, transparent)` }}
      data-testid={`windfall-card-${index}`}
    >
      <legend className="px-1 text-[12px] font-semibold" style={{ color: accent }}>
        Windfall {index + 1}
      </legend>
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
    </fieldset>
  );
}

function NewDebtEventCard({
  event,
  index,
  accent,
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

  const startYearSpec: SliderSpec = {
    key: "newDebtStartYear",
    label: "Start year",
    min: yearMin,
    max: yearMax,
    step: 1,
    format: rawYear
  };

  const endYearLabel =
    event.repaymentType === "inFine" ? "Lump sum repayment year" : "Loan end year";
  const endYearSpec: SliderSpec = {
    key: "newDebtEndYear",
    label: endYearLabel,
    min: yearMin,
    max: yearMax,
    step: 1,
    format: rawYear
  };

  return (
    <fieldset
      className="relative space-y-3 rounded-[1rem] border bg-[var(--surface)] px-3 py-3 md:px-4"
      style={{ borderColor: `color-mix(in oklab, ${accent} 50%, transparent)` }}
      data-testid={`new-debt-card-${index}`}
    >
      <legend className="px-1 text-[12px] font-semibold" style={{ color: accent }}>
        New Debt {index + 1}
      </legend>
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
      <SliderRow
        spec={startYearSpec}
        value={event.startYear}
        onChange={(next) => onChange({ startYear: next })}
        helper={
          // Always pair the amount the engine actually deposits into
          // liquid with the relative timing, e.g. "€220K in 3 years".
          // When `inflateAmount` is on we use the inflated nominal
          // disbursement; when off we use the entered face value. On a
          // fresh blank-slate card (principal === 0) we drop back to just
          // the relative phrase so the helper doesn't read "€0 in 3 years".
          event.principal > 0
            ? `${format(inflatedPrincipal)} ${yearsFromNow(event.startYear, currentYear)}`
            : yearsFromNow(event.startYear, currentYear)
        }
      />
      <SliderRow
        spec={endYearSpec}
        value={event.endYear}
        onChange={(next) => onChange({ endYear: next })}
        helper={yearsFromNow(event.endYear, currentYear)}
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
    </fieldset>
  );
}

// Mirrors `DebtScheduleSummary` (the one under the top-level Debt
// subsection) but keyed off a single new-debt event. The principal we
// schedule on is the inflated principal — what the engine actually
// disburses at `startYear` — so the displayed payment matches the cash
// flow the user will see in the chart in nominal terms.
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
  const term = Math.max(0, event.endYear - event.startYear);

  const text = (() => {
    if (inflatedPrincipal <= 0) return "No principal entered.";
    if (term <= 0)
      return "End year is at or before start year — no scheduled payments.";

    if (event.repaymentType === "overTime") {
      const annual = computeOverTimeAnnualPayment(
        inflatedPrincipal,
        event.interestRate,
        term
      );
      const yearsLabel = `${term} year${term === 1 ? "" : "s"}`;
      return `Annual repayment (capital + interest): ${format(annual)} for ${yearsLabel}.`;
    }

    const annualInterest = inflatedPrincipal * event.interestRate;
    return `Annual interest payment: ${format(annualInterest)} · Lump sum of ${format(inflatedPrincipal)} in ${event.endYear}.`;
  })();

  return (
    <p
      data-testid={`new-debt-schedule-summary-${index}`}
      className="text-xs leading-relaxed text-[var(--ink-muted)]"
    >
      {text}
    </p>
  );
}

function RealEstateHoldingCard({
  holding,
  index,
  accent,
  onChange,
  onRemove
}: {
  holding: RealEstateHolding;
  index: number;
  accent: string;
  onChange: (patch: Partial<RealEstateHolding>) => void;
  onRemove: () => void;
}) {
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
    <fieldset
      className="relative space-y-3 rounded-[1rem] border bg-[var(--surface)] px-3 py-3 md:px-4"
      style={{ borderColor: `color-mix(in oklab, ${accent} 50%, transparent)` }}
      data-testid={`re-holding-card-${index}`}
    >
      <legend className="px-1 text-[12px] font-semibold" style={{ color: accent }}>
        Real Estate {index + 1}
      </legend>
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
    </fieldset>
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
