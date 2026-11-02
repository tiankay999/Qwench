import {
  XCircle,
  AlertTriangle,
  Users,
  Globe,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { RiskReport } from "@/lib/types";

export function BreakdownGrid({ report }: { report: RiskReport }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <XCircle className="w-5 h-5 text-danger" />
          <h3 className="font-bold text-sm text-text-primary uppercase">
            SEC Status
          </h3>
        </div>
        <p className="font-bold text-text-primary mb-1">{report.secStatus}</p>
        <p className="text-sm text-text-secondary">{report.secDetail}</p>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-warning" />
          <h3 className="font-bold text-sm text-text-primary uppercase">
            {report.redFlags.length} Red Flags Found
          </h3>
        </div>
        <ul className="space-y-2">
          {report.redFlags.map((flag) => (
            <li key={flag.number} className="flex gap-3 text-sm">
              <span className="text-danger font-bold">
                {String(flag.number).padStart(2, "0")}
              </span>
              <span className="text-text-secondary">{flag.text}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-accent" />
            <h3 className="font-bold text-sm text-text-primary uppercase">
              Community Reports
            </h3>
          </div>
          <span className="text-2xl font-bold text-text-primary">
            {report.communityReports}
          </span>
        </div>
        <blockquote className="border-l-2 border-danger pl-3 text-sm text-text-secondary italic">
          {report.communityQuote.text}
        </blockquote>
        <p className="text-xs text-text-muted mt-2">
          — {report.communityQuote.author} · {report.communityQuote.timeAgo}
        </p>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-5 h-5 text-accent" />
          <h3 className="font-bold text-sm text-text-primary uppercase">
            Online Presence
          </h3>
        </div>
        <dl className="space-y-2">
          {Object.entries(report.onlinePresence).map(([key, value]) => {
            const label = key
              .replace(/([A-Z])/g, " $1")
              .replace(/^./, (s) => s.toUpperCase());
            const isNegative =
              value === "No" ||
              value === "Negative" ||
              value === "Suspicious";
            return (
              <div key={key} className="flex justify-between text-sm">
                <dt className="text-text-secondary">{label}</dt>
                <dd
                  className={
                    isNegative
                      ? "font-semibold text-danger"
                      : "font-semibold text-text-primary"
                  }
                >
                  {value}
                </dd>
              </div>
            );
          })}
        </dl>
      </Card>
    </div>
  );
}
