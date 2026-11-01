import Link from "next/link";
import { trendingWarnings } from "@/lib/mock-data";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { cn } from "@/lib/cn";
import type { RiskLevel } from "@/lib/types";

const borderColors: Record<RiskLevel, string> = {
  HIGH: "border-danger",
  MEDIUM: "border-warning",
  LOW: "border-safe",
};

export function TrendingWarnings() {
  return (
    <section className="px-4 pb-16">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-text-primary">
            Trending warnings
          </h2>
          <Link
            href="/community"
            className="text-sm font-medium text-accent hover:underline"
          >
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {trendingWarnings.map((w) => (
            <Link key={w.slug} href={`/report/${w.slug}`}>
              <div
                className={cn(
                  "rounded-xl border-2 bg-surface p-5 hover:shadow-md transition-shadow",
                  borderColors[w.risk]
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <RiskBadge level={w.risk} />
                  <span className="text-xs text-text-muted">
                    {w.reports} reports
                  </span>
                </div>
                <h3 className="font-bold text-text-primary mb-1">{w.name}</h3>
                <p className="text-xs text-text-secondary">{w.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
