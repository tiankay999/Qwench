"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { check, QwenchError, toSlug, type CheckResult } from "@/lib/qwench";
import { SearchBar } from "@/components/ui/SearchBar";
import { EvidenceReport } from "@/components/evidence/EvidenceReport";
import { DidYouMean } from "@/components/evidence/DidYouMean";
import { WatchButton } from "@/components/watchlist/WatchButton";
import { ShareButton } from "@/components/ui/ShareButton";

function Results() {
  const query = (useSearchParams().get("q") ?? "").trim();

  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async (input: Parameters<typeof check>[0]) => {
    setLoading(true);
    setError(null);
    try {
      setResult(await check(input));
    } catch (err) {
      setResult(null);
      setError(
        err instanceof QwenchError
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (query) run({ text: query });
  }, [query, run]);

  /**
   * They have now answered, so send the chosen name as an exact name. That
   * stops the API asking the same question again.
   */
  const pick = (name: string) => run({ recipient: name, type: "name" });

  if (!query) {
    return (
      <p className="text-sm text-text-secondary">
        Type a company name, a number, a wallet or a link above to check it.
      </p>
    );
  }

  if (loading) return <Skeleton />;

  if (error) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/5 p-6">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4 text-danger" aria-hidden />
          <h2 className="font-bold text-text-primary">Couldn&apos;t run that check</h2>
        </div>
        <p className="text-sm text-text-secondary">{error}</p>
        <button
          onClick={() => run({ text: query })}
          className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-primary hover:bg-surface-alt transition-colors cursor-pointer min-h-[44px]"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!result) return null;

  if (result.did_you_mean) {
    return (
      <DidYouMean
        original={result.did_you_mean.original_query || query}
        suggested={result.did_you_mean.suggested_entity}
        onPick={pick}
      />
    );
  }

  const name = result.entity || query;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-10">
      <EvidenceReport result={result} query={query} />
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

      <Suspense fallback={<SearchBar />}>
        <SearchBarWithQuery />
      </Suspense>

      <div className="mt-10">
        <Suspense fallback={<Skeleton />}>
          <Results />
        </Suspense>
      </div>
    </div>
  );
}

function SearchBarWithQuery() {
  const q = useSearchParams().get("q") ?? "";
  return <SearchBar key={q} initialValue={q} className="max-w-full" />;
}
