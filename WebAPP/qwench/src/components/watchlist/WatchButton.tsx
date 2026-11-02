"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useWatchlist } from "@/lib/watchlist";

/** Saves a name to this browser's watchlist. Nothing leaves the device. */
export function WatchButton({ name }: { name: string }) {
  const { has, add, remove, ready } = useWatchlist();
  const saved = ready && has(name);

  return (
    <button
      onClick={() => (saved ? remove(name) : add(name))}
      className="flex items-center justify-center gap-2 w-full rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-alt transition-colors cursor-pointer min-h-[44px]"
    >
      {saved ? (
        <>
          <BookmarkCheck className="w-4 h-4 text-accent" aria-hidden />
          On your watchlist
        </>
      ) : (
        <>
          <Bookmark className="w-4 h-4" aria-hidden />
          Watch this name
        </>
      )}
    </button>
  );
}
