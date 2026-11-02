import { Hero } from "@/components/home/Hero";
import { StatsRow } from "@/components/home/StatsRow";
import { TrendingWarnings } from "@/components/home/TrendingWarnings";
import { HowItWorks } from "@/components/home/HowItWorks";

export default function HomePage() {
  return (
    <>
      <Hero />
      <StatsRow />
      <TrendingWarnings />
      <HowItWorks />
    </>
  );
}
