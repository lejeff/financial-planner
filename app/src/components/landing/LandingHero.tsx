import Link from "next/link";

function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v1m0 16v1m8.66-15.66-.71.71M4.05 19.95l-.71.71M21 12h-1M4 12H3m16.66 7.66-.71-.71M4.05 4.05l-.71-.71" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_1200px_600px_at_50%_-100px,rgba(0,198,184,0.18),transparent_70%),radial-gradient(ellipse_800px_400px_at_80%_100px,rgba(255,122,89,0.12),transparent_60%)]"
      />
      
      <div className="mx-auto max-w-6xl px-6 pt-20 pb-16 md:pt-32 md:pb-24">
        <div className="text-center max-w-4xl mx-auto">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--teal)]/10 px-4 py-1.5 text-sm font-medium text-[var(--teal)]">
            <SparklesIcon />
            A calmer way to plan
          </div>

          {/* Main headline */}
          <h1 className="mt-8 font-display text-4xl leading-[1.1] tracking-tight text-[var(--navy)] sm:text-5xl md:text-6xl lg:text-7xl text-balance">
            Plan the retirement you{" "}
            <em className="italic text-[var(--navy-soft)]">actually</em>{" "}
            want.
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--ink-soft)] md:text-xl">
            Drag a few sliders, watch your net worth projection change in real time. Your numbers
            stay on your device &mdash; no account, no tracking, no noise.
          </p>

          {/* CTA buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/planner"
              className="btn-primary text-base px-8 py-3"
            >
              Start planning
              <span aria-hidden className="ml-2">&rarr;</span>
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 text-base font-medium text-[var(--ink-soft)] hover:text-[var(--navy)] transition-colors"
            >
              How it works
            </a>
          </div>

          {/* Trust indicators */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-[var(--ink-muted)]">
            <div className="flex items-center gap-2">
              <ShieldIcon />
              <span>Privacy-first design</span>
            </div>
            <div className="flex items-center gap-2">
              <ChartIcon />
              <span>Real-time projections</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Plan in minutes</span>
            </div>
          </div>
        </div>

        {/* Hero visual - App preview */}
        <div className="mt-16 md:mt-20 relative">
          <div className="relative mx-auto max-w-5xl">
            {/* Browser chrome mockup */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl shadow-[var(--navy)]/10 overflow-hidden">
              {/* Slim window chrome (traffic-light dots only) */}
              <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[var(--cream-deep)] border-b border-[var(--border)]">
                <div className="w-3 h-3 rounded-full bg-[var(--coral)]" />
                <div className="w-3 h-3 rounded-full bg-[var(--gold)]" />
                <div className="w-3 h-3 rounded-full bg-[var(--teal)]" />
              </div>

              {/* App preview content */}
              <div className="p-6 md:p-8 bg-[var(--surface)]">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left column — 2×2 grid of compact section pills,
                      each mirroring one section of the real planner.
                      `auto-rows-fr` keeps both rows the same height so
                      the four cells read as a uniform tile grid. */}
                  <div className="grid grid-cols-2 gap-3 auto-rows-fr">
                    <MockAssetsDebt />
                    <MockRealEstate />
                    <MockIncomeExpenses />
                    <MockLifeEvents />
                  </div>

                  {/* Right column — projection chart mirroring ProjectionChart */}
                  <div className="card p-5 relative">
                    <div className="eyebrow">Net Worth Projection</div>
                    <MockProjectionChart />
                    {/* Floating AI chat bubble */}
                    <div className="absolute -bottom-4 -right-3 sm:-bottom-5 sm:-right-5 max-w-[230px] rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg shadow-[var(--navy)]/10 p-3">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[var(--navy)]">
                          <span className="w-4 h-4 rounded-full bg-[var(--teal)]/15 inline-flex items-center justify-center text-[var(--teal)]">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 3v1m0 16v1m8.66-15.66-.71.71M4.05 19.95l-.71.71M21 12h-1M4 12H3m16.66 7.66-.71-.71M4.05 4.05l-.71-.71" />
                              <circle cx="12" cy="12" r="4" />
                            </svg>
                          </span>
                          AI assistant
                        </div>
                        <span className="inline-flex items-center rounded-full bg-[var(--coral)]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--coral)]">
                          Soon
                        </span>
                      </div>
                      <p className="text-[11px] leading-snug text-[var(--ink-soft)]">
                        If you save $500/mo more, your FI date moves up to <span className="font-semibold text-[var(--navy)]">age 55</span>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-[var(--teal)]/10 rounded-full blur-3xl" />
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-[var(--coral)]/10 rounded-full blur-3xl" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Mock planner sections (for hero browser preview) ──────────────────

function MockChevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M4 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Compact parent-style pill for the 2×2 tile grid. Mirrors the
// planner's CollapsibleCategory chrome (accent border, legend with
// icon + title, top-right chevron) at a smaller size and renders an
// arbitrary body — typically a stack of nested sub-pills or rows.
function MockSectionPill({
  title,
  accent,
  icon,
  children
}: {
  title: string;
  accent: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <fieldset
      className="relative rounded-[1.25rem] border bg-[var(--surface)] px-3 pb-2.5 pt-1 h-full"
      style={{ borderColor: accent }}
    >
      <legend className="px-1" style={{ color: accent }}>
        <span className="flex items-center gap-1.5 text-[12px] font-semibold">
          <span aria-hidden className="inline-flex shrink-0">
            {icon}
          </span>
          <span>{title}</span>
        </span>
      </legend>
      <span
        aria-hidden
        className="absolute right-3 top-[-9px] inline-flex items-center bg-[var(--surface)] px-1 leading-none"
        style={{ color: accent, transform: "translateY(-50%)" }}
      >
        <MockChevron />
      </span>
      <div className="space-y-1.5 pt-0.5">{children}</div>
    </fieldset>
  );
}

// Compact key/value row used inside every section tile. Two-line
// variant: bold label on top line, muted detail underneath, value
// tabular on the right.
function MockKVRow({
  label,
  detail,
  value
}: {
  label: string;
  detail?: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md bg-[var(--cream)] border border-[var(--border)] px-2 py-1">
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[11px] font-semibold text-[var(--navy)]">{label}</div>
        {detail ? (
          <div className="truncate text-[9px] text-[var(--ink-muted)]">{detail}</div>
        ) : null}
      </div>
      <span className="ml-1 shrink-0 text-[11px] font-semibold text-[var(--navy)] tabular-nums">
        {value}
      </span>
    </div>
  );
}

// ─── Section tiles (2×2 grid) ──────────────────────────────────────────

function MockAssetsDebt() {
  return (
    <MockSectionPill title="Assets and Debt" accent="var(--teal)" icon={<MockIconBriefcase />}>
      <MockKVRow label="Liquid" detail="8.5% return on Portfolio" value="$8.5M" />
      <MockKVRow label="Debt" detail="In Fine · 12 yrs left" value="$1.2M" />
    </MockSectionPill>
  );
}

function MockRealEstate() {
  return (
    <MockSectionPill title="Real Estate" accent="var(--gold)" icon={<MockIconHouse />}>
      <MockKVRow label="Primary home" detail="+3.5% / yr" value="$1.7M" />
      <MockKVRow label="Rental condo" detail="+4.2% / yr" value="$530K" />
    </MockSectionPill>
  );
}

function MockIncomeExpenses() {
  return (
    <MockSectionPill title="Income and Expenses" accent="var(--emerald)" icon={<MockIconDollar />}>
      <MockKVRow label="Annual income" detail="Salary + side income" value="$280K" />
      <MockKVRow label="Monthly expenses" detail="$132K / yr" value="$11K" />
    </MockSectionPill>
  );
}

function MockLifeEvents() {
  return (
    <MockSectionPill title="Life Events" accent="var(--violet)" icon={<MockIconSparkle />}>
      <MockKVRow label="Windfall" detail="2032 · inheritance" value="$250K" />
      <MockKVRow label="RE investment" detail="2029 · second home" value="$850K" />
      <MockKVRow label="New debt" detail="2031 · car loan" value="$45K" />
    </MockSectionPill>
  );
}

// Section icons mirror the planner's IconBriefcase / IconHouse /
// IconDollar / IconSparkle so the preview reads as the same surface.
const mockIconStroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const
};

