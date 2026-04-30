function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[var(--teal)]"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const plans = [
  {
    name: "Free",
    description: "Perfect for getting started with financial planning",
    price: "$0",
    period: "forever",
    features: [
      "Basic net worth projections",
      "Single scenario planning",
      "Local data storage",
      "Core calculators",
      "Community support",
    ],
    cta: "Start free",
    highlighted: false,
  },
  {
    name: "Pro",
    description: "For serious planners who want deeper insights",
    price: "$9",
    period: "/month",
    features: [
      "Unlimited scenarios",
      "Advanced projections",
      "Multiple currency support",
      "Tax optimization insights",
      "Export to PDF & CSV",
      "Priority email support",
    ],
    cta: "Get Pro",
    highlighted: true,
  },
  {
    name: "Family",
    description: "Plan together with your partner or family",
    price: "$15",
    period: "/month",
    features: [
      "Everything in Pro",
      "Joint planning for 2 people",
      "Shared scenarios & goals",
      "Family dashboard",
      "Couples goal tracking",
      "Dedicated support",
    ],
    cta: "Get Family",
    highlighted: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-32 bg-[var(--cream)]">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <div className="eyebrow text-[var(--teal)]">Simple pricing</div>
          <h2 className="mt-4 font-display text-3xl md:text-5xl text-[var(--navy)] leading-tight text-balance">
            Choose your path to financial freedom
          </h2>
          <p className="mt-4 text-lg text-[var(--ink-soft)]">
            Start free and upgrade as your planning needs grow. No hidden fees, cancel anytime.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`card p-6 md:p-8 flex flex-col relative ${
                plan.highlighted
                  ? "ring-2 ring-[var(--teal)] shadow-lg shadow-[var(--teal)]/10"
                  : ""
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--teal)] text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-[var(--navy)]">
                  {plan.name}
                </h3>
                <p className="mt-2 text-sm text-[var(--ink-muted)]">
                  {plan.description}
                </p>
              </div>

              <div className="mb-6">
                <span className="font-display text-4xl md:text-5xl text-[var(--navy)]">
                  {plan.price}
                </span>
                <span className="text-[var(--ink-muted)] ml-1">{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <CheckIcon />
                    <span className="text-sm text-[var(--ink-soft)]">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`w-full py-3 px-6 rounded-full font-semibold text-sm transition-all duration-200 ${
                  plan.highlighted
                    ? "btn-primary justify-center"
                    : "bg-[var(--cream-deep)] text-[var(--navy)] hover:bg-[var(--border)] hover:shadow-sm"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-[var(--ink-muted)]">
          All plans include a 14-day free trial of Pro features.{" "}
          <a href="#" className="text-[var(--teal)] hover:underline">
            Compare plans in detail
          </a>
        </p>
      </div>
    </section>
  );
}
