"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { communityReports } from "@/lib/mock-data";
import { ReportCard } from "@/components/community/ReportCard";
import { FilterTabs } from "@/components/community/FilterTabs";
import { TrendingSidebar } from "@/components/community/TrendingSidebar";
import { Button } from "@/components/ui/Button";

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState("All");

  const filtered =
    activeTab === "All"
      ? communityReports
      : communityReports.filter((r) => r.category === activeTab);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Community Reports
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Real reports from real Ghanaians · Updated live
          </p>
        </div>
        <Link href="/submit">
          <Button>
            <Plus className="w-4 h-4" />
            Submit a Report
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10 mt-8">
        <div>
          <FilterTabs active={activeTab} onChange={setActiveTab} />
          <div>
            {filtered.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        </div>
        <aside className="hidden lg:block">
          <TrendingSidebar />
        </aside>
      </div>
    </div>
  );
}
