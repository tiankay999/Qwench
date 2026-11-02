import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { connection } from "next/server";
import { AlertCircle } from "lucide-react";
import { checkName, fromSlug, toSlug, type CheckResult } from "@/lib/qwench";
import { FEATURED_CHECKS } from "@/lib/content";
import { EvidenceReport } from "@/components/evidence/EvidenceReport";
import { WatchButton } from "@/components/watchlist/WatchButton";
import { ShareButton } from "@/components/ui/ShareButton";

/**
 * A permanent link for one name.
 *
 * There is no endpoint that returns an entity by slug, and adding one is the
 * backend owner's call — see docs/spec/README.md, "Who owns what". So the slug
 * is turned back into a name and checked the same way the bot checks it. Asking
 * by exact name also skips the "did you mean" step, which belongs on /search
 * where someone is there to answer it.
 */
export function generateStaticParams() {
  return FEATURED_CHECKS.map((name) => ({ slug: toSlug(name) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const name = fromSlug(slug);
  return {
    title: `${name} — Qwench check`,
    description: `What official sources say about ${name}, with dates and links. Information, not advice.`,
  };
}

/**
 * Cached so a shared link doesn't run a fresh check for every visitor, and
 * throwing on failure so an unreachable API is never the cached answer about a
 * named company for the next hour.
 */
async function fetchCheck(name: string): Promise<CheckResult> {
  "use cache";
  cacheLife("hours");
  return checkName(name);
}

async function load(name: string): Promise<CheckResult | null> {
  // The page shell still prerenders; only the result waits for a request. The
  // image is built with no backend, so prerendering this would publish
  // "couldn't reach Qwench" as the answer about a real company.
  await connection();
  try {
    return await fetchCheck(name);
  } catch {
    return null;
  }
}

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const name = fromSlug(slug);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="text-xs text-text-muted mb-6">
        <Link href="/" className="hover:text-accent">
          Home
        </Link>
        {" › "}
        <span className="text-text-primary">{name}</span>
      </nav>

      <Suspense fallback={<Skeleton name={name} />}>
        <Result name={name} />
      </Suspense>
    </div>
  );
}

async function Result({ name }: { name: string }) {
  const result = await load(name);

  if (!result) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/5 p-6">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4 text-danger" aria-hidden />
          <h1 className="font-bold text-text-primary">Couldn&apos;t reach Qwench</h1>
        </div>
        <p className="text-sm text-text-secondary">
          This page could not be checked just now. Nothing about{" "}
          <span className="font-semibold">{name}</span> should be read into that.
        </p>
        <Link
          href={`/search?q=${encodeURIComponent(name)}`}
          className="inline-flex items-center mt-4 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-primary hover:bg-surface-alt transition-colors min-h-[44px]"
        >
          Try the search page
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-10">
      <EvidenceReport result={result} query={name} />
      <aside className="space-y-3 lg:pt-16">
        <WatchButton name={result.entity || name} />
        <ShareButton title={`Qwench check: ${result.entity || name}`} />
        <Link
          href={`/report-scheme?name=${encodeURIComponent(result.entity || name)}`}
          className="flex items-center justify-center w-full rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-alt transition-colors min-h-[44px]"
        >
          Report this
        </Link>
        <Link
          href="/appeal"
          className="flex items-center justify-center w-full rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-alt transition-colors min-h-[44px]"
        >
          Appeal this listing
        </Link>
      </aside>
    </div>
  );
}

function Skeleton({ name }: { name: string }) {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label={`Checking ${name}`}>
      <div className="h-9 w-2/3 rounded-lg bg-surface-alt" />
      <div className="h-7 w-48 rounded-lg bg-surface-alt" />
      <div className="h-24 rounded-xl bg-surface-alt" />
      <div className="h-36 rounded-xl bg-surface-alt" />
    </div>
  );
}
