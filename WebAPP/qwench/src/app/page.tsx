import { Suspense } from "react";
import { Hero } from "@/components/home/Hero";
import { StatsRow } from "@/components/home/StatsRow";
import { FeaturedChecks } from "@/components/home/FeaturedChecks";
import { HowItWorks } from "@/components/home/HowItWorks";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Suspense fallback={<Placeholder height="h-24" />}>
        <StatsRow />
      </Suspense>
      <Suspense fallback={<Placeholder height="h-40" />}>
        <FeaturedChecks />
      </Suspense>
      <HowItWorks />
    </>
  );
}

function Placeholder({ height }: { height: string }) {
  return (
    <section className="px-4 pb-12">
      <div className={`mx-auto max-w-4xl ${height} rounded-xl bg-surface-alt animate-pulse`} />
    </section>
  );
}
