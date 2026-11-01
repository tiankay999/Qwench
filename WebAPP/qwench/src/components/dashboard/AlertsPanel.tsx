import { AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";
import type { Alert } from "@/lib/types";

const iconMap = {
  "risk-change": { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10" },
  verified: { icon: CheckCircle, color: "text-safe", bg: "bg-safe/10" },
  trending: { icon: TrendingUp, color: "text-danger", bg: "bg-danger/10" },
} as const;

export function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-text-primary mb-4">Alerts</h2>
      <div className="space-y-3">
        {alerts.map((alert) => {
          const config = iconMap[alert.type];
          const Icon = config.icon;
          return (
            <div
              key={alert.id}
              className={`rounded-xl p-4 ${config.bg} border border-transparent`}
            >
              <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 ${config.color} flex-shrink-0 mt-0.5`} />
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {alert.title}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {alert.description}
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    {alert.timeAgo}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
