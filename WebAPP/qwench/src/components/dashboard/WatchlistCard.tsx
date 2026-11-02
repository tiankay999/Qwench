import Link from "next/link";
import type { WatchlistItem } from "@/lib/types";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

const riskColors = {
  HIGH: "text-danger",
  MEDIUM: "text-warning",
  LOW: "text-safe",
} as const;

const scoreBg = {
  HIGH: "bg-danger/10",
  MEDIUM: "bg-warning/10",
  LOW: "bg-safe/10",
} as const;

export function WatchlistCard({ item }: { item: WatchlistItem }) {
  return (
    <Link href={`/report/${item.slug}`}>
      <div className="flex items-center justify-between py-4 border-b border-border hover:bg-surface-alt px-3 -mx-3 rounded-lg transition-colors">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center",
              scoreBg[item.risk]
            )}
          >
            <span
              className={cn("text-xl font-bold", riskColors[item.risk])}
            >
              {item.score}
            </span>
          </div>
          <div>
            <p className="font-semibold text-text-primary text-sm">
              {item.name}
            </p>
            <p className={cn("text-xs font-medium", riskColors[item.risk])}>
              {item.risk} RISK · {item.change}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-text-muted">
          <span className="text-xs hidden sm:inline">Added {item.addedAgo}</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </Link>
  );
}
