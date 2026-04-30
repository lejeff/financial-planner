"use client";

import Link from "next/link";
import { useState } from "react";

function LogoMark() {
  return (
    <svg
      width="32"
      height="32"
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

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--cream)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3">
          <LogoMark />
          <span className="font-display text-xl font-semibold text-[var(--navy)]">
            Financial Planner
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-[var(--ink-soft)] md:flex">
          <a href="#features" className="transition-colors hover:text-[var(--navy)]">
            Features
          </a>
          <a href="#how-it-works" className="transition-colors hover:text-[var(--navy)]">
            How it works
          </a>
          <a href="#pricing" className="transition-colors hover:text-[var(--navy)]">
            Pricing
          </a>
          <a href="/planner" className="transition-colors hover:text-[var(--navy)]">
            Try it free
          </a>
        </nav>

        <div className="flex items-center gap-4">
          <a
            href="/planner"
            className="btn-primary hidden sm:inline-flex"
          >
            Get started free
          </a>
          <button
            className="md:hidden p-2 text-[var(--ink-soft)] hover:text-[var(--navy)]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[var(--border)] bg-[var(--cream)]">
          <nav className="flex flex-col px-6 py-4 gap-4">
            <a
              href="#features"
              className="text-base font-medium text-[var(--ink-soft)] hover:text-[var(--navy)]"
              onClick={() => setMobileMenuOpen(false)}
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-base font-medium text-[var(--ink-soft)] hover:text-[var(--navy)]"
              onClick={() => setMobileMenuOpen(false)}
            >
              How it works
            </a>
            <a
              href="#pricing"
              className="text-base font-medium text-[var(--ink-soft)] hover:text-[var(--navy)]"
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </a>
            <a
              href="/planner"
              className="btn-primary text-center justify-center mt-2"
            >
              Get started free
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
