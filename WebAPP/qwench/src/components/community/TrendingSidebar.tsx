import { mostReportedThisWeek } from "@/lib/mock-data";

const riskColors = {
  HIGH: "text-danger",
  MEDIUM: "text-warning",
  LOW: "text-safe",
} as const;

export function TrendingSidebar() {
  return (
    <div>
      <h3 className="font-bold text-text-primary mb-4 text-sm uppercase">
        Most Reported This Week
      </h3>
      <ol className="space-y-4">
        {mostReportedThisWeek.map((item, i) => (
          <li key={item.name} className="flex items-start gap-3">
            <span className="text-lg font-bold text-text-muted w-6 flex-shrink-0">
              {i + 1}
            </span>
            <div>
              <p className="font-semibold text-sm text-text-primary">
                {item.name}
              </p>
              <p className={`text-xs font-medium ${riskColors[item.risk]}`}>
                {item.reports} reports
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
