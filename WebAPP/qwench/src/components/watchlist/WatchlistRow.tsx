"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, Trash2 } from "lucide-react";
import { checkName, toSlug, type CheckResult } from "@/lib/qwench";
import { StateBadge } from "@/components/evidence/StateBadge";

/**
 * One watched name, re-checked when the page loads.
 *
 * Nothing about the state is stored — only the name is. That means a row can
 * never show a stale state, and there is no saved copy of a result to drift
 * away from the register.
 */
export function WatchlistRow({
  name,
  addedAt,
  onRemove,
}: {
  name: string;
  addedAt: string;
  onRemove: () => void;
}) {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    checkName(name)
      .then((r) => live && setResult(r))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [name]);

  const source = result?.report.sources[0];

  return (
    <li className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={`/report/${toSlug(result?.entity || name)}`}
            className="font-bold text-text-primary hover:text-accent transition-colors"
          >
            {result?.entity || name}
          </Link>
          <p className="text-xs text-text-muted mt-0.5">
            Watched since {addedAt.slice(0, 10)}
          </p>
        </div>
        <button
          onClick={onRemove}
          className="p-2 text-text-muted hover:text-danger transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
          aria-label={`Stop watching ${name}`}
        >
          <Trash2 className="w-4 h-4" aria-hidden />
        </button>
      </div>

      <div className="mt-3">
        {result ? (
          <>
            <StateBadge state={result.state} />
            <p className="text-sm text-text-secondary mt-3">{result.report.state_sentence}</p>
            {source && (
              <p className="inline-flex items-center gap-1.5 text-xs text-text-muted mt-2">
                <span className="font-medium text-text-secondary">{source.publisher}</span>
                {source.date && (
                  <>
                    <CalendarDays className="w-3 h-3" aria-hidden />
                    {source.date}
                  </>
                )}
              </p>
            )}
          </>
        ) : failed ? (
          <p className="text-sm text-text-muted">
            Couldn&apos;t check this one just now. Nothing should be read into that.
          </p>
        ) : (
          <div className="h-7 w-44 rounded-lg bg-surface-alt animate-pulse" aria-label="Checking" />
        )}
      </div>
    </li>
  );
}
