import Link from "next/link";
import { SearchBar } from "@/components/ui/SearchBar";
import { EXAMPLE_QUERIES } from "@/lib/content";

export function Hero() {
  return (
    <section className="py-16 md:py-24 text-center px-4">
      <h1 className="text-4xl md:text-6xl font-extrabold text-text-primary leading-tight mb-2">
        Protect your money.
      </h1>
      <h1 className="text-4xl md:text-6xl font-extrabold text-accent leading-tight mb-6">
        Verify first.
      </h1>
      <p className="text-text-secondary text-base md:text-lg max-w-xl mx-auto mb-10">
        Check any company, token, or investment in Ghana before you put in a single
        cedi.
      </p>

      <div className="flex justify-center">
        <SearchBar />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
        <span className="text-xs text-text-muted">Try</span>
        {EXAMPLE_QUERIES.map((q) => (
          <Link
            key={q}
            href={`/search?q=${encodeURIComponent(q)}`}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-accent hover:text-text-primary transition-colors"
          >
            {q}
          </Link>
        ))}
      </div>
    </section>
  );
}
