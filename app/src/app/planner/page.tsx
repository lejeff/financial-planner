import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PlannerPage } from "@/features/planner/PlannerPage";

export default function PlannerRoute() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* #planner anchor is still targeted by the SiteHeader nav and
            "Start planning" CTA, plus the SiteFooter's Planner link.
            scroll-mt-20 keeps anchor jumps from tucking the stat cards
            under the sticky header. */}
        <div id="planner" className="scroll-mt-20">
          <PlannerPage />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
