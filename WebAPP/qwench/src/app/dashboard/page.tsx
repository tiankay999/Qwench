import { Search, Plus } from "lucide-react";
import { watchlistItems, alerts, userReports, user } from "@/lib/mock-data";
import { WatchlistCard } from "@/components/dashboard/WatchlistCard";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { YourReports } from "@/components/dashboard/YourReports";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <p className="text-sm text-text-muted">Welcome back,</p>
          <h1 className="text-2xl font-bold text-text-primary">{user.name}</h1>
        </div>
        <div className="flex items-center w-full sm:w-auto max-w-sm rounded-full border border-border bg-surface overflow-hidden">
          <div className="flex items-center flex-1 px-4 gap-2">
            <Search className="w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Quick check an investment..."
              className="w-full py-2.5 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
              aria-label="Quick search"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-text-primary">
              Your Watchlist
            </h2>
            <button className="flex items-center gap-1 text-sm text-accent font-medium hover:underline cursor-pointer min-h-[44px]">
              <Plus className="w-4 h-4" />
              Add new
            </button>
          </div>
          <div>
            {watchlistItems.map((item) => (
              <WatchlistCard key={item.slug} item={item} />
            ))}
          </div>

          <div className="mt-10">
            <YourReports reports={userReports} />
          </div>
        </div>

        <aside>
          <AlertsPanel alerts={alerts} />
        </aside>
      </div>
    </div>
  );
}
