"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Rectangle,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  useYAxisScale
} from "recharts";
import { useMemo, type ReactNode } from "react";
import { useCurrency } from "@/features/currency/CurrencyContext";
import type { ProjectionPoint } from "@app/core";

type Props = {
  data: ProjectionPoint[];
};

const SAVINGS = "#00c6b8";
const SAVINGS_NEG = "#e05c3a";
const OTHER = "#b3ebe6";
const REAL_ESTATE = "#66d7cc";
const DEBT = "#ff7a59";
const NAVY = "#0f2239";
const INK_SOFT = "#4b5b74";
const BORDER = "#e6e3da";

type ChartPoint = ProjectionPoint & {
  debtNeg: number;
};

type BarShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: ChartPoint;
};

function clipIdFor(year: number | string | undefined) {
  return year === undefined ? undefined : `pill-clip-${year}`;
}

// Builds the path for a year's pill outline using ACTUAL rendered bar
// geometry (props.x / props.width from recharts) plus yScale to find the
// y-pixel of the positive total (top), negative total (bottom), and zero
// baseline. The path traces:
//   - positive total: rounded top corners, square bottom (at baseline)
//   - negative total: rounded bottom corners, square top (at baseline)
function buildPillPaths(
  point: ChartPoint,
  barX: number,
  barWidth: number,
  yScale: (v: unknown) => number | undefined
): Array<{ key: string; d: string }> {
  const yZero = yScale(0);
  if (typeof yZero !== "number") return [];

  const positiveTotal =
    Math.max(point.savings, 0) + point.realEstate + Math.max(point.otherAssets, 0);
  const negativeTotal = Math.min(point.savings, 0) + -point.debt;

  const segments: Array<{ key: string; d: string }> = [];
  const x1 = barX;
  const x2 = barX + barWidth;

  if (positiveTotal > 0) {
    const yTop = yScale(positiveTotal);
    if (typeof yTop === "number" && yTop < yZero) {
      const h = yZero - yTop;
      const r = Math.min(barWidth / 2, h);
      const d =
        `M${x1},${yZero}` +
        `L${x1},${yTop + r}` +
        `A${r},${r} 0 0 1 ${x1 + r},${yTop}` +
        `L${x2 - r},${yTop}` +
        `A${r},${r} 0 0 1 ${x2},${yTop + r}` +
        `L${x2},${yZero}Z`;
      segments.push({ key: `pos-${point.year}`, d });
    }
  }
  if (negativeTotal < 0) {
    const yBot = yScale(negativeTotal);
    if (typeof yBot === "number" && yBot > yZero) {
      const h = yBot - yZero;
      const r = Math.min(barWidth / 2, h);
      const d =
        `M${x1},${yZero}` +
        `L${x2},${yZero}` +
        `L${x2},${yBot - r}` +
        `A${r},${r} 0 0 1 ${x2 - r},${yBot}` +
        `L${x1 + r},${yBot}` +
        `A${r},${r} 0 0 1 ${x1},${yBot - r}Z`;
      segments.push({ key: `neg-${point.year}`, d });
    }
  }
  return segments;
}

// Savings bar always renders for every data point, so we use it to emit the
// per-year clipPath <defs>. The clipPath uses the bar's actual rendered x
// and width (from recharts) so the rounded ends sit exactly on the bar's
// real edges. Every other segment simply references the clipPath by id.
function SavingsBarShape(props: BarShapeProps) {
  const yScale = useYAxisScale();
  const point = props.payload;
  const isNegative = (point?.savings ?? 0) < 0;
  const fill = isNegative ? SAVINGS_NEG : SAVINGS;
  const id = clipIdFor(point?.year);

  let defs: ReactNode = null;
  if (
    point &&
    yScale &&
    typeof props.x === "number" &&
    typeof props.width === "number" &&
    id
  ) {
    const segments = buildPillPaths(point, props.x, props.width, yScale);
    if (segments.length > 0) {
      defs = (
        <defs>
          <clipPath id={id}>
            {segments.map((s) => (
              <path key={s.key} d={s.d} />
            ))}
          </clipPath>
        </defs>
      );
    }
  }

  return (
    <g>
      {defs}
      <g clipPath={id ? `url(#${id})` : undefined}>
        <Rectangle {...(props as object)} fill={fill} />
      </g>
    </g>
  );
}

function DebtBarShape(props: BarShapeProps) {
  const id = clipIdFor(props.payload?.year);
  return (
    <g clipPath={id ? `url(#${id})` : undefined}>
      <Rectangle {...(props as object)} />
    </g>
  );
}

