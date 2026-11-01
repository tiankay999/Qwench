import { AlertTriangle, CheckCircle, Users } from "lucide-react";
import { stats } from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";

const items = [
  {
    icon: AlertTriangle,
    value: stats.scamsFlagged.toLocaleString(),
    label: "SCAMS FLAGGED",
    color: "text-danger",
    bg: "bg-danger/10",
  },
  {
    icon: CheckCircle,
    value: stats.investmentsVerified.toLocaleString(),
    label: "INVESTMENTS VERIFIED",
    color: "text-safe",
    bg: "bg-safe/10",
  },
  {
    icon: Users,
    value: stats.communityReports.toLocaleString(),
    label: "COMMUNITY REPORTS",
    color: "text-accent",
    bg: "bg-accent/10",
  },
];

export function StatsRow() {
  return (
    <section className="px-4 pb-12">
      <div className="mx-auto max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-4">
        {items.map((item) => (
          <Card key={item.label} className="flex items-center gap-4 p-5">
            <div
              className={`w-12 h-12 rounded-full ${item.bg} flex items-center justify-center flex-shrink-0`}
            >
              <item.icon className={`w-6 h-6 ${item.color}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-text-muted font-medium uppercase tracking-wide">
                {item.label}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
