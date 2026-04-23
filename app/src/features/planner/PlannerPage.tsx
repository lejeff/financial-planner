"use client";

import { useEffect, useMemo, useState } from "react";
import { CashPositionChart } from "./CashPositionChart";
import { PlannerForm } from "./PlannerForm";
import { ProjectionChart } from "./ProjectionChart";
import { ageFromDob, deflateToToday, projectNetWorth } from "./calculator";
import { loadInputs, saveInputs } from "./storage";
import { DEFAULT_PLAN_INPUTS, type PlanInputs } from "./types";
import { useCurrency } from "@/features/currency/CurrencyContext";

type ViewMode = "real" | "nominal";

export function PlannerPage() {
  const { format } = useCurrency();
  const [inputs, setInputs] = useState<PlanInputs>(DEFAULT_PLAN_INPUTS);
  const [hydrated, setHydrated] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("real");

  useEffect(() => {
    setInputs(loadInputs());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveInputs(inputs);
  }, [inputs, hydrated]);

  const nominal = useMemo(() => projectNetWorth(inputs), [inputs]);
  const startYear = nominal[0]?.year ?? new Date().getFullYear();
  const displayed = useMemo(
    () =>
      viewMode === "real" ? deflateToToday(nominal, inputs.inflationRate, startYear) : nominal,
    [viewMode, nominal, inputs.inflationRate, startYear]
  );

  const finalPoint = displayed.at(-1);
  const currentAge = ageFromDob(inputs.dateOfBirth);
  const endAge = finalPoint?.age ?? currentAge;
  const endYear = finalPoint?.year ?? new Date().getFullYear();

  const finalNetWorthLabel = finalPoint ? format(finalPoint.netWorth) : "—";
  const basisLabel = viewMode === "real" ? "today's money" : "future money";

  const netWorthTrend =
    finalPoint && finalPoint.netWorth >= (inputs.startAssets - inputs.startDebt) ? "up" : "down";

  // Surface the earliest point where liquid assets (portfolio + cash) turn
  // negative, so we can warn the user that non-liquid or real-estate assets
  // would have to be sold to cover the shortfall from that year onward.
  const firstNegativeLiquid = displayed.find((p) => p.liquid < 0) ?? null;

  return (
    <main className="mx-auto max-w-6xl px-6 pb-16">
      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard eyebrow="Current age" value={currentAge.toString()} />
        <StatCard
          eyebrow={`Projected net worth at age ${endAge} · ${basisLabel}`}
          value={finalNetWorthLabel}
          accent={netWorthTrend === "up" ? "teal" : "coral"}
        />
        <StatCard eyebrow="Projection ends" value={`Age ${endAge}`} hint={`in ${endYear}`} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr]">
        <div className="card p-6 md:p-7">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-xl text-[var(--navy)]">Your plan</h2>
            <span className="eyebrow">Inputs</span>
          </div>
          <PlannerForm
            value={inputs}
            onChange={setInputs}
            onReset={() => setInputs(DEFAULT_PLAN_INPUTS)}
          />
        </div>
        <div className="space-y-6">
          <div className="card p-6 md:p-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl text-[var(--navy)]">Projected net worth</h2>
              <ViewModeToggle value={viewMode} onChange={setViewMode} />
            </div>
            <ProjectionChart data={displayed} />
            <div className="mt-4 flex items-center gap-5 text-xs text-[var(--ink-soft)]">
              <LegendSwatch color="var(--teal)" label="Positive" />
              <LegendSwatch color="var(--coral)" label="Negative" />
            </div>
          </div>
          <div className="card p-6 md:p-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl text-[var(--navy)]">Liquid position</h2>
              <span className="eyebrow">Portfolio + Cash</span>
            </div>
            <CashPositionChart data={displayed} />
            <div className="mt-4 flex items-center gap-5 text-xs text-[var(--ink-soft)]">
              <LegendSwatch color="var(--teal)" label="Positive" />
              <LegendSwatch color="var(--coral)" label="Shortfall" />
            </div>
            {firstNegativeLiquid ? (
              <LiquidityWarning
                year={firstNegativeLiquid.year}
                age={firstNegativeLiquid.age}
                shortfallLabel={format(firstNegativeLiquid.liquid)}
              />
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function LiquidityWarning({
  year,
  age,
  shortfallLabel
}: {
  year: number;
  age: number;
  shortfallLabel: string;
}) {
  return (
    <div
      role="alert"
      className="mt-5 rounded-xl border border-[var(--coral)]/40 bg-[var(--coral)]/10 p-4"
    >
      <div
        className="eyebrow"
        style={{ color: "var(--coral)" }}
      >
        Liquidity warning
      </div>
      <p className="mt-1 text-sm leading-relaxed text-[var(--navy)]">
        Your liquid position goes negative in <strong>{year}</strong> (age {age}) at{" "}
        <strong className="tabular-nums">{shortfallLabel}</strong>. You may need to sell
        other assets — non-liquid investments or real estate — to cover the shortfall from
        that year onward.
      </p>
    </div>
  );
}

function ViewModeToggle({
  value,
  onChange
}: {
  value: ViewMode;
  onChange: (next: ViewMode) => void;
}) {
  const options: { id: ViewMode; label: string }[] = [
    { id: "real", label: "Today's money" },
    { id: "nominal", label: "Future money" }
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Display basis"
      className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5"
    >
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.id)}
            className={
              "rounded-full px-3 py-1 text-xs font-medium transition-colors " +
              (selected
                ? "bg-[var(--navy)] text-white"
                : "text-[var(--ink-muted)] hover:text-[var(--navy)]")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

type StatCardProps = {
  eyebrow: string;
  value: string;
  hint?: string;
  accent?: "teal" | "coral" | "none";
};

function StatCard({ eyebrow, value, hint, accent = "none" }: StatCardProps) {
  const accentVar =
    accent === "teal" ? "var(--teal)" : accent === "coral" ? "var(--coral)" : "var(--border)";
  return (
    <div className="card relative overflow-hidden p-5">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: accentVar }}
      />
      <div className="eyebrow">{eyebrow}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="font-display text-3xl text-[var(--navy)]">{value}</div>
        {hint ? <div className="text-sm text-[var(--ink-soft)]">{hint}</div> : null}
      </div>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-sm"
        style={{ background: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
