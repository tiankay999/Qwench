import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { SearchBar } from "@/components/ui/SearchBar";
import { StateBadge } from "@/components/evidence/StateBadge";
import { EXAMPLE_QUERIES } from "@/lib/content";

/**
 * The frame owns the world; the column stays calm.
 *
 * The headline is factual, not an instruction. The previous one read "Protect
 * your money. Verify first." over "before you put in a single cedi", which is
 * advice twice over, and Rule 1 forbids advice on every channel.
 *
 * The brand tagline sits under the mark where the brand sheet puts it, rather
 * than as the page's own claim, because "before it sends" describes stopping a
 * payment and Qwench never stops one — the reader decides. That wording is
 * Dre's to resolve; until then it stays a brand line, not a product promise.
 *
 * The floating panel is a real report excerpt. The reference it is modelled on
 * put a risk gauge here; a gauge is a score, so what floats instead is the
 * thing Qwench actually produces — a record with a publisher and a date.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#081b38]">
      {/* Navy into brand blue, on the diagonal the mark's tail travels. A
          directional gradient rather than a radial glow: the glow reads as
          decoration sitting on the page, this reads as the page's own ground. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(118deg, #081b38 0%, #0a2f6e 52%, #0a4aae 100%)",
        }}
      />
      {/* The beam, from the cut in the Q: one angled edge, not a halo. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-[58%] opacity-[0.12]"
        style={{
          background: "linear-gradient(118deg, transparent 38%, #60d4ff 100%)",
        }}
      />

      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 md:py-24 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center lg:gap-16">
        <div>
          <h1 className="font-display text-4xl font-extrabold leading-[1.04] tracking-[-0.035em] text-white md:text-6xl">
            What is on the record
            <br />
            about who you&rsquo;re paying?
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#C7DCFF]">
            Check a name, a MoMo number, a link or a wallet against what Ghana&rsquo;s
            regulators have published. Every claim comes with its publisher, its date
            and a link to the notice.
          </p>

          <div className="mt-9">
            <SearchBar autoFocus />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-sm text-[#D6E6FF]">Try</span>
            {EXAMPLE_QUERIES.map((q) => (
              <Link
                key={q}
                href={`/search?q=${encodeURIComponent(q)}`}
                className="rounded-full border border-white/25 px-3.5 py-1.5 text-sm font-medium text-[#D6E6FF] transition-colors duration-150 ease-out-expo hover:border-white/60 hover:bg-white/10"
              >
                {q}
              </Link>
            ))}
          </div>

          <p className="mt-8 text-sm text-[#D6E6FF]">
            Qwench fraud before it sends. A safer, more trusted payments ecosystem for
            Ghana.
          </p>
        </div>

        {/* A report as it actually renders, one step back from the page. */}
        <div className="relative lg:justify-self-end">
          <div className="rounded-[18px] border border-white/12 bg-white/[0.07] p-2.5 shadow-floating backdrop-blur-xl">
            <div className="rounded-[14px] bg-surface p-5">
              <p className="font-display text-lg font-bold tracking-[-0.02em] text-text-primary">
                Yepbit Trading
              </p>

              <div className="mt-3">
                <StateBadge state="named_in_notice" />
              </div>

              <p className="mt-4 text-[15px] leading-relaxed text-text-primary">
                SEC Ghana named Yepbit Trading in a notice to the public.
              </p>

              <div className="mt-4 rounded-[10px] bg-surface-alt px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-secondary">
                  Evidence level
                </p>
                <p className="mt-1 font-display text-[15px] font-bold text-text-primary">
                  Regulator warning
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-border pt-3">
                <span className="text-[13px] font-semibold text-text-secondary">
                  SEC Ghana
                </span>
                <span className="tabular font-mono text-[13px] text-text-muted">
                  2025-07-15
                </span>
                <span className="inline-flex items-center gap-1 text-[13px] text-accent">
                  sec.gov.gh
                  <ExternalLink className="size-3" strokeWidth={1.75} aria-hidden />
                </span>
              </div>

              <p className="mt-4 text-[13px] leading-relaxed text-text-muted">
                Not a final ruling. This does not mean it is safe or unsafe.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
