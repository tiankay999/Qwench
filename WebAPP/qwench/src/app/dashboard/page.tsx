"use client";

import Link from "next/link";
import { Bookmark, Laptop, Plus } from "lucide-react";
import { useWatchlist } from "@/lib/watchlist";
import { WatchlistRow } from "@/components/watchlist/WatchlistRow";
import { SearchBar } from "@/components/ui/SearchBar";

/**
 * The watchlist.
 *
 * The prototype's dashboard had a signed-in user, risk scores that moved
 * ("worsening (+2.8)"), alerts about score changes, and a list of the person's
 * own reports. None of that can exist: there are no scores, Qwench has no
 * public sign-in, and reports are anonymous by design — storing which ones you
 * sent would be the record rule 7 says not to keep.
 *
 * What is left is genuinely useful and needs no account: names kept in this
 * browser, re-checked live each time the page opens.
 */
export default function DashboardPage() {
  const { items, ready, remove } = useWatchlist();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center gap-2 mb-2">
        <Bookmark className="w-5 h-5 text-accent" aria-hidden />
        <h1 className="text-2xl font-bold text-text-primary">Your watchlist</h1>
      </div>
      <p className="text-sm text-text-secondary">
        Names you asked us to keep an eye on. Each one is checked again every time you
        open this page, so what you see is never a saved result.
      </p>

      <p className="inline-flex items-center gap-2 rounded-lg bg-accent/10 border border-accent/30 px-3 py-2 text-xs font-medium text-text-secondary mt-4">
        <Laptop className="w-4 h-4 text-accent flex-shrink-0" aria-hidden />
        Kept in this browser only. No account, nothing sent to us, nothing linking these
        names to you.
      </p>

      <div className="mt-8">
        <SearchBar
          placeholder="Check something, then save it from the result..."
          className="max-w-full"
        />
      </div>

      <div className="mt-10">
        {!ready ? (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-surface-alt animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-alt p-8 text-center">
            <h2 className="font-bold text-text-primary mb-2">Nothing saved yet</h2>
            <p className="text-sm text-text-secondary max-w-sm mx-auto">
              Run a check, then use <span className="font-semibold">Watch this name</span>{" "}
              on the result to keep it here.
            </p>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 mt-6 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-primary hover:brightness-110 transition-all min-h-[44px]"
            >
              <Plus className="w-4 h-4" aria-hidden />
              Run a check
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {items.map((item) => (
              <WatchlistRow
                key={item.name}
                name={item.name}
                addedAt={item.addedAt}
                onRemove={() => remove(item.name)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
