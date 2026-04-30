export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-[var(--border)] bg-[var(--cream-deep)]/60">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div className="font-display text-base font-medium text-[var(--navy)]">
              Financial Planner
            </div>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--ink-soft)]">
              Interactive retirement projections. Your inputs stay on your device &mdash; we
              don&apos;t collect or store them on any server.
            </p>
          </div>
          <div>
            <div className="eyebrow">Product</div>
            <ul className="mt-3 space-y-2 text-sm text-[var(--ink-soft)]">
              <li>
                <a href="#planner" className="hover:text-[var(--navy)]">
                  Planner
                </a>
              </li>
              <li>
                <a href="#how" className="hover:text-[var(--navy)]">
                  How it works
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className="eyebrow">Legal</div>
            <ul className="mt-3 space-y-2 text-sm text-[var(--ink-soft)]">
              <li>
                <a href="#" className="hover:text-[var(--navy)]">
                  Privacy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[var(--navy)]">
                  Terms
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-[var(--border)] pt-6 text-xs leading-relaxed text-[var(--ink-muted)]">
          <p>
            This tool is for informational and educational purposes only and is not financial,
            investment, or tax advice. Projections are hypothetical and based solely on inputs you
            provide.
          </p>
          <p className="mt-3">&copy; {year} Financial Planner. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
