import { cn } from "@/lib/cn";
import type { RiskLevel } from "@/lib/types";

const colors: Record<RiskLevel, string> = {
  HIGH: "bg-danger/10 text-danger",
  MEDIUM: "bg-warning/10 text-warning",
  LOW: "bg-safe/10 text-safe",
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span
      className={cn(
        "inline-block rounded-md px-2.5 py-1 text-xs font-bold uppercase",
        colors[level]
      )}
    >
      {level} RISK
    </span>
  );
}
