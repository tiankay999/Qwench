"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { check, QwenchError, toSlug, type CheckInput, type CheckResult } from "@/lib/qwench";
import { SearchBar } from "@/components/ui/SearchBar";
import { EvidenceReport } from "@/components/evidence/EvidenceReport";
import { DidYouMean } from "@/components/evidence/DidYouMean";
import { WatchButton } from "@/components/watchlist/WatchButton";
import { ShareButton } from "@/components/ui/ShareButton";

/**
 * The check runs during render through `use()`, not from an effect.
 *
 * An effect would set state on mount, which costs an extra render and means
 * writing the loading and error branches by hand. Suspending on a cached
 * promise lets the boundary below own the loading state, and going back to a
 * query you already ran shows its result straight away.
 */
type Outcome = { ok: true; result: CheckResult } | { ok: false; message: string };

const cache = new Map<string, Promise<Outcome>>();
const MAX_CACHED = 50;

function run(key: string, input: CheckInput): Promise<Outcome> {
  const hit = cache.get(key);
  if (hit) return hit;

  // Never rejects: the error is part of the value, so no error boundary is
  // needed and a failed check can be retried without unmounting the page.
  const promise = check(input).then(
    (result): Outcome => ({ ok: true, result }),
    (err): Outcome => ({
      ok: false,
      message:
        err instanceof QwenchError ? err.message : "Something went wrong. Please try again.",
    }),
  );

  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value as string);
  cache.set(key, promise);
  return promise;
}

function Results({ query }: { query: string }) {
  /** Set only after a "did you mean" answer. Then the name goes up exactly. */
  const [picked, setPicked] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const input: CheckInput = picked ? { recipient: picked, type: "name" } : { text: query };
  const outcome = use(run(`${attempt}:${picked ? `name:${picked}` : `text:${query}`}`, input));

  if (!outcome.ok) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/5 p-6">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4 text-danger" aria-hidden />
          <h2 className="font-bold text-text-primary">Couldn&apos;t run that check</h2>
        </div>
        <p className="text-sm text-text-secondary">{outcome.message}</p>
        <button
          onClick={() => setAttempt(attempt + 1)}
          className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-primary hover:bg-surface-alt transition-colors cursor-pointer min-h-[44px]"
        >
          Try again
        </button>
      </div>
    );
  }

  const { result } = outcome;

  // Asked before anything else, so no answer is given about the wrong name.
  if (result.did_you_mean) {
    return (
      <DidYouMean
        original={result.did_you_mean.original_query || query}
        suggested={result.did_you_mean.suggested_entity}
        onPick={setPicked}
      />
    );
  }

  const name = result.entity || picked || query;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-10">
      <EvidenceReport result={result} query={picked || query} />
      <aside className="space-y-3 lg:pt-16">
        <WatchButton name={name} />
        {result.entity && (
          <Link
            href={`/report/${toSlug(result.entity)}`}
            className="flex items-center justify-center w-full rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-alt transition-colors min-h-[44px]"
          >
            Permanent link
          </Link>
        )}
        <ShareButton title={`Qwench check: ${name}`} />
        <Link
          href={`/report-scheme?name=${encodeURIComponent(name)}`}
          className="flex items-center justify-center w-full rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-alt transition-colors min-h-[44px]"
        >
          Report this
        </Link>
      </aside>
    </div>
  );
}

function Panel() {
  const query = (useSearchParams().get("q") ?? "").trim();

  return (
    <>
      {/* Keyed on the query so the box always shows what is being checked. */}
      <SearchBar key={query} initialValue={query} autoFocus={!query} className="max-w-full" />

      <div className="mt-10">
        {query ? (
          /* Keyed too, so a new query resets both the boundary and the
             "did you mean" answer instead of inheriting the last one. */
          <Suspense key={query} fallback={<Skeleton />}>
            <Results query={query} />
          </Suspense>
        ) : (
          <div className="rounded-xl border border-border bg-surface-alt p-8 text-center">
            <h2 className="font-bold text-text-primary mb-2">What do you want to check?</h2>
            <p className="text-sm text-text-secondary max-w-md mx-auto">
              A company name, a MoMo number, a crypto wallet, a website, or paste the whole
              message you were sent. We work out which is which.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Running the check">
      <div className="h-8 w-2/3 rounded-lg bg-surface-alt" />
      <div className="h-7 w-48 rounded-lg bg-surface-alt" />
      <div className="h-20 rounded-xl bg-surface-alt" />
      <div className="h-32 rounded-xl bg-surface-alt" />
    </div>
  );
}

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-accent mb-6"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden />
        Home
      </Link>

      <Suspense fallback={<SearchBar className="max-w-full" />}>
        <Panel />
      </Suspense>
    </div>
  );
}