function MockIconBriefcase() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden {...mockIconStroke}>
      <rect x="3" y="6" width="14" height="10" rx="1.5" />
      <path d="M7 6V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V6" />
      <path d="M3 11h14" />
    </svg>
  );
}

function MockIconHouse() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden {...mockIconStroke}>
      <path d="M3 9.5l7-6 7 6" />
      <path d="M5 9v8h10V9" />
    </svg>
  );
}

function MockIconDollar() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden {...mockIconStroke}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 5v10" />
      <path d="M12.5 7.5h-3.5a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 1 0 3H7.5" />
    </svg>
  );
}

function MockIconSparkle() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden {...mockIconStroke}>
      <path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6z" />
    </svg>
  );
}

// Static mockup of the planner's stacked-bar projection chart. Mirrors
// ProjectionChart styling: rounded "pill" tops on positive stacks,
// rounded bottoms on the negative debt segment, teal/coral palette,
// gridlines, axis ticks, legend.
//
// Axis labels live in HTML (positioned by percentage) rather than inside
// the SVG so they stay crisp when the SVG stretches vertically to fill
// the right column. Only bars + gridlines live in the SVG, which uses
// `preserveAspectRatio="none"` to fill the available height.
function MockProjectionChart() {
  const SAVINGS = "#00c6b8";
  const REAL_ESTATE = "#66d7cc";
  const OTHER = "#b3ebe6";
  const DEBT = "#ff7a59";
  const BORDER = "#e6e3da";

  // SVG plot coordinates. Positive area: y=0 → y=BASELINE ($0). Negative
  // (debt) area sits below the baseline up to y=PLOT_H.
  const PLOT_W = 320;
  const BASELINE = 128; // $0 line
  const PLOT_H = 150;   // total plot height (positive 128 + negative 22)

  // 30 bars: 2026–2055. Smooth growth (S-curve savings, linear real-
  // estate, late-arriving other assets, mortgage paydown over ~12 yrs).
  const N = 30;
  const sigmoid = (t: number) => 1 / (1 + Math.exp(-6 * (t - 0.5)));
  const bars = Array.from({ length: N }, (_, i) => {
    const t = i / (N - 1);
    return {
      year: 2026 + i,
      s: Math.round(6 + 74 * sigmoid(t)),
      re: Math.round(10 + 16 * t),
      o: i >= 15 ? Math.round(((i - 14) / 15) * 14) : 0,
      d: i < 12 ? Math.round(22 - (22 / 12) * i) : 0
    };
  });
  const bw = 7;
  const gap = (PLOT_W - bars.length * bw) / (bars.length - 1);

  // Rounded-top path for the topmost positive segment.
  const topPill = (x: number, top: number, h: number, w: number) => {
    const r = Math.min(w / 2, h);
    return (
      `M${x},${top + h}` +
      `L${x},${top + r}` +
      `A${r},${r} 0 0 1 ${x + r},${top}` +
      `L${x + w - r},${top}` +
      `A${r},${r} 0 0 1 ${x + w},${top + r}` +
      `L${x + w},${top + h}Z`
    );
  };
  // Rounded-bottom path for the negative debt segment.
  const bottomPill = (x: number, top: number, h: number, w: number) => {
    const r = Math.min(w / 2, h);
    return (
      `M${x},${top}` +
      `L${x + w},${top}` +
      `L${x + w},${top + h - r}` +
      `A${r},${r} 0 0 1 ${x + w - r},${top + h}` +
      `L${x + r},${top + h}` +
      `A${r},${r} 0 0 1 ${x},${top + h - r}Z`
    );
  };

  // Y-axis ticks: positive area is 128 units = $20M (so each $5M = 32u).
  // `topPct` is the vertical position within the plot (0 = top, 1 = bottom).
  const yTicks = [
    { label: "$20M", y: 0 },
    { label: "$15M", y: 32 },
    { label: "$10M", y: 64 },
    { label: "$5M", y: 96 },
    { label: "$0", y: BASELINE }
  ].map((t) => ({ ...t, topPct: (t.y / PLOT_H) * 100 }));

  // X-axis label positions (every 5th year + the last bar).
  const xLabels = bars
    .map((b, i) => ({
      year: b.year,
      leftPct: ((i * (bw + gap) + bw / 2) / PLOT_W) * 100,
      show: i % 5 === 0 || i === bars.length - 1
    }))
    .filter((l) => l.show);

  const legend = [
    { label: "Debt", color: DEBT },
    { label: "Savings", color: SAVINGS },
    { label: "Real Estate", color: REAL_ESTATE },
    { label: "Other Assets", color: OTHER }
  ];

  return (
    <div className="mt-3">
      {/* Plot row: y-axis labels + fixed-height SVG chart. h-56 (224px)
          gives the browser preview ~10% more vertical presence than the
          original h-48 baseline; the 2×2 tile grid stretches to match. */}
      <div className="flex h-56">
        {/* Y-axis labels (HTML, percentage-positioned) */}
        <div className="relative w-9 shrink-0 text-[10px] tabular-nums text-[var(--ink-muted)]">
          {yTicks.map((t) => (
            <span
              key={t.label}
              className="absolute right-1 -translate-y-1/2 whitespace-nowrap"
              style={{ top: `${t.topPct}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>

        {/* Plot area: SVG with gridlines + bars stretches to fill */}
        <div className="relative flex-1 min-w-0 h-full">
          <svg
            viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full"
            aria-hidden
          >
            {/* Horizontal gridlines (non-scaling stroke so they stay 1px) */}
            {yTicks.map((t) => (
              <line
                key={`g-${t.label}`}
                x1={0}
                x2={PLOT_W}
                y1={t.y}
                y2={t.y}
                stroke={BORDER}
                strokeDasharray={t.y === BASELINE ? undefined : "3 3"}
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {/* Bars */}
            {bars.map((b, i) => {
              const x = i * (bw + gap);
              const sH = b.s;
              const reH = b.re;
              const oH = b.o;
              const sTop = BASELINE - sH;
              const reTop = sTop - reH;
              const oTop = reTop - oH;
              const topSegment =
                oH > 0 ? "other" : reH > 0 ? "re" : sH > 0 ? "savings" : null;

              return (
                <g key={b.year}>
                  {sH > 0 && topSegment === "savings" ? (
                    <path d={topPill(x, sTop, sH, bw)} fill={SAVINGS} />
                  ) : sH > 0 ? (
                    <rect x={x} y={sTop} width={bw} height={sH} fill={SAVINGS} />
                  ) : null}

                  {reH > 0 && topSegment === "re" ? (
                    <path d={topPill(x, reTop, reH, bw)} fill={REAL_ESTATE} />
                  ) : reH > 0 ? (
                    <rect x={x} y={reTop} width={bw} height={reH} fill={REAL_ESTATE} />
                  ) : null}

                  {oH > 0 && topSegment === "other" ? (
                    <path d={topPill(x, oTop, oH, bw)} fill={OTHER} />
                  ) : null}

                  {b.d > 0 ? (
                    <path d={bottomPill(x, BASELINE, b.d, bw)} fill={DEBT} />
                  ) : null}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* X-axis labels (HTML, aligned with bar centers via percent-left) */}
      <div className="relative h-4 mt-1 ml-9">
        {xLabels.map((l) => (
          <span
            key={l.year}
            className="absolute -translate-x-1/2 text-[10px] tabular-nums text-[var(--ink-muted)]"
            style={{ left: `${l.leftPct}%` }}
          >
            {l.year}
          </span>
        ))}
      </div>

      {/* Legend (matches planner: dot + label) */}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--ink-muted)]">
        {legend.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
