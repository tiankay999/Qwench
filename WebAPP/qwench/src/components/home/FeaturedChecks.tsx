import Link from "next/link";
import { cacheLife } from "next/cache";
import { CalendarDays } from "lucide-react";
import { checkName, toSlug, type CheckResult } from "@/lib/qwench";
import { FEATURED_CHECKS } from "@/lib/content";
import { StateBadge } from "@/components/evidence/StateBadge";

/**
 * Names people are likely to look up, each one checked for real.
 *
 * Which names appear is an editorial choice (src/lib/content.ts). Everything
 * shown beside a name — its state, its publisher, its date — comes from a live
 * POST /v1/public/check, so a withdrawn record changes this strip on its own
 * and no claim here can go stale against the register.
 *
 * There is no "trending" here. A count of how often something is checked is
 * not evidence about it, and the prototype's "247 reports" numbers were made up.
 */
async function load(): Promise<{ name: string; result: CheckResult }[]> {
  "use cache";
  cacheLife("hours");

  const settled = await Promise.allSettled(
    FEATURED_CHECKS.map(async (name) => ({ name, result: await checkName(name) })),
  );

  return settled
    .filter((s): s is PromiseFulfilledResult<{ name: string; result: CheckResult }> => s.status === "fulfilled")
    .map((s) => s.value)
    .filter(({ result }) => result.match);
}

export async function FeaturedChecks() {
  const checks = await load();
  if (!checks.length) return null;

  return (
    <section className="px-4 pb-16">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-end justify-between mb-2">
          <h2 className="text-xl font-bold text-text-primary">On the official registers</h2>
          <Link href="/about" className="text-sm font-medium text-accent hover:underline">
            Where this comes from →
          </Link>
        </div>
        <p className="text-sm text-text-secondary mb-6">
          Names that appear in a published notice or on a licence register. Checked live
          — each card is a real result, not a saved one.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {checks.map(({ name, result }) => {
            const source = result.report.sources[0];
            return (
              <Link
                key={name}
                href={`/report/${toSlug(result.entity || name)}`}
                className="rounded-xl border border-border bg-surface p-5 hover:border-accent hover:shadow-md transition-all flex flex-col"
              >
                <StateBadge state={result.state} className="self-start mb-3" />
                <h3 className="font-bold text-text-primary mb-2">{result.entity || name}</h3>
                {source && (
                  <div className="mt-auto pt-2 text-xs text-text-muted space-y-1">
                    <p className="font-medium text-text-secondary">{source.publisher}</p>
                    {source.date && (
                      <p className="inline-flex items-center gap-1.5">
                        <CalendarDays className="w-3 h-3" aria-hidden />
                        {source.date}
                      </p>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
