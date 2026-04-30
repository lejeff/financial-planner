import type { Metadata } from "next";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { FeatureShowcase } from "@/components/landing/FeatureShowcase";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { Pricing } from "@/components/landing/Pricing";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { LandingFooter } from "@/components/landing/LandingFooter";

export const metadata: Metadata = {
  title: "Financial Planner — Plan Your Financial Future with Confidence",
  description:
    "Simulate your financial future and chart a course toward your best life. Interactive retirement projections with no account required — your data stays on your device."
};

export default function LandingPage() {
  return (
    <>
      <LandingHeader />
      <main>
        <LandingHero />
        <FeatureShowcase />
        <FeatureGrid />
        <Pricing />
        <FinalCTA />
      </main>
      <LandingFooter />
    </>
  );
}
