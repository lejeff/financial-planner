"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useCurrency } from "@/features/currency/CurrencyContext";
import type { ProjectionPoint } from "./types";

type Props = {
  data: ProjectionPoint[];
};

const TEAL = "#00c6b8";
const CORAL = "#ff7a59";
const NAVY = "#0f2239";
const INK_SOFT = "#4b5b74";
const BORDER = "#e6e3da";

type ChartTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ payload?: ProjectionPoint }>;
  format: (v: number) => string;
};

function ChartTooltip({ active, payload, label, format }: ChartTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const isPositive = point.liquid >= 0;
  return (
    <div
      className="rounded-xl border bg-white px-3.5 py-2.5 shadow-[0_10px_30px_-12px_rgba(15,34,57,0.25)]"
      style={{ borderColor: BORDER }}
    >
      <div
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: INK_SOFT }}
      >
        {`Year ${label} · Age ${point.age}`}
      </div>
      <div
        className="mt-1 font-medium tabular-nums"
        style={{
          fontFamily: "var(--font-display), serif",
          fontSize: "1.125rem",
          color: isPositive ? NAVY : CORAL
        }}
      >
        {format(point.liquid)}
      </div>
    </div>
  );
}

export function CashPositionChart({ data }: Props) {
  const { format, formatCompact } = useCurrency();
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: INK_SOFT }}
            tickLine={false}
            axisLine={{ stroke: BORDER }}
          />
          <YAxis
            tickFormatter={(v) => formatCompact(Number(v))}
            tick={{ fontSize: 11, fill: INK_SOFT }}
            tickLine={false}
            axisLine={false}
            width={72}
          />
          <ReferenceLine y={0} stroke={BORDER} strokeDasharray="2 2" />
          <Tooltip
            cursor={{ fill: "rgba(15, 34, 57, 0.04)" }}
            content={<ChartTooltip format={format} />}
          />
          <Bar dataKey="liquid" radius={[6, 6, 0, 0]} isAnimationActive={false}>
            {data.map((point) => (
              <Cell key={point.year} fill={point.liquid >= 0 ? TEAL : CORAL} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
