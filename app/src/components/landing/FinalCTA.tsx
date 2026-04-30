import Link from "next/link";

export function FinalCTA() {
  return (
    <section className="py-20 md:py-32 bg-[var(--navy)] relative overflow-hidden">
      {/* Background decoration */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_800px_400px_at_30%_100%,rgba(0,198,184,0.15),transparent_60%),radial-gradient(ellipse_600px_300px_at_70%_0%,rgba(255,122,89,0.1),transparent_60%)]"
      />
      
      <div className="mx-auto max-w-4xl px-6 text-center relative">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-[var(--teal-soft)]">
          Free forever for basic planning
        </div>
        
        <h2 className="mt-8 font-display text-3xl md:text-5xl lg:text-6xl text-white leading-tight text-balance">
          Start planning your{" "}
          <span className="text-[var(--teal)]">financial future</span>{" "}
          today
        </h2>
        
        <p className="mt-6 text-lg md:text-xl text-white/70 max-w-2xl mx-auto">
          No account needed. No credit card required. Your data stays on your device. 
          Just open the planner and start visualizing your path to financial freedom.
        </p>
        
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/planner"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[var(--coral)] text-white font-semibold text-lg shadow-lg shadow-[var(--coral)]/30 hover:bg-[#ff6a45] hover:shadow-xl hover:shadow-[var(--coral)]/40 transition-all hover:-translate-y-0.5"
          >
            Get started free
            <span aria-hidden>&rarr;</span>
          </Link>
        </div>
        
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-white/50">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>No account required</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Privacy-first design</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Real-time projections</span>
          </div>
        </div>
      </div>
    </section>
  );
}
