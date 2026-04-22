"use client";

import { CurrencyField } from "./CurrencyField";
import { FramedField } from "./FramedField";
import {
  MAX_APPRECIATION,
  MAX_HORIZON_YEARS,
  MIN_APPRECIATION,
  MIN_HORIZON_YEARS
} from "./calculator";
import type { PlanInputs } from "./types";

type Props = {
  value: PlanInputs;
  onChange: (next: PlanInputs) => void;
  onReset: () => void;
};

type SliderKey =
  | "nominalReturn"
  | "horizonYears"
  | "primaryResidenceRate"
  | "otherPropertyRate"
  | "rentalIncomeRate";

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

const HORIZON_SLIDER: SliderSpec = {
  key: "horizonYears",
  label: "Projection horizon",
  min: MIN_HORIZON_YEARS,
  max: MAX_HORIZON_YEARS,
  step: 1,
  format: years
};

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

export function PlannerForm({ value, onChange, onReset }: Props) {
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
    <form className="space-y-8" onSubmit={(event) => event.preventDefault()}>
      <fieldset className="space-y-4">
        <legend className="eyebrow">About you</legend>
        <FramedField label="Date of birth">
          <input
            type="date"
            value={value.dateOfBirth}
            onChange={(event) => update("dateOfBirth", event.target.value)}
            className="field-input"
            aria-label="Date of birth"
          />
        </FramedField>
      </fieldset>

      <div className="space-y-4">
        <p className="eyebrow">
          Your numbers{" "}
          <span className="font-normal normal-case tracking-normal text-[var(--ink-muted)]">
            &middot; in today&apos;s money
          </span>
        </p>

        <fieldset className="space-y-6 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-5">
          <legend className="eyebrow px-1 text-[var(--navy)]">Assets and Debt</legend>

          <div className="space-y-4" data-testid="subsection-liquid">
            <p className="eyebrow text-[11px] tracking-[0.14em] text-[var(--ink-muted)]">Liquid</p>
            {renderAmounts([LIQUID_AMOUNTS[0]])}
            <SliderRow
              spec={NOMINAL_RETURN_SLIDER}
              value={value.nominalReturn}
              onChange={(next) => update("nominalReturn", next)}
            />
            {renderAmounts([LIQUID_AMOUNTS[1]])}
          </div>

          <div className="space-y-4" data-testid="subsection-non-liquid">
            <p className="eyebrow text-[11px] tracking-[0.14em] text-[var(--ink-muted)]">
              Non-Liquid
            </p>
            {renderAmounts(NON_LIQUID_AMOUNTS)}
          </div>

          <div className="space-y-4" data-testid="subsection-debt">
            <p className="eyebrow text-[11px] tracking-[0.14em] text-[var(--ink-muted)]">Debt</p>
            {renderAmounts(DEBT_AMOUNTS)}
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-5">
          <legend className="eyebrow px-1 text-[var(--navy)]">Income &amp; Expenses</legend>
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
          <CurrencyField
            label="Recurring monthly expenses"
            value={value.monthlySpending}
            onChange={(next) => update("monthlySpending", next)}
            min={0}
            max={1_000_000}
          />
        </fieldset>

        <fieldset className="space-y-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-5">
          <legend className="eyebrow px-1 text-[var(--navy)]">Real Estate</legend>
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
        </fieldset>

        <div className="pt-2">
          <SliderRow
            spec={HORIZON_SLIDER}
            value={value.horizonYears}
            onChange={(next) => update("horizonYears", next)}
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button type="button" onClick={onReset} className="btn-ghost">
          Reset to defaults
        </button>
      </div>
    </form>
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