function RealEstateBarShape(props: BarShapeProps) {
  const id = clipIdFor(props.payload?.year);
  return (
    <g clipPath={id ? `url(#${id})` : undefined}>
      <Rectangle {...(props as object)} />
    </g>
  );
}

function OtherAssetsBarShape(props: BarShapeProps) {
  const id = clipIdFor(props.payload?.year);
  return (
    <g clipPath={id ? `url(#${id})` : undefined}>
      <Rectangle {...(props as object)} />
    </g>
  );
}

type ChartTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ payload?: ChartPoint }>;
  format: (v: number) => string;
};

function ChartTooltip({ active, payload, label, format }: ChartTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const isPositive = point.netWorth >= 0;
  const savingsColor = point.savings < 0 ? SAVINGS_NEG : SAVINGS;
  const rows: Array<{ label: string; value: number; color: string }> = [
    { label: "Savings", value: point.savings, color: savingsColor }
  ];
  if (point.otherAssets !== 0) {
    rows.push({ label: "Other Assets", value: point.otherAssets, color: OTHER });
  }
  rows.push({ label: "Real Estate", value: point.realEstate, color: REAL_ESTATE });
  if (point.debt !== 0) {
    rows.push({ label: "Debt", value: -point.debt, color: DEBT });
  }
  return (
    <div
      className="min-w-[200px] rounded-xl border bg-white px-3.5 py-2.5 shadow-[0_10px_30px_-12px_rgba(15,34,57,0.25)]"
      style={{ borderColor: BORDER }}
    >
      <div className="font-semibold tabular-nums" style={{ color: NAVY }}>
        {label}
      </div>
      <div className="text-[11px]" style={{ color: INK_SOFT }}>
        {`Age ${point.age}`}
      </div>
      <div className="mt-2 space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2" style={{ color: INK_SOFT }}>
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: row.color }}
              />
              <span>{row.label}</span>
            </div>
            <span className="tabular-nums font-medium" style={{ color: NAVY }}>
              {format(row.value)}
            </span>
          </div>
        ))}
      </div>
      <div
        className="mt-2 border-t pt-1.5 flex items-center justify-between text-xs font-semibold"
        style={{ borderColor: BORDER }}
      >
        <span style={{ color: NAVY }}>Total</span>
        <span
          className="tabular-nums"
          style={{ color: isPositive ? NAVY : DEBT }}
        >
          {format(point.netWorth)}
        </span>
      </div>
    </div>
  );
}

type LegendEntry = { value: string; color: string };

function ChartLegend({ payload }: { payload?: Array<LegendEntry> }) {
  if (!payload) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1">
      {payload.map((entry) => (
        <div key={entry.value} className="flex items-center gap-2 text-xs" style={{ color: INK_SOFT }}>
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: entry.color }}
          />
          <span>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ProjectionChart({ data }: Props) {
  const { format, formatCompact } = useCurrency();
  const chartData: ChartPoint[] = useMemo(
    () => data.map((p) => ({ ...p, debtNeg: -p.debt })),
    [data]
  );
  const hasOther = useMemo(() => data.some((p) => p.otherAssets !== 0), [data]);
  const hasDebt = useMemo(() => data.some((p) => p.debt !== 0), [data]);
  return (
    <div className="h-[440px] w-full">
      <ResponsiveContainer>
        <BarChart data={chartData} stackOffset="sign" margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
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
          <ReferenceLine y={0} stroke={BORDER} />
          <Tooltip
            cursor={{ fill: "rgba(15, 34, 57, 0.04)" }}
            content={<ChartTooltip format={format} />}
          />
          <Legend verticalAlign="bottom" align="left" content={<ChartLegend />} />
          {hasDebt ? (
            <Bar
              dataKey="debtNeg"
              name="Debt"
              stackId="a"
              fill={DEBT}
              shape={<DebtBarShape />}
              isAnimationActive={false}
            />
          ) : null}
          <Bar
            dataKey="savings"
            name="Savings"
            stackId="a"
            fill={SAVINGS}
            shape={<SavingsBarShape />}
            isAnimationActive={false}
          />
          <Bar
            dataKey="realEstate"
            name="Real Estate"
            stackId="a"
            fill={REAL_ESTATE}
            shape={<RealEstateBarShape />}
            isAnimationActive={false}
          />
          {hasOther ? (
            <Bar
              dataKey="otherAssets"
              name="Other Assets"
              stackId="a"
              fill={OTHER}
              shape={<OtherAssetsBarShape />}
              isAnimationActive={false}
            />
          ) : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
