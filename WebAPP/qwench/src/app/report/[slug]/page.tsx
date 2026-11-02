import { notFound } from "next/navigation";
import Link from "next/link";
import { Share2 } from "lucide-react";
import { riskReports } from "@/lib/mock-data";

export function generateStaticParams() {
  return Object.keys(riskReports).map((slug) => ({ slug }));
}
import { RiskGauge } from "@/components/report/RiskGauge";
import { VerdictBanner } from "@/components/report/VerdictBanner";
import { BreakdownGrid } from "@/components/report/BreakdownGrid";
import { RelatedSearches } from "@/components/report/RelatedSearches";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const report = riskReports[slug];
  if (!report) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="text-xs text-text-muted mb-6">
        <Link href="/" className="hover:text-accent">
          Home
        </Link>
        {" › "}
        <span>Risk Report</span>
        {" › "}
        <span className="text-text-primary">{report.name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-8 mb-10">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <RiskGauge score={report.score} />
          <VerdictBanner
            name={report.name}
            risk={report.risk}
            riskLabel={report.riskLabel}
          />
        </div>

        <div className="space-y-4">
          <Link href={`/submit?target=${report.slug}`} className="block">
            <Button variant="danger" className="w-full">
              Report This Investment
            </Button>
          </Link>
          <button className="flex items-center justify-center gap-2 w-full text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer min-h-[44px]">
            <Share2 className="w-4 h-4" />
            Share Report
          </button>
          <Card className="!p-4">
            <RelatedSearches searches={report.relatedSearches} />
          </Card>
        </div>
      </div>

      <BreakdownGrid report={report} />
    </div>
  );
}
