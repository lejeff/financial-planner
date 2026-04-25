"use client";

import { useId, useState, type ReactNode } from "react";
import { CurrencyField } from "./CurrencyField";
import { FramedField } from "./FramedField";
import { useCurrency } from "@/features/currency/CurrencyContext";
import {
  MAX_APPRECIATION,
  MAX_DEBT_INTEREST_RATE,
  MAX_HORIZON_YEARS,
  MIN_APPRECIATION,
  MIN_DEBT_INTEREST_RATE,
  MIN_HORIZON_YEARS,
  computeOverTimeAnnualPayment,
  type DebtRepaymentType,
  type PlanInputs
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
  | "primaryResidenceRate"
  | "otherPropertyRate"
  | "rentalIncomeRate"
  | "debtInterestRate";

type SliderSpec = {
  key: SliderKey;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
};

const percent = (v: number) => `${(v * 100).toFixed(1)}%`;
const years = (v: number) => `${v} year${v === 1 ? "" : "s"}`;

const NOMINAL_RETURN_SLIDER: SliderSpec = {
  key: "nominalReturn",
  label: "Expected annual return",
  min: -0.05,
  max: 0.15,
  step: 0.005,
  format: percent
};

const RENTAL_INCOME_RATE_SLIDER: SliderSpec = {
  key: "rentalIncomeRate",
  label: "Rental income annual appreciation",
  min: MIN_APPRECIATION,
  max: MAX_APPRECIATION,
  step: 0.005,
  format: percent
};

const PRIMARY_RESIDENCE_RATE_SLIDER: SliderSpec = {
  key: "primaryResidenceRate",
  label: "Annual appreciation rate",
  min: MIN_APPRECIATION,
  max: MAX_APPRECIATION,
  step: 0.005,
  format: percent
};

const OTHER_PROPERTY_RATE_SLIDER: SliderSpec = {
  key: "otherPropertyRate",
  label: "Annual appreciation rate",
  min: MIN_APPRECIATION,
  max: MAX_APPRECIATION,
  step: 0.005,
  format: percent
};

const INFLATION_SLIDER: SliderSpec = {
  key: "inflationRate",
  label: "Inflation",
  min: 0,
  max: 0.08,
  step: 0.0025,
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

const DEBT_INTEREST_RATE_SLIDER: SliderSpec = {
  key: "debtInterestRate",
  label: "Annual interest rate",
  min: MIN_DEBT_INTEREST_RATE,
  max: MAX_DEBT_INTEREST_RATE,
  step: 0.0025,
  format: percent
};

const DEBT_END_YEAR_MIN = 1900;
const DEBT_END_YEAR_MAX = 2200;

type AmountKey =
  | "startAssets"
  | "startDebt"
  | "monthlySpending"
  | "annualIncome"
  | "rentalIncome"
  | "windfallAmount"
  | "cashBalance"
  | "nonLiquidInvestments"
  | "otherFixedAssets"
  | "primaryResidenceValue"
  | "otherPropertyValue";

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

const REAL_ESTATE_AMOUNTS: AmountSpec[] = [
  { key: "primaryResidenceValue", label: "Primary Residence value", min: 0, max: 100_000_000 },
  { key: "otherPropertyValue", label: "Other Property value", min: 0, max: 100_000_000 }
];

const WINDFALL_YEAR_MIN = 1900;
const WINDFALL_YEAR_MAX = 2200;

const ACCENT = {
  aboutYou: "var(--navy-soft)",
  assetsDebt: "var(--teal)",
  incomeExpenses: "var(--coral)",
  realEstate: "var(--gold)",
  lifeEvents: "var(--violet)",
  macro: "var(--slate)"
} as const;

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
  const annual = v.annualIncome + v.rentalIncome;
  return `${formatCompact(annual)}/yr income · ${formatCompact(v.monthlySpending)}/mo expenses`;
}

function summarizeRealEstate(
  v: PlanInputs,
  formatCompact: (n: number) => string
): string {
  const total = v.primaryResidenceValue + v.otherPropertyValue;
  return total > 0 ? formatCompact(total) : "—";
}

function summarizeLifeEvents(
  v: PlanInputs,
  formatCompact: (n: number) => string
): string {
  if (v.windfallAmount <= 0) return "None scheduled";
  return `Windfall ${formatCompact(v.windfallAmount)} in ${v.windfallYear}`;
}

function summarizeMacro(v: PlanInputs): string {
  return `Inflation ${(v.inflationRate * 100).toFixed(1)}%`;
}

export function PlannerForm({ value, onChange, onReset }: Props) {
  const { format, formatCompact } = useCurrency();
  const update = <K extends keyof PlanInputs>(key: K, next: PlanInputs[K]) => {
    onChange({ ...value, [key]: next });
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
            {renderAmounts(NON_LIQUID_AMOUNTS)}
          </CollapsibleSubsection>

          <CollapsibleSubsection
            title="Debt"
            accent={ACCENT.assetsDebt}
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
            <FramedField
              label={value.debtRepaymentType === "inFine" ? "Lump sum repayment year" : "Loan end year"}
            >
              <input
                type="number"
                min={DEBT_END_YEAR_MIN}
                max={DEBT_END_YEAR_MAX}
                step={1}
                value={value.debtEndYear}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  update("debtEndYear", Number.isFinite(parsed) ? parsed : 0);
                }}
                className="field-input"
                aria-label={
                  value.debtRepaymentType === "inFine"
                    ? "Lump sum repayment year"
                    : "Loan end year"
                }
                inputMode="numeric"
              />
            </FramedField>
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
            label="Annual Rental Income"
            value={value.rentalIncome}
            onChange={(next) => update("rentalIncome", next)}
            min={0}
            max={10_000_000}
          />
          <SliderRow
            spec={RENTAL_INCOME_RATE_SLIDER}
            value={value.rentalIncomeRate}
            onChange={(next) => update("rentalIncomeRate", next)}
          />
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
          <CurrencyField
            label={REAL_ESTATE_AMOUNTS[0].label}
            value={value[REAL_ESTATE_AMOUNTS[0].key]}
            onChange={(next) => update(REAL_ESTATE_AMOUNTS[0].key, next)}
            min={REAL_ESTATE_AMOUNTS[0].min}
            max={REAL_ESTATE_AMOUNTS[0].max}
          />
          <SliderRow
            spec={PRIMARY_RESIDENCE_RATE_SLIDER}
            value={value.primaryResidenceRate}
            onChange={(next) => update("primaryResidenceRate", next)}
          />
          <CurrencyField
            label={REAL_ESTATE_AMOUNTS[1].label}
            value={value[REAL_ESTATE_AMOUNTS[1].key]}
            onChange={(next) => update(REAL_ESTATE_AMOUNTS[1].key, next)}
            min={REAL_ESTATE_AMOUNTS[1].min}
            max={REAL_ESTATE_AMOUNTS[1].max}
          />
          <SliderRow
            spec={OTHER_PROPERTY_RATE_SLIDER}
            value={value.otherPropertyRate}
            onChange={(next) => update("otherPropertyRate", next)}
          />
        </CollapsibleCategory>

        <CollapsibleCategory
          title="Life Events"
          accent={ACCENT.lifeEvents}
          icon={<IconSparkle />}
          summary={summarizeLifeEvents(value, formatCompact)}
        >
          <CurrencyField
            label="Windfall amount"
            value={value.windfallAmount}
            onChange={(next) => update("windfallAmount", next)}
            min={0}
            max={100_000_000}
          />
          <FramedField label="Windfall year">
            <input
              type="number"
              min={WINDFALL_YEAR_MIN}
              max={WINDFALL_YEAR_MAX}
              step={1}
              value={value.windfallYear}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                update("windfallYear", Number.isFinite(parsed) ? parsed : 0);
              }}
              className="field-input"
              aria-label="Windfall year"
              inputMode="numeric"
            />
          </FramedField>
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
        open ? "py-4 md:py-5" : "pb-3 pt-2 md:pb-4 md:pt-2"
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
        <div id={panelId} className="space-y-4 pt-2">
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
  return (
    <div
      className="space-y-3 border-l pl-3"
      data-testid={testId}
      style={{ borderColor: `color-mix(in oklab, ${accent} 40%, transparent)` }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 text-[13px] font-medium"
        style={{ color: accent }}
      >
        <span>{title}</span>
        <Chevron open={open} small />
      </button>
      {open ? (
        <div id={panelId} className="space-y-4">
          {children}
        </div>
      ) : null}
    </div>
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

function SliderRow({
  spec,
  value,
  onChange
}: {
  spec: SliderSpec;
  value: number;
  onChange: (next: number) => void;
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
      />
      <div className="flex items-center justify-between text-[11px] text-[var(--ink-muted)]">
        <span>{spec.format(spec.min)}</span>
        <span>{spec.format(spec.max)}</span>
      </div>
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
