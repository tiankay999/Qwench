import { CheckCircle } from "lucide-react";
import type { UserReport } from "@/lib/types";

export function YourReports({ reports }: { reports: UserReport[] }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-text-primary mb-4">
        Your Reports
      </h2>
      <div className="space-y-3">
        {reports.map((report) => (
          <div
            key={report.id}
            className="flex items-center justify-between py-3 border-b border-border"
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-safe flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {report.investmentName}
                </p>
                <p className="text-xs text-text-secondary">{report.status}</p>
              </div>
            </div>
            <span className="text-xs text-text-muted">{report.timeAgo}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
