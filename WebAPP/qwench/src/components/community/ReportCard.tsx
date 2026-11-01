import { ArrowUp, MessageCircle, Share2 } from "lucide-react";
import { RiskBadge } from "@/components/ui/RiskBadge";
import type { CommunityReport } from "@/lib/types";

export function ReportCard({ report }: { report: CommunityReport }) {
  return (
    <div className="border-b border-border py-6">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-mid-navy flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {report.authorInitials}
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {report.authorName}
            </p>
            <p className="text-xs text-text-muted">
              {report.timeAgo} · {report.location}
            </p>
          </div>
        </div>
        <RiskBadge level={report.risk} />
      </div>

      <h3 className="font-bold text-text-primary mb-2">
        {report.investmentName}
      </h3>
      <p className="text-sm text-text-secondary mb-4">{report.body}</p>

      <div className="flex items-center gap-6">
        <button className="flex items-center gap-1.5 text-sm text-text-muted hover:text-accent transition-colors cursor-pointer min-h-[44px]">
          <ArrowUp className="w-4 h-4" />
          {report.upvotes}
        </button>
        <button className="flex items-center gap-1.5 text-sm text-text-muted hover:text-accent transition-colors cursor-pointer min-h-[44px]">
          <MessageCircle className="w-4 h-4" />
          {report.comments} comments
        </button>
        <button className="flex items-center gap-1.5 text-sm text-text-muted hover:text-accent transition-colors cursor-pointer min-h-[44px]">
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>
    </div>
  );
}
