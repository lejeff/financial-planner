import Link from "next/link";

function LogoMark() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="8" fill="var(--navy)" />
      <path
        d="M8 22V10h4.5a4 4 0 0 1 2.8 6.86A4.2 4.2 0 0 1 13 22H8Zm3-7h1.5a1.5 1.5 0 0 0 0-3H11v3Zm0 4h2a1.5 1.5 0 0 0 0-3h-2v3Z"
        fill="var(--teal)"
      />
      <circle cx="23" cy="22" r="2" fill="var(--coral)" />
    </svg>
  );
}

export function LandingFooter() {
  const year = new Date().getFullYear();
  
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--cream-deep)]">
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="grid gap-12 md:grid-cols-[2fr_1fr_1fr_1fr]">
          {/* Brand column */}
          <div>
            <Link href="/" className="flex items-center gap-3">
              <LogoMark />
              <span className="font-display text-lg font-semibold text-[var(--navy)]">
                Financial Planner
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[var(--ink-soft)]">
              Interactive retirement projections with real-time updates. Your data stays on your device - 
              we don&apos;t collect or store any of your financial information.
            </p>
            <div className="mt-6 flex gap-4">
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--navy)] hover:border-[var(--border-strong)] transition-colors"
                aria-label="Twitter"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--navy)] hover:border-[var(--border-strong)] transition-colors"
                aria-label="GitHub"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
                </svg>
              </a>
            </div>
          </div>
          
          {/* Product column */}
          <div>
            <div className="eyebrow">Product</div>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link href="/planner" className="text-[var(--ink-soft)] hover:text-[var(--navy)] transition-colors">
                  Planner
                </Link>
              </li>
              <li>
                <a href="#features" className="text-[var(--ink-soft)] hover:text-[var(--navy)] transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="text-[var(--ink-soft)] hover:text-[var(--navy)] transition-colors">
                  How it works
                </a>
              </li>
              <li>
                <a href="#" className="text-[var(--ink-soft)] hover:text-[var(--navy)] transition-colors">
                  Pricing
                </a>
              </li>
            </ul>
          </div>
          
          {/* Resources column */}
          <div>
            <div className="eyebrow">Resources</div>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a href="#" className="text-[var(--ink-soft)] hover:text-[var(--navy)] transition-colors">
                  Blog
                </a>
              </li>
              <li>
                <a href="#" className="text-[var(--ink-soft)] hover:text-[var(--navy)] transition-colors">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="text-[var(--ink-soft)] hover:text-[var(--navy)] transition-colors">
                  Contact
                </a>
              </li>
              <li>
                <a href="#" className="text-[var(--ink-soft)] hover:text-[var(--navy)] transition-colors">
                  Changelog
                </a>
              </li>
            </ul>
          </div>
          
          {/* Legal column */}
          <div>
            <div className="eyebrow">Legal</div>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a href="#" className="text-[var(--ink-soft)] hover:text-[var(--navy)] transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-[var(--ink-soft)] hover:text-[var(--navy)] transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="text-[var(--ink-soft)] hover:text-[var(--navy)] transition-colors">
                  Cookie Policy
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom section */}
        <div className="mt-12 pt-8 border-t border-[var(--border)]">
          <div className="text-xs leading-relaxed text-[var(--ink-muted)]">
            <p className="max-w-4xl">
              <strong>Disclaimer:</strong> This tool is for informational and educational purposes only and should not be construed as 
              professional financial or investment advice. Projections are hypothetical and based solely on inputs you provide. 
              We strongly recommend consulting a financial services professional before making any significant financial decisions.
            </p>
            <p className="mt-4">&copy; {year} Financial Planner. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
