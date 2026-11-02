import { RiskBadge } from "@/components/ui/RiskBadge";
import type { RiskLevel } from "@/lib/types";

interface VerdictBannerProps {
  name: string;
  risk: RiskLevel;
  riskLabel: string;
}

export function VerdictBanner({ name, risk, riskLabel }: VerdictBannerProps) {
  return (
    <div>
      <p className="text-xs text-text-muted uppercase tracking-wide font-medium mb-1">
        RISK REPORT
      </p>
      <h1 className="text-2xl md:text-3xl font-extrabold text-text-primary mb-3">
        {name}
      </h1>
      <RiskBadge level={risk} />
      <p className="text-sm text-text-secondary mt-2">{riskLabel}</p>
    </div>
  );
}
